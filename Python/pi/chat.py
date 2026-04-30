from pi.ai.base import ToolResult
from pi.ai.providers import get_chat
from pi.tools import bash as bash_tool

SYSTEM_PROMPT = (
    "You are Pi, an AI coding assistant running in the terminal. "
    "You have a bash tool to run shell commands, read files, and interact with the system. "
    "When the user asks you to do something that requires running a command, use the bash tool. "
    "Be concise and helpful."
)

TOOLS = [bash_tool.DEFINITION]

EXECUTORS = {
    "bash": bash_tool.execute,
}


def start_chat_loop(provider: str = "gemini") -> None:
    chat = get_chat(provider, SYSTEM_PROMPT, TOOLS)

    print(f"Pi — coding assistant [{provider}]. Type 'exit' to quit.\n")

    while True:
        user_input = input("You: ").strip()

        if user_input.lower() in ("exit", "quit"):
            print("Goodbye!")
            break

        if not user_input:
            continue

        text, tool_calls = chat.send(user_input)

        # Agent loop — runs until no more tool calls
        while tool_calls:
            results = []
            for tc in tool_calls:
                print(f"\n  [bash] $ {tc.args['command']}")
                output = EXECUTORS[tc.name](**tc.args)
                print(f"  {output}\n")
                results.append(ToolResult(name=tc.name, output=output, id=tc.id))
            text, tool_calls = chat.send(results)

        print(f"\nPi: {text}\n")
