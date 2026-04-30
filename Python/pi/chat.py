import os
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.table import Table

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

DEFAULT_MODELS = {
    "gemini": "gemini-3-flash-preview",
    "openai": "gpt-4o-mini",
}


def _print_help() -> None:
    table = Table(title="Pi Slash Commands", show_header=True, header_style="bold cyan")
    table.add_column("Command", style="bold")
    table.add_column("Description")
    table.add_row("/help", "Show this help message")
    table.add_row("/clear", "Clear session history and start fresh")
    table.add_row("/model [name]", "Show current model or switch to a new one")
    table.add_row("/provider <name>", "Switch provider: gemini or openai")
    console.print(table)
    console.print()


def start_chat_loop(provider: str = "gemini") -> None:
    history = session.load(SESSION_FILE)
    current_provider = provider
    current_model = DEFAULT_MODELS.get(provider)

    if history:
        console.print(f"[dim]Resuming session ({len(history)} messages). Type /clear to start fresh.[/dim]\n")
    else:
        console.print(
            f"[bold]Pi[/bold] — coding assistant "
            f"[[cyan]{current_provider}[/cyan]] [[dim]{current_model}[/dim]]. "
            f"Type /help for commands.\n"
        )

    chat = get_chat(current_provider, SYSTEM_PROMPT, TOOLS, history, model=current_model)

    while True:
        try:
            user_input = input("You: ").strip()
        except (KeyboardInterrupt, EOFError):
            console.print("\n[dim]Goodbye![/dim]")
            break

        if user_input.lower() in ("exit", "quit"):
            console.print("[dim]Goodbye![/dim]")
            break

        # --- Slash commands ---
        if user_input.startswith("/"):
            parts = user_input.split(maxsplit=1)
            cmd = parts[0].lower()
            arg = parts[1].strip() if len(parts) > 1 else ""

            if cmd == "/help":
                _print_help()

            elif cmd == "/clear":
                if os.path.exists(SESSION_FILE):
                    os.remove(SESSION_FILE)
                chat = get_chat(current_provider, SYSTEM_PROMPT, TOOLS, [], model=current_model)
                console.print("[dim]Session cleared.[/dim]\n")

            elif cmd == "/model":
                if not arg:
                    console.print(f"[dim]Current model: {current_model}[/dim]\n")
                else:
                    current_model = arg
                    if os.path.exists(SESSION_FILE):
                        os.remove(SESSION_FILE)
                    chat = get_chat(current_provider, SYSTEM_PROMPT, TOOLS, [], model=current_model)
                    console.print(f"[dim]Switched to model: {current_model}. Session cleared.[/dim]\n")

            elif cmd == "/provider":
                if arg not in ("gemini", "openai"):
                    console.print(f"[red]Unknown provider: {arg!r}. Use 'gemini' or 'openai'.[/red]\n")
                else:
                    current_provider = arg
                    current_model = DEFAULT_MODELS[current_provider]
                    if os.path.exists(SESSION_FILE):
                        os.remove(SESSION_FILE)
                    chat = get_chat(current_provider, SYSTEM_PROMPT, TOOLS, [], model=current_model)
                    console.print(f"[dim]Switched to {current_provider} ({current_model}). Session cleared.[/dim]\n")

            else:
                console.print(f"[red]Unknown command: {cmd}. Type /help for a list.[/red]\n")

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
