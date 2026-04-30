from google.genai import types
from pi.ai.base import BaseChat, ToolCall, ToolResult, ToolDefinition
from pi.ai.client import get_client
from pi.session import Message

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
    def __init__(self, system_prompt: str, tools: list[ToolDefinition], history: list[Message], model: str | None = None):
        client = get_client()
        declarations = [
            types.FunctionDeclaration(
                name=t.name,
                description=t.description,
                parameters=_to_gemini_schema(t.parameters),
            )
            for t in tools
        ]
        # Gemini uses "model" for assistant role
        role_map = {"user": "user", "assistant": "model"}
        gemini_history = [
            types.Content(
                role=role_map.get(msg.role, msg.role),
                parts=[types.Part.from_text(text=msg.content)],
            )
            for msg in history
        ]
        self._chat = client.chats.create(
            model=model or MODEL,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                tools=[types.Tool(function_declarations=declarations)] if declarations else [],
            ),
            history=gemini_history,
        )

    def send_stream(self, message: str):
        tool_calls = []
        for chunk in self._chat.send_message_stream(message):
            if chunk.text:
                yield chunk.text
            if chunk.function_calls:
                for fc in chunk.function_calls:
                    tool_calls.append(
                        ToolCall(name=fc.name, args=dict(fc.args), id=getattr(fc, "id", ""))
                    )
        if tool_calls:
            yield tool_calls

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
