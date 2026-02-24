
import requests
import json
import time

BASE_URL = "http://localhost:8082"

def test_models():
    print("\n--- Testing GET /models ---")
    try:
        resp = requests.get(f"{BASE_URL}/models", timeout=5)
        print(f"Status: {resp.status_code}")
        try:
            data = resp.json()
            print(json.dumps(data, indent=2))
        except:
            print("Response:", resp.text)
    except Exception as e:
        print(f"Error: {e}")

def test_chat():
    print("\n--- Testing POST /chat (OVERSEER) ---")
    payload_simple = {"prompt": "System status report.", "model": "llama3.2:3b"}
    try:
        r = requests.post(f"{BASE_URL}/chat", json=payload_simple)
        print(f"Status: {r.status_code}")
        print(f"Response Length: {len(r.text)}")
        if "Processing sigh" in r.text or "servo-whir" in r.text:
            print("Persona: HADRON OVERSEER (Confirmed)")
        else:
            print(f"Persona: UNKNOWN/MISSING (Snippet: {r.text[:50]}...)")
    except Exception as e:
        print(f"Error: {e}")

    print("\n--- Testing POST /chat (SERVITOR) ---")
    payload_complex = {"prompt": "Write a short creative story about a robot learning to love.", "model": "llama3.2:3b"}
    try:
        r = requests.post(f"{BASE_URL}/chat", json=payload_complex)
        print(f"Status: {r.status_code}")
        print(f"Response Length: {len(r.text)}")
        if "Delegating to Servitor" in r.text:
            print("Routing: DELEGATED TO SERVITOR (Confirmed)")
        else:
            print(f"Routing: FAILED/DIRECT (Snippet: {r.text[:50]}...)")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_models()
    test_chat()
