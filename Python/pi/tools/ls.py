import os
from pi.ai.base import ToolDefinition

DEFINITION = ToolDefinition(
    name="ls",
    description="List files and directories at a path. Use '.' for the current directory.",
    parameters={
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Directory path to list",
            },
        },
        "required": ["path"],
    },
)


def execute(path: str) -> str:
    try:
        dirs = []
        files = []

        with os.scandir(path) as it:
            for entry in it:
                if entry.is_dir():
                    dirs.append(f"  {entry.name}/")
                else:
                    size = entry.stat().st_size
                    if size < 1024:
                        size_str = f"{size} B"
                    elif size < 1024 * 1024:
                        size_str = f"{size / 1024:.1f} KB"
                    else:
                        size_str = f"{size / (1024 * 1024):.1f} MB"
                    files.append(f"  {entry.name}  ({size_str})")

        dirs.sort()
        files.sort()

        lines = [f"{os.path.abspath(path)}"] + dirs + files
        return "\n".join(lines) or "(empty directory)"
    except FileNotFoundError:
        return f"Error: directory not found: {path}"
    except Exception as e:
        return f"Error: {e}"
