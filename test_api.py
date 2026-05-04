import urllib.request
import json

url = "http://127.0.0.1:8000/api/chat"
data = {
    "message": "test",
    "current_state": {
        "user_dna": {"hard_nos": [], "soft_likes": [], "past_footprints": []},
        "trip_context": {"destination": None, "dates": None, "budget": None, "group_size": None, "status_flags": []},
        "is_brief_complete": False
    },
    "chat_history": []
}

req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as response:
        print("Success:")
        print(response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}:")
    print(e.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
