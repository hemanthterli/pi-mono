from pi.ai.base import ToolResult
from pi.ai.providers import get_chat
from pi.tools import bash as bash_tool
from pi.tools import read as read_tool
from pi.tools import write as write_tool
from pi.tools import edit as edit_tool

SYSTEM_PROMPT = (
    "You are Pi, an AI coding assistant running in the terminal. "
    "You have tools to run shell commands, read files, write files, and edit files. "
    "Prefer 'edit' over 'write' when making targeted changes to existing files. "
    "Be concise and helpful."
)

TOOLS = [
    bash_tool.DEFINITION,
    read_tool.DEFINITION,
    write_tool.DEFINITION,
    edit_tool.DEFINITION,
]

EXECUTORS = {
    "bash": bash_tool.execute,
    "read": read_tool.execute,
    "write": write_tool.execute,
    "edit": edit_tool.execute,
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
                label = tc.args.get("path") or tc.args.get("command") or tc.name
                print(f"\n  [{tc.name}] {label}")
                output = EXECUTORS[tc.name](**tc.args)
                print(f"  {output}\n")
                results.append(ToolResult(name=tc.name, output=output, id=tc.id))
            text, tool_calls = chat.send(results)

        print(f"\nPi: {text}\n")
