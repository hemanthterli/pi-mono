import os
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel

from pi.ai.base import ToolResult
from pi.ai.providers import get_chat
from pi.tools import bash as bash_tool
from pi.tools import read as read_tool
from pi.tools import write as write_tool
from pi.tools import edit as edit_tool
from pi.tools import grep as grep_tool
from pi.tools import ls as ls_tool
from pi import session

console = Console()

SYSTEM_PROMPT = (
    "You are Pi, an AI coding assistant running in the terminal. "
    "You have tools to run shell commands, read/write/edit files, list directories, and search file contents. "
    "Prefer 'edit' over 'write' for targeted changes. "
    "Use 'grep' instead of 'read' when searching for something specific across files. "
    "Be concise and helpful."
)

TOOLS = [
    bash_tool.DEFINITION,
    read_tool.DEFINITION,
    write_tool.DEFINITION,
    edit_tool.DEFINITION,
    grep_tool.DEFINITION,
    ls_tool.DEFINITION,
]

EXECUTORS = {
    "bash": bash_tool.execute,
    "read": read_tool.execute,
    "write": write_tool.execute,
    "edit": edit_tool.execute,
    "grep": grep_tool.execute,
    "ls": ls_tool.execute,
}

SESSION_FILE = "session.jsonl"


def start_chat_loop(provider: str = "gemini") -> None:
    history = session.load(SESSION_FILE)

    if history:
        console.print(f"[dim]Resuming session ({len(history)} messages). Type 'new' to start fresh.[/dim]\n")
    else:
        console.print(f"[bold]Pi[/bold] — coding assistant [[cyan]{provider}[/cyan]]. Type 'exit' to quit.\n")

    chat = get_chat(provider, SYSTEM_PROMPT, TOOLS, history)

    while True:
        try:
            user_input = input("You: ").strip()
        except (KeyboardInterrupt, EOFError):
            console.print("\n[dim]Goodbye![/dim]")
            break

        if user_input.lower() in ("exit", "quit"):
            console.print("[dim]Goodbye![/dim]")
            break

        if user_input.lower() == "new":
            if os.path.exists(SESSION_FILE):
                os.remove(SESSION_FILE)
            console.print("[dim]Session cleared.[/dim]\n")
            chat = get_chat(provider, SYSTEM_PROMPT, TOOLS, [])
            continue

        if not user_input:
            continue

        session.append(SESSION_FILE, "user", user_input)

        # Stream the initial response
        text_buffer = ""
        tool_calls = []
        got_text = False

        for chunk in chat.send_stream(user_input):
            if isinstance(chunk, str):
                if not got_text:
                    console.print("\n[bold green]Pi:[/bold green] ", end="")
                    got_text = True
                console.print(chunk, end="")
                text_buffer += chunk
            elif isinstance(chunk, list):
                tool_calls = chunk

        if got_text:
            console.print("\n")

        # Agent loop — runs until no more tool calls
        while tool_calls:
            results = []
            for tc in tool_calls:
                label = tc.args.get("command") or tc.args.get("path") or tc.name
                console.print(
                    Panel(f"[dim]{label}[/dim]", title=f"[bold cyan]{tc.name}[/bold cyan]", expand=False)
                )
                output = EXECUTORS[tc.name](**tc.args)
                console.print(f"[dim]{output[:600]}[/dim]\n")
                results.append(ToolResult(name=tc.name, output=output, id=tc.id))

            text_buffer, tool_calls = chat.send(results)

        # Final response after tool calls (non-streamed)
        if not got_text and text_buffer:
            console.print()
            console.print("[bold green]Pi:[/bold green]")
            console.print(Markdown(text_buffer))
            console.print()

        session.append(SESSION_FILE, "assistant", text_buffer)
