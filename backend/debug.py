import sys
import traceback
from dotenv import load_dotenv
load_dotenv("../.env")

from agent import process_chat

try:
    print("Starting debug...")
    current_state = {
        "user_dna": {"hard_nos": [], "soft_likes": [], "past_footprints": []},
        "trip_context": {"destination": None, "dates": None, "budget": None, "group_size": None, "status_flags": []},
        "is_brief_complete": False
    }
    result = process_chat("hello", current_state, [])
    print("Success:", result)
except Exception as e:
    print("Exception occurred:")
    traceback.print_exc()
