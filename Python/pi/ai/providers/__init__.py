from pi.ai.base import BaseChat, ToolDefinition


def get_chat(provider: str, system_prompt: str, tools: list[ToolDefinition]) -> BaseChat:
    if provider == "gemini":
        from pi.ai.providers.gemini import GeminiChat
        return GeminiChat(system_prompt, tools)
    if provider == "openai":
        from pi.ai.providers.openai import OpenAIChat
        return OpenAIChat(system_prompt, tools)
    raise ValueError(f"Unknown provider: {provider!r}. Choose 'gemini' or 'openai'.")
