from dotenv import load_dotenv

load_dotenv()

from pi.chat import start_chat_loop

if __name__ == "__main__":
    start_chat_loop()
