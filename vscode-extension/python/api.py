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
import logging
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables from .env file before anything else
load_dotenv()

from pi.ai.providers import get_chat
from pi.chat import _build_system_prompt, TOOLS, EXECUTORS, SLASH_COMMANDS
from pi import session as session_manager
from pi import config as _config
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
    logger.info("WebSocket client connected.")
    
    try:
        # Wait for the initial configuration/message from the client
        init_data = await websocket.receive_text()
        logger.debug(f"Received initial data: {init_data}")
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
                    logger.debug(f"Received data: {data}")
                    req = json.loads(data)
                    if req.get("type") == "get_commands":
                        await websocket.send_json({
                            "type": "commands_list",
                            "commands": SLASH_COMMANDS
                        })
                        continue
                    
                    user_message = req.get("message", "")
                    images_b64 = req.get("images", [])
                    image_paths = save_base64_images(session_id, images_b64)
                    
                    if not user_message and not image_paths:
                        continue
                    
                    # If this is a new message and history is empty, reload it now that we have a message
                    # if not history:
                    #     history = session_manager.load(session_file)
                    #     chat = get_chat(provider, system_prompt, TOOLS, history, model=model)

                # Handle slash commands
                if user_message and user_message.startswith("/"):
                    parts = user_message.split(maxsplit=2)
                    cmd = parts[0].lower()
                    arg = parts[1].strip() if len(parts) > 1 else ""
                    logger.info(f"Processing slash command: {cmd} with arg: '{arg}'")
                    
                    if cmd == "/clear":
                        if os.path.exists(session_file):
                            os.remove(session_file)
                        history = []
                        chat = get_chat(provider, system_prompt, TOOLS, history, model=model)
                        await websocket.send_json({"type": "text", "content": "*(Session cleared)*"})
                        await websocket.send_json({"type": "done"})
                        user_message = ""
                        image_paths = []
                        continue
                    
                    elif cmd == "/model":
                        if arg:
                            model = arg
                            chat = get_chat(provider, system_prompt, TOOLS, history, model=model)
                            await websocket.send_json({"type": "text", "content": f"*(Model switched to {model})*"})
                        else:
                            await websocket.send_json({"type": "text", "content": f"*(Current model: {model})*"})
                        await websocket.send_json({"type": "done"})
                        user_message = ""
                        image_paths = []
                        continue

                    elif cmd == "/provider":
                        if arg.lower() in ["gemini", "openai"]:
                            provider = arg.lower()
                            chat = get_chat(provider, system_prompt, TOOLS, history, model=model)
                            await websocket.send_json({"type": "text", "content": f"*(Provider switched to {provider})*"})
                        elif not arg:
                            await websocket.send_json({"type": "text", "content": f"*(Current provider: {provider}. Use /provider gemini or /provider openai)*"})
                        else:
                            await websocket.send_json({"type": "text", "content": f"*(Unknown provider: {arg!r}. Use gemini or openai)*"})
                        await websocket.send_json({"type": "done"})
                        user_message = ""
                        image_paths = []
                        continue
                    
                    elif cmd == "/session":
                        if arg:
                            session_id = arg
                            session_file = os.path.join(sessions_dir, f"{session_id}.jsonl")
                            history = session_manager.load(session_file)
                            chat = get_chat(provider, system_prompt, TOOLS, history, model=model)
                            await websocket.send_json({"type": "text", "content": f"*(Switched to session: {session_id})*"})
                        else:
                            await websocket.send_json({"type": "text", "content": f"*(Current session: {session_id})*"})
                        await websocket.send_json({"type": "done"})
                        user_message = ""
                        image_paths = []
                        continue
                        
                    elif cmd == "/sessions":
                        import glob
                        files = glob.glob(os.path.join(sessions_dir, "*.jsonl"))
                        if not files:
                            await websocket.send_json({"type": "text", "content": "*(No saved sessions found)*"})
                        else:
                            sess_names = [os.path.splitext(os.path.basename(f))[0] for f in files]
                            await websocket.send_json({"type": "text", "content": f"*(Saved sessions: {', '.join(sess_names)})*"})
                        await websocket.send_json({"type": "done"})
                        user_message = ""
                        image_paths = []
                        continue
                        
                    elif cmd == "/delete":
                        target = arg or session_id
                        target_file = os.path.join(sessions_dir, f"{target}.jsonl")
                        if os.path.exists(target_file):
                            os.remove(target_file)
                            await websocket.send_json({"type": "text", "content": f"*(Deleted session: {target})*"})
                            if target == session_id:
                                session_id = "default"
                                session_file = os.path.join(sessions_dir, f"{session_id}.jsonl")
                                history = []
                                chat = get_chat(provider, system_prompt, TOOLS, history, model=model)
                        else:
                            await websocket.send_json({"type": "text", "content": f"*(Session not found: {target})*"})
                        await websocket.send_json({"type": "done"})
                        user_message = ""
                        image_paths = []
                        continue
                        
                    elif cmd == "/compact":
                        from pi.chat import COMPACT_PROMPT
                        await websocket.send_json({"type": "text", "content": "*(Compacting session...)*\n"})
                        summary, _ = chat.send(COMPACT_PROMPT)
                        if summary:
                            if os.path.exists(session_file):
                                os.remove(session_file)
                            session_manager.append(session_file, "assistant", f"[Compacted context]\n{summary}")
                            history = session_manager.load(session_file)
                            chat = get_chat(provider, system_prompt, TOOLS, history, model=model)
                            await websocket.send_json({"type": "text", "content": "*(Session compacted successfully)*"})
                        else:
                            await websocket.send_json({"type": "text", "content": "*(Compaction failed)*"})
                        await websocket.send_json({"type": "done"})
                        user_message = ""
                        image_paths = []
                        continue

                    elif cmd == "/help":
                        lines = ["**Available commands:**\n"]

                        for sc in SLASH_COMMANDS:
                            # Support both possible key names: "cmd" or "command"
                            command = sc.get("cmd") or sc.get("command")
                            description = sc.get("desc") or sc.get("description", "")

                            if command:
                                lines.append(f"`{command}` — {description}")

                        await websocket.send_json({
                            "type": "text",
                            "content": "\n".join(lines)
                        })
                        await websocket.send_json({"type": "done"})

                        user_message = ""
                        image_paths = []
                        continue


                    elif cmd == "/config":
                        if arg == "set":
                            rest = parts[2] if len(parts) > 2 else ""
                            kv = rest.split(maxsplit=1)
                            if len(kv) == 2:
                                ok, msg = _config.set_value(kv[0], kv[1])
                                await websocket.send_json({"type": "text", "content": f"*({msg})*"})
                            else:
                                await websocket.send_json({"type": "text", "content": "*(Usage: /config set \<key\> \<value\>)*"})
                        else:
                            cfg = _config.load()
                            lines = ["**Current config:**\n"]
                            for k, v in cfg.items():
                                if isinstance(v, dict):
                                    for kk, vv in v.items():
                                        lines.append(f"`{k}.{kk}` = `{vv}`")
                                else:
                                    lines.append(f"`{k}` = `{v}`")
                            await websocket.send_json({"type": "text", "content": "\n".join(lines)})
                        await websocket.send_json({"type": "done"})
                        user_message = ""
                        image_paths = []
                        continue

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
                
                logger.info(f"Sending to LLM: {llm_input}")
                tool_calls = []
                text_buffer = ""
                
                # 1. Stream initial LLM response
                for chunk in chat.send_stream(llm_input):
                    if isinstance(chunk, str):
                        text_buffer += chunk
                        await websocket.send_json({"type": "text", "content": chunk})
                    elif isinstance(chunk, list):
                        tool_calls = chunk
                        logger.info(f"LLM responded with tool calls: {[tc.name for tc in tool_calls]}")
                        
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
                        logger.info(f"Executing tool: {tc.name} with args: {tc.args}")
                        
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
                        logger.info(f"Tool {tc.name} finished. Output length: {len(output)}")
                        
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
                logger.info("Client disconnected normally during loop")
                break
            
    except WebSocketDisconnect:
        logger.info("Client disconnected.")
    except Exception as e:
        logger.error(f"An unexpected error occurred: {e}", exc_info=True)
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
            await websocket.close()
        except:
            pass
