from pi.ai.base import ToolDefinition

DEFINITION = ToolDefinition(
    name="read",
    description="Read the contents of a file. Returns the file content with line numbers.",
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
            lines = f.readlines()
        numbered = "".join(f"{i + 1}\t{line}" for i, line in enumerate(lines))
        return numbered or "(empty file)"
    except FileNotFoundError:
        return f"Error: file not found: {path}"
    except Exception as e:
        return f"Error: {e}"
