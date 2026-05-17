from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import json
import os
import sys
import asyncio
import base64
import uuid
from dotenv import load_dotenv

# Load environment variables from .env file before anything else
load_dotenv()

from pi.ai.providers import get_chat
from pi.chat import _build_system_prompt, TOOLS, EXECUTORS
from pi import session as session_manager
from pi.ai.base import ToolResult

def save_base64_images(session_id: str, images_b64: list) -> list:
    if not images_b64:
        return []
    
    img_dir = os.path.expanduser(f"~/.pi/sessions/images/{session_id}")
    os.makedirs(img_dir, exist_ok=True)
    
    saved_paths = []
    for b64 in images_b64:
        # e.g., "data:image/png;base64,iVBORw0KGgo..."
        if "," in b64:
            header, data = b64.split(",", 1)
            ext = ".png" # default
            if "image/jpeg" in header: ext = ".jpg"
            elif "image/webp" in header: ext = ".webp"
        else:
            data = b64
            ext = ".png"
            
        try:
            raw_bytes = base64.b64decode(data)
            file_name = f"{uuid.uuid4().hex}{ext}"
            file_path = os.path.join(img_dir, file_name)
            with open(file_path, "wb") as f:
                f.write(raw_bytes)
            saved_paths.append(file_path)
        except Exception as e:
            print(f"Error decoding/saving image: {e}")
            
    return saved_paths

app = FastAPI(title="Pi WebSocket API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/config")
def get_config():
    return {
        "version": sys.version,
        "platform": sys.platform,
    }


@app.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    try:
        # Wait for the initial configuration/message from the client
        init_data = await websocket.receive_text()
        req = json.loads(init_data)
        
        session_id = req.get("session_id", "default")
        provider = req.get("provider", "gemini")
        model = req.get("model", "gemini-2.5-pro")
        user_message = req.get("message", "")
        images_b64 = req.get("images", [])
        
        sessions_dir = os.path.expanduser("~/.pi/sessions")
        os.makedirs(sessions_dir, exist_ok=True)
        session_file = os.path.join(sessions_dir, f"{session_id}.jsonl")
        
        # Save any initially provided images
        image_paths = save_base64_images(session_id, images_b64)
        
        # Load history and initialize chat
        history = session_manager.load(session_file) if user_message else []
        system_prompt = _build_system_prompt()
        chat = get_chat(provider, system_prompt, TOOLS, history, model=model)
        
        while True:
            try:
                # If we don't have a user message yet (e.g. after the first loop), wait for one
                if not user_message:
                    data = await websocket.receive_text()
                    req = json.loads(data)
                    user_message = req.get("message", "")
                    images_b64 = req.get("images", [])
                    image_paths = save_base64_images(session_id, images_b64)
                    
                    if not user_message and not image_paths:
                        continue
                    
                    # If this is a new message and history is empty, reload it now that we have a message
                    if not history:
                        history = session_manager.load(session_file)
                        chat = get_chat(provider, system_prompt, TOOLS, history, model=model)

                # Save user message and prepare LLM input
                if image_paths:
                    content_list = []
                    if user_message:
                        content_list.append({"type": "text", "text": user_message})
                    for path in image_paths:
                        content_list.append({"type": "image", "path": path})
                    session_manager.append(session_file, "user", content_list)
                    llm_input = content_list
                else:
                    session_manager.append(session_file, "user", user_message)
                    llm_input = user_message
                
                tool_calls = []
                text_buffer = ""
                
                # 1. Stream initial LLM response
                for chunk in chat.send_stream(llm_input):
                    if isinstance(chunk, str):
                        text_buffer += chunk
                        await websocket.send_json({"type": "text", "content": chunk})
                    elif isinstance(chunk, list):
                        tool_calls = chunk
                        
                # Save assistant initial response
                if tool_calls:
                    session_manager.append_assistant(session_file, text_buffer or None, [
                        {"id": tc.id, "name": tc.name, "args": tc.args} for tc in tool_calls
                    ])
                else:
                    session_manager.append(session_file, "assistant", text_buffer)

                # 2. Agent Loop (Execute tools, handle interactive asks, send results to LLM)
                while tool_calls:
                    results = []
                    for tc in tool_calls:
                        await websocket.send_json({
                            "type": "tool_start", 
                            "id": tc.id, 
                            "name": tc.name, 
                            "args": tc.args
                        })
                        
                        # SPECIAL CASE: Interactive tools like ask_user
                        if tc.name == "ask_user":
                            # Send question to UI
                            await websocket.send_json({
                                "type": "ask_user",
                                "question": tc.args.get("question", "Require user input:")
                            })
                            # Pause and WAIT for user reply over the same socket
                            reply_data = await websocket.receive_text()
                            reply_json = json.loads(reply_data)
                            output = reply_json.get("answer", reply_json.get("message", "User declined to answer."))
                        else:
                            # Normal tools (bash, read, edit)
                            try:
                                output = EXECUTORS[tc.name](**tc.args)
                            except Exception as e:
                                output = f"Error executing tool: {str(e)}"
                        
                        # Save and append result
                        session_manager.append_tool_result(session_file, tc.id, tc.name, output)
                        results.append(ToolResult(name=tc.name, output=output, id=tc.id))
                        
                        # Truncate output for the UI log
                        display_out = output[:500] + ("..." if len(output) > 500 else "")
                        await websocket.send_json({
                            "type": "tool_end",
                            "id": tc.id,
                            "name": tc.name,
                            "result": display_out
                        })
                        
                    # Send results back to LLM for the next step
                    new_text, tool_calls = chat.send(results)
                    
                    if new_text:
                        await websocket.send_json({"type": "text", "content": "\n" + new_text})
                    # Save assistant response   
                    if tool_calls:
                        session_manager.append_assistant(session_file, new_text or None, [
                            {"id": tc.id, "name": tc.name, "args": tc.args} for tc in tool_calls
                        ])
                    elif new_text:
                        session_manager.append(session_file, "assistant", new_text)
                        
                # Signal completion of this turn
                await websocket.send_json({"type": "done"})
                
                # Clear user_message and image_paths so the loop waits for the next one
                user_message = ""
                image_paths = []
                
            except WebSocketDisconnect:
                print("Client disconnected normally during loop")
                break
            
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
            await websocket.close()
        except:
            pass
