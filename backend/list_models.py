import os
import urllib.request
import json
from dotenv import load_dotenv

load_dotenv("../.env")
api_key = os.getenv("GOOGLE_API_KEY")
url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"

req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    for model in data.get("models", []):
        if "generateContent" in model.get("supportedGenerationMethods", []):
            print(model["name"])
