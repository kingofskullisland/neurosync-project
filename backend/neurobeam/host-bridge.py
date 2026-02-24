#!/usr/bin/env python3
"""
NeuroBeam Host Bridge
Lightweight WebSocket bridge for NeuroSync mobile app → Ollama connection.
Akira-inspired P2P tunnel with AES-256-GCM encryption.
"""
import argparse
import asyncio
import base64
import hashlib
import json
import os
import secrets
import socket
from datetime import datetime
from typing import Optional

import requests
import qrcode
import websockets
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

import pc_executor
import session_manager

# ─── Configuration ──────────────────────────────────────────

BRIDGE_PORT = 8083
ANYTHING_LLM_URL = "http://localhost:3001/api/v1/workspace/neurosync-router/chat"
API_KEY = "1CCFH8V-JE24X79-GC5ZCT4-93WEN34"
SESSION_TIMEOUT = 3600  # 1 hour

# ─── CLI Arguments ──────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(description='NeuroBeam Host Bridge')
    parser.add_argument('--ip', type=str, default=None,
                        help='Override host IP (e.g., for Tailscale: 100.110.208.79)')
    parser.add_argument('--port', type=int, default=BRIDGE_PORT,
                        help=f'WebSocket port (default: {BRIDGE_PORT})')
    return parser.parse_args()

# ─── Encryption ─────────────────────────────────────────────

class BeamCrypto:
    """AES-256-GCM encryption for NeuroBeam tunnel."""
    
    def __init__(self, key: bytes):
        self.aesgcm = AESGCM(key)
    
    def encrypt(self, plaintext: str) -> dict:
        """Encrypt message and return {ciphertext, nonce}."""
        nonce = os.urandom(12)  # 96-bit nonce for GCM
        ciphertext = self.aesgcm.encrypt(nonce, plaintext.encode(), None)
        return {
            "c": base64.b64encode(ciphertext).decode(),
            "n": base64.b64encode(nonce).decode()
        }
    
    def decrypt(self, envelope: dict) -> str:
        """Decrypt {ciphertext, nonce} envelope."""
        ciphertext = base64.b64decode(envelope["c"])
        nonce = base64.b64decode(envelope["n"])
        plaintext = self.aesgcm.decrypt(nonce, ciphertext, None)
        return plaintext.decode()

# ─── Session Management ─────────────────────────────────────

class BeamSession:
    """Active NeuroBeam connection session."""
    
    def __init__(self, session_id: str, key: bytes):
        self.session_id = session_id
        self.crypto = BeamCrypto(key)
        self.created_at = datetime.now()
        self.last_ping = datetime.now()
        self.authenticated = False
    
    def is_expired(self) -> bool:
        """Check if session has timed out."""
        elapsed = (datetime.now() - self.created_at).total_seconds()
        return elapsed > SESSION_TIMEOUT

# ─── Host Bridge ────────────────────────────────────────────

