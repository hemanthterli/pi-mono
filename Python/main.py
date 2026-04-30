import sys
from dotenv import load_dotenv

load_dotenv()

from pi.chat import start_chat_loop

if __name__ == "__main__":
    provider = sys.argv[1] if len(sys.argv) > 1 else "gemini"
    start_chat_loop(provider)
