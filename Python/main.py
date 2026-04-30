import argparse
from dotenv import load_dotenv

load_dotenv()

from pi.chat import start_chat_loop

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pi — AI coding assistant")
    parser.add_argument("--provider", "-p", default="gemini", help="AI provider: gemini or openai")
    parser.add_argument("--session", "-s", default="default", help="Session name (default: 'default')")
    args = parser.parse_args()
    start_chat_loop(provider=args.provider, session_name=args.session)
