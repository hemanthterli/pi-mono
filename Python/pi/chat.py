from google.genai import types
from pi.ai.client import get_client
from pi.tools import bash as bash_tool

MODEL = "gemini-3-flash-preview"

SYSTEM_PROMPT = (
    "You are Pi, an AI coding assistant running in the terminal. "
    "You have a bash tool to run shell commands, read files, and interact with the system. "
    "When the user asks you to do something that requires running a command, use the bash tool. "
    "Be concise and helpful."
)


def start_chat_loop() -> None:
    client = get_client()

    chat = client.chats.create(
        model=MODEL,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            tools=[types.Tool(function_declarations=[bash_tool.DECLARATION])],
        ),
    )

    print("Pi — coding assistant. Type 'exit' to quit.\n")

    while True:
        user_input = input("You: ").strip()

        if user_input.lower() in ("exit", "quit"):
            print("Goodbye!")
            break

        if not user_input:
            continue

        response = chat.send_message(user_input)

        # Agent loop — keep going while Gemini wants to call tools
        while response.function_calls:
            tool_results = []
            for fc in response.function_calls:
                print(f"\n  [bash] $ {fc.args['command']}")
                output = bash_tool.execute(fc.args["command"])
                print(f"  {output}\n")
                tool_results.append(
                    types.Part.from_function_response(
                        name=fc.name,
                        response={"output": output},
                    )
                )
            response = chat.send_message(tool_results)

        print(f"\nPi: {response.text}\n")
