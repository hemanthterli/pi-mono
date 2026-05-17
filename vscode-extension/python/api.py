from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import json
import os
import asyncio

from pi.ai.providers import get_chat
from pi.chat import _build_system_prompt, TOOLS, EXECUTORS
from pi import session as session_manager
from pi.ai.base import ToolResult

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
        
        sessions_dir = os.path.expanduser("~/.pi/sessions")
        os.makedirs(sessions_dir, exist_ok=True)
        session_file = os.path.join(sessions_dir, f"{session_id}.jsonl")
        
        # Load history and initialize chat
        history = session_manager.load(session_file)
        system_prompt = _build_system_prompt()
        chat = get_chat(provider, system_prompt, TOOLS, history, model=model)
        
        # Save user message
        if user_message:
            session_manager.append(session_file, "user", user_message)
            
        tool_calls = []
        text_buffer = ""
        
        # 1. Stream initial LLM response
        for chunk in chat.send_stream(user_message):
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
                    output = reply_json.get("answer", "User declined to answer.")
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
                
        # Signal completion
        await websocket.send_json({"type": "done"})
        await websocket.close()
        
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
            await websocket.close()
        except:
            pass
