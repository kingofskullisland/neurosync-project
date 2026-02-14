"""
NeuroSync Router - FastAPI Application
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import json
import logging
import httpx
import os
import base64
import socket
import time
import uuid
import qrcode
import io
from fastapi import Request
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


from .core.config import settings
from .core.router import router as ai_router, RouteTarget
from .core.scorer import scorer
from .core.prompts import get_system_prompt, Persona
from .schemas.responses import ChatRequest, ChatResponse, HealthResponse, ModelListResponse
from .schemas.requests import BeamRequest
from .utils.qr_generator import generate_beam_matrix

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Configuration ---
# This acts as our "Session Store" for now
# --- Configuration ---
# This acts as our "Session Store" for now
# Generate a strong 32-byte key for AES-256-GCM
# We store it as base64 to easily pass it in the QR code
session_key_bytes = os.urandom(32)
CURRENT_SESSION = {
    "token": base64.urlsafe_b64encode(session_key_bytes).decode('utf-8'),
    "key_bytes": session_key_bytes,
    "host_ip": "127.0.0.1"
}


def get_local_ip():
    """Detects the machine's actual LAN IP address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Connect to a public DNS server (doesn't send data)
        s.connect(('8.8.8.8', 80))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

def print_terminal_qr(url):
    """Generates ASCII QR code in the terminal."""
    qr = qrcode.QRCode()
    qr.add_data(url)
    print("\n" + "="*40)
    print("⚡  NOOSPHERE BEAM ACTIVE  ⚡")
    print("="*40)
    # invert=True helps on dark terminal backgrounds
    qr.print_ascii(invert=True)
    print(f"Token: {CURRENT_SESSION['token']}")
    print(f"Link:  {url}")
    print("="*40 + "\n")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown events"""
    logger.info("NeuroSync Router starting...")
    backends = await ai_router.check_backends()
    logger.info(f"Backend status: {backends}")
    
    # 1. Detect IP and Update Session
    ip = get_local_ip()
    CURRENT_SESSION["host_ip"] = ip
    
    # 2. Construct the Deep Link
    # Schema: noosphere://beam?mode=tether&host=...&token=...
    payload = {
        "mode": "tether",
        "host": f"http://{ip}:8000",
        "token": CURRENT_SESSION["token"],
        "agent": "llama3.2:latest"
    }
    
    # Sign payload (Mock signature for now)
    json_str = json.dumps(payload)
    b64_payload = base64.urlsafe_b64encode(json_str.encode()).decode()
    deep_link = f"noosphere://beam?p={b64_payload}&sig=cli_generated"
    
    # 3. Print QR to Console
    print_terminal_qr(deep_link)
    
    yield
    logger.info("NeuroSync Router shutting down...")





app = FastAPI(
    title="NeuroSync Router",
    description="Tier 2 — Intelligent AI Request Router",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    # Restrict origins to Localhost and Private Networks (RFC 1918)
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/tether/chat")
async def tether_chat(request: ChatRequest, req: Request):
    # 1. Security Check
    auth_header = req.headers.get("Authorization")
    if not auth_header or CURRENT_SESSION["token"] not in auth_header:
        raise HTTPException(status_code=403, detail="Invalid Session Token")

    # 2. Forward to Local Ollama
    try:
        # Note: Using settings.OLLAMA_URL which we set to port 11435
        base_url = settings.OLLAMA_URL.rstrip('/')
        
        # Construct payload compatible with Ollama
        payload = {
            "model": request.model,
            "messages": request.messages,
            "stream": False # Keep it simple
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            ollama_response = await client.post(
                f"{base_url}/api/chat",
                json=payload
            )
            return ollama_response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ollama Error: {str(e)}")


# =============================================================================
# MODELS
# =============================================================================

# Models imported from schemas




# =============================================================================
# REST ENDPOINTS
# =============================================================================

@app.get("/health")
async def health():
    """Health check with backend status"""
    ollama_url = os.getenv("OLLAMA_BASE_URL", settings.OLLAMA_URL)
    ollama_status = "offline"
    
    try:
        # Ping /api/tags because it's lightweight and proves Ollama is up
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{ollama_url}/api/tags")
            if resp.status_code == 200:
                ollama_status = "online"
    except:
        pass  # Status remains offline

    return {
        "status": "online",
        "system": "NEUROSYNC_ROUTER",
        "ollama": "connected" if ollama_status == "online" else "unreachable",
        "bridge": "online"
    }


@app.get("/models")
async def list_models():
    """List available Ollama models"""
    ollama_url = os.getenv("OLLAMA_BASE_URL", settings.OLLAMA_URL)
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Proxy to Ollama /api/tags
            response = await client.get(f"{ollama_url}/api/tags")
            
            if response.status_code == 200:
                data = response.json()
                data = response.json()
                # Pass through the full model objects as expected by mobile app
                return {"models": data.get("models", [])}
            else:
                logger.error(f"Ollama /api/tags returned {response.status_code}")
                return {"error": f"Ollama returned {response.status_code}", "models": []}
                
    except Exception as e:
        logger.error(f"Failed to fetch models: {e}")
        return {"error": str(e), "models": []}


@app.post("/beam")
async def generate_beam_qr(request: BeamRequest):
    """
    Generate a Noosphere Beam QR Code.
    Returns a PNG image directly.
    """
    qr_stream = generate_beam_matrix(
        action=request.action.value,
        target_id=request.target_id,
        payload=request.payload,
        token=request.token,
        expiration=request.expiration
    )
    return Response(content=qr_stream.getvalue(), media_type="image/png")




@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    # Fix for the AttributeError: Ensure decision is handled as a value
    # Calculate complexity using the scorer directly or via router helper
    # We'll use the router's logic to get a decision first
    
    decision = await ai_router.route(
        query=request.prompt,
        has_image=bool(request.image),
        has_screen=bool(request.screen),
        image_data=request.image
    )
    
    decision_score = decision.complexity # It's a float
    
    # Injected System Prompt for Hadron
    system_prompt_obj = get_system_prompt(Persona.HADRON)
    system_prompt = system_prompt_obj.prompt.format(system_state="Status: Nominal") # Basic formatting to avoid error if {system_state} is present
    
    payload = {
        "model": "llama3.2:latest",  # Strictly use the verified tag
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.prompt}
        ],
        "stream": False,
        "options": {
            "temperature": 0.4,
            "max_tokens": 150
        }
    }

    try:
        # Note: Using settings.OLLAMA_URL which we set to port 11435
        # Ensure we don't have double slash issues
        base_url = settings.OLLAMA_URL.rstrip('/')
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{base_url}/api/chat", 
                json=payload
            )
            
        if response.status_code == 200:
            data = response.json()
            # Mapping the correct Ollama key: ['message']['content']
            ai_text = data.get('message', {}).get('content', "Err: Empty buffer.")
            
            return ChatResponse(
                response=ai_text,
                persona="HADRON",
                routing="LOCAL",
                model_used="llama3.2:latest",
                complexity_score=decision_score
            )
        else:
             return ChatResponse(
                response=f"[COMM-FAILURE] Ollama returned {response.status_code}",
                persona="ERROR",
                routing="NONE",
                model_used="none",
                complexity_score=decision_score
            )

    except Exception as e:
        logger.error(f"Chat Error: {e}")
        return ChatResponse(
            response=f"[COMM-FAILURE] {str(e)}",
            persona="ERROR",
            routing="NONE",
            model_used="none",
            complexity_score=0.0
        )



@app.get("/score")
async def score_query(query: str):
    """Debug endpoint: score a query without executing"""
    result = scorer.score(query)
    return {
        "score": result.score,
        "factors": result.factors,
        "recommendation": result.recommendation,
    }


# =============================================================================
# WEBSOCKET (STREAMING)
# =============================================================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for streaming AI responses.
    
    Client sends:
    {
        "type": "text" | "voice" | "image" | "screen",
        "payload": "...",
        "streamId": "...",
        "context": {"battery": 85, "screen": "..."}
    }
    
    Server sends:
    {
        "type": "token" | "complete" | "error",
        "content": "...",
        "route": "LOCAL" | "GEMINI" | "CLAUDE" | "OLLAMA",
        "streamId": "..."
    }
    """
    await websocket.accept()
    logger.info("WebSocket client connected")
    
    # Instantiate AES-GCM with the session key
    # In a real app, we'd lookup the key based on the 'sid' from the handshake
    aesgcm = AESGCM(CURRENT_SESSION["key_bytes"])

    try:
        while True:
            # 1. Receive raw (encrypted) data
            data = await websocket.receive_text()
            message_json = json.loads(data)

            # 2. Handle Handshake (Unencrypted)
            if message_json.get("type") == "handshake":
                sid = message_json.get("sid")
                if sid == CURRENT_SESSION["token"]:
                    # Create encrypted response
                    response_payload = json.dumps({"type": "handshake_ok"}).encode('utf-8')
                    nonce = os.urandom(12)
                    ciphertext = aesgcm.encrypt(nonce, response_payload, None)
                    
                    # Send back {c, n, t} envelope (tag is appended to ciphertext in Python's AESGCM)
                    # Python's encrypt returns ciphertext + tag. 
                    # We need to split it if the client expects separate fields, 
                    # BUT looking at typical libs, they often handle concatenated.
                    # Let's verify client expectation: import QuickCrypto from 'react-native-quick-crypto';
                    # Client decrypt: 
                    # const iv = Buffer.from(envelope.n, 'base64');
                    # const tag = Buffer.from(envelope.t, 'base64');
                    # decipher.setAuthTag(tag);
                    
                    # So client EXPECTS separate tag.
                    # PyCA cryptography appends tag to ciphertext.
                    # tag is last 16 bytes.
                    
                    full_ct = ciphertext
                    tag = full_ct[-16:]
                    actual_ct = full_ct[:-16]
                    
                    envelope = {
                        "c": base64.b64encode(actual_ct).decode('utf-8'),
                        "n": base64.b64encode(nonce).decode('utf-8'),
                        "t": base64.b64encode(tag).decode('utf-8')
                    }
                    await websocket.send_text(json.dumps(envelope))
                else:
                    await websocket.close(code=4003)
                    return
                continue

            # 3. Handle Encrypted Messages
            # Expecting envelope: { c, n, t }
            try:
                c_bytes = base64.b64decode(message_json.get("c", ""))
                n_bytes = base64.b64decode(message_json.get("n", ""))
                t_bytes = base64.b64decode(message_json.get("t", ""))
                
                # Reconstruct for PyCA: ciphertext + tag
                full_ciphertext = c_bytes + t_bytes
                
                plaintext_bytes = aesgcm.decrypt(n_bytes, full_ciphertext, None)
                plaintext = plaintext_bytes.decode('utf-8')
                
                message = json.loads(plaintext)
                
            except Exception as e:
                logger.error(f"Decryption failed: {e}")
                continue

            # Process Message
            msg_type = message.get("type", "text")
            payload = message.get("payload", "")
            stream_id = message.get("streamId", "default")
            
            # ... process message ...
            # For now, let's just echo back a simple response to verify the loop
            # Real routing logic would go here
            
            # Route the request
            # Determine content type
            has_image = msg_type == "image"
            has_screen = msg_type == "screen"
            image_data = payload if (has_image or has_screen) else None
            query = payload if msg_type == "text" else "Analyze this image"
            
            decision = await ai_router.route(
                query=query,
                has_image=has_image,
                has_screen=has_screen,
                image_data=image_data,
            )
            
            logger.info(f"Routing to {decision.target.value}: {decision.reason}")
            
            # Stream response
            async for chunk in ai_router.execute(query, decision, image_data):
                response_data = {
                    "type": "complete" if chunk.done else "token",
                    "content": chunk.content,
                    "route": chunk.route.value,
                    "streamId": stream_id,
                }
                
                # Encrypt response
                resp_json = json.dumps(response_data).encode('utf-8')
                nonce = os.urandom(12)
                ct = aesgcm.encrypt(nonce, resp_json, None)
                
                tag = ct[-16:]
                actual_ct = ct[:-16]
                
                envelope = {
                    "c": base64.b64encode(actual_ct).decode('utf-8'),
                    "n": base64.b64encode(nonce).decode('utf-8'),
                    "t": base64.b64encode(tag).decode('utf-8')
                }
                await websocket.send_text(json.dumps(envelope))
    
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")



# =============================================================================
# ENTRYPOINT
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
