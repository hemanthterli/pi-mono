from google.genai import types
from pi.ai.base import BaseChat, ToolCall, ToolResult, ToolDefinition
from pi.ai.client import get_client

MODEL = "gemini-3-flash-preview"


def _to_gemini_schema(schema: dict) -> types.Schema:
    type_map = {
        "string": types.Type.STRING,
        "integer": types.Type.INTEGER,
        "number": types.Type.NUMBER,
        "boolean": types.Type.BOOLEAN,
        "array": types.Type.ARRAY,
        "object": types.Type.OBJECT,
    }
    gemini_type = type_map.get(schema.get("type", "string"), types.Type.STRING)
    properties = {
        k: _to_gemini_schema(v)
        for k, v in schema.get("properties", {}).items()
    }
    return types.Schema(
        type=gemini_type,
        description=schema.get("description", ""),
        properties=properties or None,
        required=schema.get("required"),
    )


class GeminiChat(BaseChat):
    def __init__(self, system_prompt: str, tools: list[ToolDefinition]):
        client = get_client()
        declarations = [
            types.FunctionDeclaration(
                name=t.name,
                description=t.description,
                parameters=_to_gemini_schema(t.parameters),
            )
            for t in tools
        ]
        self._chat = client.chats.create(
            model=MODEL,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                tools=[types.Tool(function_declarations=declarations)] if declarations else [],
            ),
        )

    def send(self, message: str | list[ToolResult]) -> tuple[str, list[ToolCall]]:
        if isinstance(message, str):
            response = self._chat.send_message(message)
        else:
            parts = [
                types.Part.from_function_response(
                    name=r.name,
                    response={"output": r.output},
                )
                for r in message
            ]
            response = self._chat.send_message(parts)

        tool_calls = [
            ToolCall(name=fc.name, args=dict(fc.args), id=getattr(fc, "id", ""))
            for fc in (response.function_calls or [])
        ]
        return response.text or "", tool_calls
