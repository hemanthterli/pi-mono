from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ToolDefinition:
    name: str
    description: str
    parameters: dict[str, Any]  # JSON Schema


@dataclass
class ToolCall:
    name: str
    args: dict[str, Any]
    id: str = ""


@dataclass
class ToolResult:
    name: str
    output: str
    id: str = ""


class BaseChat(ABC):
    @abstractmethod
    def send(self, message: str | list[ToolResult]) -> tuple[str, list[ToolCall]]:
        """Send a user message or tool results. Returns (text, tool_calls)."""
        ...
