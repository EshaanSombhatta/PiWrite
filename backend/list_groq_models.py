import os
import requests

api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    # Try to read from .env manually if not in env
    try:
        with open(".env", "r") as f:
            for line in f:
                if line.startswith("GROQ_API_KEY"):
                    api_key = line.split("=")[1].strip().strip('"')
    except:
        pass

if not api_key:
    print("No Groq API key found")
    exit(1)

url = "https://api.groq.com/openai/v1/models"
headers = {"Authorization": f"Bearer {api_key}"}

try:
    resp = requests.get(url, headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        print("Available Models:")
        for m in data['data']:
            print(f"- {m['id']}")
    else:
        print(f"Error: {resp.status_code} - {resp.text}")
except Exception as e:
    print(e)
