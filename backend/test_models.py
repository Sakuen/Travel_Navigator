import urllib.request
import json
import os
from dotenv import load_dotenv

load_dotenv("../.env")
key = os.getenv("GOOGLE_API_KEY")

models_to_try = [
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite", 
    "gemini-2.0-flash-lite-001",
]

for model in models_to_try:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    payload = json.dumps({"contents": [{"parts": [{"text": "Say hello in one word"}]}]}).encode()
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read().decode())
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        print(f"OK {model}: {text.strip()}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:200]
        print(f"FAIL {model}: {e.code} - {body}")
    except Exception as e:
        print(f"FAIL {model}: {e}")
