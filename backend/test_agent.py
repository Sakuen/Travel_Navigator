import os
import sys
sys.path.append(os.path.dirname(__file__))
from dotenv import load_dotenv

load_dotenv(dotenv_path="../.env")
print("GOOGLE_API_KEY:", bool(os.environ.get("GOOGLE_API_KEY")))

try:
    from agent import process_chat
    print(process_chat("hello", {}))
except Exception as e:
    import traceback
    traceback.print_exc()