class NeuroBeamBridge:
    """WebSocket server that proxies mobile requests to Ollama."""
    
    def __init__(self, host_ip: Optional[str] = None, port: int = BRIDGE_PORT):
        self.session_key = secrets.token_bytes(32)  # 256-bit key
        self.port = port
        self.session_id = secrets.token_hex(16)
        self.session: Optional[BeamSession] = None
        self.host_ip = host_ip or self._get_local_ip()
    
    def _get_local_ip(self) -> str:
        """Get local network IP address."""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "127.0.0.1"
    
    def generate_qr(self):
        """Generate and print QR code with connection params."""
        connection_data = {
            "host": self.host_ip,
            "port": self.port,
            "key": base64.b64encode(self.session_key).decode(),
            "sid": self.session_id,
            "v": 1  # Protocol version
        }
        
        qr_payload = json.dumps(connection_data)
        qr = qrcode.QRCode(version=1, box_size=2, border=2)
        qr.add_data(qr_payload)
        qr.make(fit=True)
        
        print("\n" + "="*60)
        print("  NEUROBEAM HOST BRIDGE — AKIRA PROTOCOL")
        print("="*60)
        print(f"\n  Session ID: {self.session_id}")
        print(f"  Host IP:    {self.host_ip}:{self.port}")
        print(f"  AnythingLLM: {ANYTHING_LLM_URL}")
        print(f"\n  Scan this QR code with NeuroSync mobile app:\n")
        
        qr.print_ascii(invert=True)
        
        print("\n" + "="*60)
        print("  Waiting for mobile connection...")
        print("="*60 + "\n")
    
    async def handshake(self, websocket, message: dict) -> bool:
        """Perform handshake with mobile client."""
        try:
            if message.get("type") != "handshake":
                return False
            
            if message.get("sid") != self.session_id:
                await websocket.send(json.dumps({
                    "type": "error",
                    "error": "Invalid session ID"
                }))
                return False
            
            # Create session
            self.session = BeamSession(self.session_id, self.session_key)
            self.session.authenticated = True
            
            # Send handshake confirmation
            response = self.session.crypto.encrypt(json.dumps({
                "type": "handshake_ok",
                "timestamp": datetime.now().isoformat()
            }))
            
            await websocket.send(json.dumps(response))
            
            print(f"[{datetime.now().strftime('%H:%M:%S')}] ✓ Beam locked — Mobile authenticated")
            return True
            
        except Exception as e:
            print(f"[ERROR] Handshake failed: {e}")
            return False
    def query_machine_spirit(self, prompt: str) -> dict:
        """Queries AnythingLLM for routing directives."""
        headers = {
            "Authorization": f"Bearer {API_KEY}", 
            "Content-Type": "application/json"
        }
        payload = {"message": prompt, "mode": "chat"}
        
        try:
            response = requests.post(ANYTHING_LLM_URL, headers=headers, json=payload, timeout=30)
            if response.status_code == 200:
                text = response.json().get('textResponse', '{}')
                # Sanitize in case the LLM wraps the JSON in markdown code blocks
                text = text.replace('```json', '').replace('```', '').strip()
                return json.loads(text)
            else:
                 print(f"AnythingLLM Error: {response.text}")
        except Exception as e:
            print(f"Logic fault: {e}")
            
        return {"target": "error", "action": "api_fault"}
    
    async def handle_client(self, websocket, path):
        """Handle WebSocket connection from mobile client."""
        client_ip = websocket.remote_address[0]
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Connection from {client_ip}")
        
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    
                    # Handshake phase
                    if not self.session or not self.session.authenticated:
                        if await self.handshake(websocket, data):
                            continue
                        else:
                            break
                    
                    # Decrypt incoming message
                    decrypted = self.session.crypto.decrypt(data)
                    request = json.loads(decrypted)
                    
                    msg_type = request.get("type")
                    
                    if msg_type == "ping":
                        # Heartbeat
                        self.session.last_ping = datetime.now()
                        response = {"type": "pong", "timestamp": datetime.now().isoformat()}
                    
                    elif msg_type == "user_intent":
                        intent = request.get("payload")
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] Intercepted intent: {intent}")
                        
                        # 1. Consult the Cogitator (AnythingLLM)
                        routing = self.query_machine_spirit(intent)
                        target = routing.get("target")
                        action = routing.get("action")
                        params = routing.get("params", {})
                        
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] Routing directive: {target} -> {action}")
            
                        # 2. Execute or Forward Payload
                        result = {"status": "failed"}
                        if target == "windows":
                            result = pc_executor.execute(action, params)
                        elif target == "remote":
                            if action == "ssh_command":
                                result = await session_manager.ssh_command(params.get("host"), params.get("command"))
                            elif action == "rdp_launch":
                                result = session_manager.rdp_launch(params.get("host"))
                        elif target == "android":
                            # Bounce payload to the mobile device
                            device_command = {
                                "type": "device_command",
                                "action": action,
                                "params": params
                            }
                            # Send encrypted command back down the tunnel
                            encrypted_cmd = self.session.crypto.encrypt(json.dumps(device_command))
                            await websocket.send(json.dumps(encrypted_cmd))
                            continue # Wait for Android Executor to report back via device_result or execution_result
            
                        # 3. Return local execution confirmation to UI
                        exec_result = {
                            "type": "execution_result", 
                            "target": target, 
                            "result": result
                        }
                        encrypted_exec = self.session.crypto.encrypt(json.dumps(exec_result))
                        await websocket.send(json.dumps(encrypted_exec))

                    elif msg_type == "device_result" or msg_type == "execution_result":
                         print(f"[{datetime.now().strftime('%H:%M:%S')}] Device reported result: {request}")
                         # Forward the execution result so the TerminalView UI logs it
                         encrypted_exec = self.session.crypto.encrypt(json.dumps(request))
                         await websocket.send(json.dumps(encrypted_exec))

                    else:
                        response = {"type": "error", "error": "Unknown message type"}
                        encrypted_resp = self.session.crypto.encrypt(json.dumps(response))
                        await websocket.send(json.dumps(encrypted_resp))
                
                except json.JSONDecodeError:
                    print("[ERROR] Invalid JSON received")
                except Exception as e:
                    print(f"[ERROR] Message handling failed: {e}")
        
        except websockets.exceptions.ConnectionClosed:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] ✗ Beam interrupted — Connection closed")
        finally:
            if self.session:
                self.session.authenticated = False

# ─── Main ───────────────────────────────────────────────────

async def main():
    args = parse_args()
    bridge = NeuroBeamBridge(host_ip=args.ip, port=args.port)
    bridge.generate_qr()
    
    async with websockets.serve(bridge.handle_client, "0.0.0.0", args.port):
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n[SHUTDOWN] NeuroBeam bridge terminated.\n")
