import json
import os
from dataclasses import dataclass
from datetime import datetime


@dataclass
class Message:
    role: str  # "user" or "assistant"
    content: str
    timestamp: str = ""


def load(path: str) -> list[Message]:
    if not os.path.exists(path):
        return []
    messages = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                data = json.loads(line)
                messages.append(Message(**data))
    return messages


def append(path: str, role: str, content: str) -> None:
    entry = {
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat(),
    }
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
