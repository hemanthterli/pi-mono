from pi.ai.base import ToolDefinition

DEFINITION = ToolDefinition(
    name="read",
    description="Read the contents of one or more files. Returns the file contents with line numbers.",
    parameters={
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Path to the file to read",
            }
        },
        "required": ["path"],
    },
)


def execute(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8") as f:
            # Limit to 500KB
            content = f.read(512 * 1024)
            lines = content.splitlines(keepends=True)
            numbered = "".join(f"{i + 1}\t{line}" for i, line in enumerate(lines))
            if f.read(1):
                numbered += "\n... (file truncated)"
            return numbered or "(empty file)"
    except FileNotFoundError:
        return f"Error: file not found: {path}"
    except Exception as e:
        return f"Error: {e}"
