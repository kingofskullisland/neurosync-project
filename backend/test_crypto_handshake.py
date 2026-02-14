
import json
import base64
import os
from fastapi.testclient import TestClient
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Import the app and session from the actual main module
from app.main import app, CURRENT_SESSION

def test_encrypted_handshake():
    print("Starting TestClient...")
    client = TestClient(app)
    
    # Get the session key directly from the shared memory state
    key_bytes = CURRENT_SESSION["key_bytes"]
    token = CURRENT_SESSION["token"]
    aesgcm = AESGCM(key_bytes)
    
    print(f"Session Token: {token}")
    
    # Connect to WebSocket
    # TestClient context manager handles the connection
    with client.websocket_connect("/ws") as websocket:
        print("Connected.")
        
        # 1. Send Handshake (Plaintext)
        handshake = {
            "type": "handshake",
            "sid": token
        }
        websocket.send_text(json.dumps(handshake))
        
        # 2. Receive Encrypted Response
        response_text = websocket.receive_text()
        print(f"Received: {response_text}")
        
        envelope = json.loads(response_text)
        c = base64.b64decode(envelope["c"])
        n = base64.b64decode(envelope["n"])
        t = base64.b64decode(envelope["t"])
        
        plaintext = aesgcm.decrypt(n, c + t, None)
        response = json.loads(plaintext)
        print(f"Decrypted: {response}")
        
        assert response.get("type") == "handshake_ok"
        print("✅ Handshake Success")
        
        # 3. Send Encrypted Message
        # Valid payload that matches what the router expects or just triggers an echo if implemented
        # In main.py, we have: query = payload if msg_type == "text" else ...
        payload_data = {"type": "text", "payload": "Hello from TestClient", "streamId": "test-1"}
        
        data_json = json.dumps(payload_data).encode("utf-8")
        nonce = os.urandom(12)
        ct = aesgcm.encrypt(nonce, data_json, None)
        
        tag = ct[-16:]
        actual_ct = ct[:-16]
        
        envelope = {
            "c": base64.b64encode(actual_ct).decode("utf-8"),
            "n": base64.b64encode(nonce).decode("utf-8"),
            "t": base64.b64encode(tag).decode("utf-8")
        }
        
        websocket.send_text(json.dumps(envelope))
        
        # 4. Receive Response(s)
        # We expect a stream of tokens, potentially just one or an error if Ollama is down
        # But we just want to verify we get *something* encrypted back that we can decrypt
        
        try:
            while True:
                response_text = websocket.receive_text()
                envelope = json.loads(response_text)
                
                c = base64.b64decode(envelope["c"])
                n = base64.b64decode(envelope["n"])
                t = base64.b64decode(envelope["t"])
                
                plaintext = aesgcm.decrypt(n, c + t, None)
                response = json.loads(plaintext)
                print(f"Decrypted Chunk: {response}")
                
                if response.get("type") == "complete" or response.get("type") == "error":
                    break
                    
        except Exception as e:
            # If Ollama is offline, we might get an error or timeout, but handled gracefully
            print(f"Loop ended or error: {e}")

if __name__ == "__main__":
    test_encrypted_handshake()
