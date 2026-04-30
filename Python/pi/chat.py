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

        response = chat.send_message(user_input)
        print(f"\nGemini: {response.text}\n")
