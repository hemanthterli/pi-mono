import subprocess
from google.genai import types

DECLARATION = types.FunctionDeclaration(
    name="bash",
    description=(
        "Run a shell command and return its output. "
        "Use this to read files, list directories, run scripts, or interact with the system."
    ),
    parameters=types.Schema(
        type=types.Type.OBJECT,
        properties={
            "command": types.Schema(
                type=types.Type.STRING,
                description="The shell command to run",
            )
        },
        required=["command"],
    ),
)


def execute(command: str) -> str:
    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True,
        timeout=30,
    )
    output = result.stdout
    if result.stderr:
        output += f"\n[stderr]\n{result.stderr}"
    return output.strip() or "(no output)"
