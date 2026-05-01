import subprocess
import sys
from pi.ai.base import ToolDefinition

DEFINITION = ToolDefinition(
    name="bash",
    description=(
        "Run a shell command and return its output. "
        "Use this to read files, list directories, run scripts, or interact with the system."
    ),
    parameters={
        "type": "object",
        "properties": {
            "command": {
                "type": "string",
                "description": "The shell command to run",
            }
        },
        "required": ["command"],
    },
)


def execute(command: str) -> str:
    if sys.platform == "win32":
        args = ["bash", "-c", command]
        shell = False
    else:
        args = command
        shell = True
    result = subprocess.run(
        args,
        shell=shell,
        capture_output=True,
        text=True,
        timeout=30,
    )
    output = result.stdout
    if result.stderr:
        output += f"\n[stderr]\n{result.stderr}"
    return output.strip() or "(no output)"
