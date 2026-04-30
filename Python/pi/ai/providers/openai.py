import json
import os
from openai import OpenAI
from pi.ai.base import BaseChat, ToolCall, ToolResult, ToolDefinition
from pi.session import Message

MODEL = "gpt-4o-mini"


class OpenAIChat(BaseChat):
    def __init__(self, system_prompt: str, tools: list[ToolDefinition], history: list[Message]):
        self._client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self._model = MODEL
        self._tools = [
            {
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.parameters,
                },
            }
            for t in tools
        ]
        self._messages: list[dict] = [{"role": "system", "content": system_prompt}]
        for msg in history:
            self._messages.append({"role": msg.role, "content": msg.content})

    def send(self, message: str | list[ToolResult]) -> tuple[str, list[ToolCall]]:
        if isinstance(message, str):
            self._messages.append({"role": "user", "content": message})
        else:
            for r in message:
                self._messages.append({
                    "role": "tool",
                    "tool_call_id": r.id,
                    "content": r.output,
                })

        response = self._client.chat.completions.create(
            model=self._model,
            messages=self._messages,
            tools=self._tools or None,
        )

        msg = response.choices[0].message
        self._messages.append(msg)

        tool_calls = []
        if msg.tool_calls:
            tool_calls = [
                ToolCall(
                    name=tc.function.name,
                    args=json.loads(tc.function.arguments),
                    id=tc.id,
                )
                for tc in msg.tool_calls
            ]

        return msg.content or "", tool_calls
