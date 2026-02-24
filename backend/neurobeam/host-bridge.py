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

import aiohttp
import qrcode
import websockets
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# ─── Configuration ──────────────────────────────────────────

BRIDGE_PORT = 8083
OLLAMA_URL = "http://localhost:11434"
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
        print(f"  Ollama:     {OLLAMA_URL}")
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
    
    async def proxy_to_ollama(self, request: dict) -> dict:
        """Forward request to Ollama and return response."""
        try:
            method = request.get("method", "GET")
            path = request.get("path", "/")
            body = request.get("body")
            
            url = f"{OLLAMA_URL}{path}"
            
            async with aiohttp.ClientSession() as session:
                if method == "POST":
                    async with session.post(url, json=body, timeout=aiohttp.ClientTimeout(total=120)) as resp:
                        data = await resp.json()
                        return {"status": resp.status, "data": data}
                else:
                    async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                        data = await resp.json()
                        return {"status": resp.status, "data": data}
        
        except asyncio.TimeoutError:
            return {"status": 504, "error": "Ollama timeout"}
        except Exception as e:
            return {"status": 500, "error": str(e)}
    
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
                    
                    elif msg_type == "request":
                        # Proxy to Ollama
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] → {request.get('path', '/')}")
                        ollama_response = await self.proxy_to_ollama(request)
                        response = {"type": "response", "data": ollama_response}
                    
                    else:
                        response = {"type": "error", "error": "Unknown message type"}
                    
                    # Encrypt and send response
                    encrypted = self.session.crypto.encrypt(json.dumps(response))
                    await websocket.send(json.dumps(encrypted))
                
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
