import asyncio
import websockets
import json

async def test_chat():
    uri = "ws://localhost:8001/ws/chat"
    
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            # 1. Send the initial request
            request = {
                "message": "Use the ask_user tool to ask me what my favorite color is.",
                "session_id": "test_ws_session",
                "provider": "gemini",
                "model": "gemini-2.0-flash"
            }
            await websocket.send(json.dumps(request))
            print(f"Sent: {request['message']}\n")
            
            # 2. Listen for the stream of events
            while True:
                try:
                    response = await websocket.recv()
                    data = json.loads(response)
                    
                    event_type = data.get("type")
                    
                    if event_type == "text":
                        # Print streaming text without newlines
                        print(data.get("content", ""), end="", flush=True)
                        
                    elif event_type == "tool_start":
                        print(f"\n\n[TOOL STARTED] {data.get('name')}")
                        print(f"Args: {data.get('args')}")
                        
                    elif event_type == "ask_user":
                        # This is the crucial part: The server is waiting for our input!
                        print(f"\n\n[AI ASKS] {data.get('question')}")
                        user_input = input("Your answer: ")
                        
                        # Send the answer back up the socket
                        reply = {"answer": user_input}
                        await websocket.send(json.dumps(reply))
                        print("[Sent reply to AI]")
                        
                    elif event_type == "tool_end":
                        print(f"[TOOL FINISHED] {data.get('name')}")
                        print(f"Result preview: {data.get('result')}\n")
                        
                    elif event_type == "done":
                        print("\n\n[STREAM COMPLETED]")
                        break
                        
                    elif event_type == "error":
                        print(f"\n[ERROR] {data.get('message')}")
                        break
                        
                except websockets.exceptions.ConnectionClosed:
                    print("\nConnection closed by server.")
                    break
                    
    except ConnectionRefusedError:
        print("\nERROR: Could not connect. Is the FastAPI server running?")
        print("Run it with: uv run uvicorn api:app --reload")

if __name__ == "__main__":
    asyncio.run(test_chat())
