from pi.ai.client import get_client

MODEL = "gemini-3-flash-preview"


def start_chat_loop() -> None:
    client = get_client()
    chat = client.chats.create(model=MODEL)

    print("Pi — chat started. Type 'exit' to quit.\n")

    while True:
        user_input = input("You: ").strip()

        if user_input.lower() in ("exit", "quit"):
            print("Goodbye!")
            break

        if not user_input:
            continue

        print("\nGemini: ", end="", flush=True)
        for chunk in chat.send_message_stream(user_input):
            print(chunk.text, end="", flush=True)
        print("\n")
