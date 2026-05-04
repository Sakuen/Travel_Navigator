import os
from dotenv import load_dotenv
load_dotenv(dotenv_path="../.env")

from google import genai

client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))
for m in client.models.list():
    if "generateContent" in m.supported_actions:
        print(m.name)
