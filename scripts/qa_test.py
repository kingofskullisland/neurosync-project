import requests
import sys
import time

BASE_URL = "http://localhost:8082"
RED = "\033[91m"
GREEN = "\033[92m"
RESET = "\033[0m"

def log(msg, status="INFO"):
    color = GREEN if status == "PASS" else RED if status == "FAIL" else RESET
    print(f"[{color}{status}{RESET}] {msg}")

def check_backend_up():
    print("--- Checking Backend Availability ---")
    retries = 5
    for i in range(retries):
        try:
            requests.get(f"{BASE_URL}/health", timeout=1)
            log("Backend is UP", "PASS")
            return True
        except requests.exceptions.ConnectionError:
            log(f"Backend unreachable (Attempt {i+1}/{retries})...", "WARN")
            time.sleep(1)
    log("Backend failed to start", "FAIL")
    return False

def test_health():
    print("\n--- Test Case 1: GET /health ---")
    try:
        r = requests.get(f"{BASE_URL}/health")
        if r.status_code == 200:
            data = r.json()
            if "status" in data and "ollama" in data:
                log(f"Health check passed: {data}", "PASS")
            else:
                log(f"Invalid health response schema: {data}", "FAIL")
        else:
            log(f"Health check failed with {r.status_code}", "FAIL")
    except Exception as e:
        log(f"Exception: {e}", "FAIL")

def test_chat_structure():
    print("\n--- Test Case 2: POST /chat (Structure) ---")
    payload = {"prompt": "Hello", "model": "test-model"}
    try:
        # We expect a 503 or 500 if Ollama is down, but the JSON structure of the error is important
        r = requests.post(f"{BASE_URL}/chat", json=payload)
        log(f"Received status: {r.status_code}", "INFO")
        
        # Even error responses should be JSON
        try:
            data = r.json()
            log(f"Response is valid JSON: {data}", "PASS")
        except:
            log(f"Response was not JSON: {r.text}", "FAIL")
            
    except Exception as e:
        log(f"Exception: {e}", "FAIL")

def main():
    if not check_backend_up():
        sys.exit(1)
    
    test_health()
    test_chat_structure()
    print("\nQA Test Complete.")

if __name__ == "__main__":
    main()
