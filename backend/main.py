"""
NeuroSync Backend — main.py
Headless Tethering Server (No Desktop GUI Required)

Run:
    uvicorn backend.main:app --host 0.0.0.0 --port 8000

On startup, prints a QR code to the terminal.
Scan it with the NeuroSync mobile app to tether.
"""

import os
import io
import json
import time
import uuid
import hmac
import hashlib
import base64
import socket
import logging
from contextlib import asynccontextmanager

import qrcode
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel

# ─── Configuration ────────────────────────────────────────────────
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11435")
SERVER_SECRET_KEY = os.getenv("BEAM_SECRET", "super_secret_key_change_this_in_prod").encode()
QR_EXPIRATION_SECONDS = 300  # 5 minutes
DEFAULT_MODEL = "llama3.2:3b"
TETHER_TOKEN = str(uuid.uuid4())[:16]

logger = logging.getLogger("neurosync")

# ─── Helpers ──────────────────────────────────────────────────────

def get_local_ip() -> str:
    """Detect the machine's LAN IP address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip


def generate_tether_qr():
    """Print the tethering QR code to the terminal on startup."""
    ip = get_local_ip()
    host = f"http://{ip}:8000"

    payload_data = {
        "action": "tether",
        "context": {
            "host": host,
            "token": TETHER_TOKEN,
            "agent": DEFAULT_MODEL,
        },
        "ts": int(time.time()),
        "exp": QR_EXPIRATION_SECONDS,
    }

    json_str = json.dumps(payload_data, separators=(",", ":"))
    encoded_payload = base64.urlsafe_b64encode(json_str.encode()).decode()

    signature = hmac.new(
        SERVER_SECRET_KEY,
        encoded_payload.encode(),
        hashlib.sha256,
    ).hexdigest()

    deep_link = f"noosphere://beam?p={encoded_payload}&sig={signature}"

    # Print QR to terminal
    print("\n" + "=" * 50)
    print("⚡  NOOSPHERE HEADLESS TETHER  ⚡")
    print("=" * 50)

    qr = qrcode.QRCode(border=2, box_size=1)
    qr.add_data(deep_link)
    qr.print_ascii(invert=True)

    print(f"\n  Host:  {host}")
    print(f"  Token: {TETHER_TOKEN}")
    print(f"  Model: {DEFAULT_MODEL}")
    print(f"  Valid: {QR_EXPIRATION_SECONDS}s")
    print("\n  Scan this with your phone to tether.")
    print("=" * 50 + "\n")


# ─── Lifespan ─────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    generate_tether_qr()
    yield


# ─── App ──────────────────────────────────────────────────────────

app = FastAPI(title="NeuroSync Backend", lifespan=lifespan)


# ─── Models ───────────────────────────────────────────────────────

class BeamVerifyRequest(BaseModel):
    payload: str       # Base64-encoded JSON from QR
    signature: str     # HMAC signature from QR


class TetherChatRequest(BaseModel):
    model: str = DEFAULT_MODEL
    messages: list


# ─── Endpoints ────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Health check — also pings Ollama to verify it's alive."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags")
            ollama_status = "connected" if r.status_code == 200 else "error"
    except Exception:
        ollama_status = "offline"

    return {"status": "online", "ollama": ollama_status, "bridge": "online"}


@app.post("/beam/verify")
async def verify_beam(request: BeamVerifyRequest):
    """
    Verify the HMAC signature of a scanned QR code.
    Returns the trusted payload if valid.
    """
    try:
        # Re-calculate signature
        expected = hmac.new(
            SERVER_SECRET_KEY,
            request.payload.encode(),
            hashlib.sha256,
        ).hexdigest()

        # Timing-safe comparison
        if not hmac.compare_digest(expected, request.signature):
            raise HTTPException(status_code=403, detail="Invalid QR Code Signature")

        # Decode the payload
        decoded = json.loads(base64.urlsafe_b64decode(request.payload))

        # Check expiration
        ts = decoded.get("ts", 0)
        exp = decoded.get("exp", QR_EXPIRATION_SECONDS)
        if int(time.time()) - ts > exp:
            raise HTTPException(status_code=400, detail="QR Code Expired")

        return {
            "status": "verified",
            "action": decoded.get("action"),
            "context": decoded.get("context"),
        }

    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="Corrupt Data Payload")


@app.get("/beam/generate")
async def generate_beam_qr(
    action: str = "switch_agent",
    agent: str = DEFAULT_MODEL,
):
    """
    Generate a signed QR code as a PNG image.
    Used by a future desktop UI or for manual testing.
    """
    payload_data = {
        "action": action,
        "context": {"agent": agent},
        "ts": int(time.time()),
        "exp": QR_EXPIRATION_SECONDS,
    }

    json_str = json.dumps(payload_data, separators=(",", ":"))
    encoded = base64.urlsafe_b64encode(json_str.encode()).decode()

    sig = hmac.new(SERVER_SECRET_KEY, encoded.encode(), hashlib.sha256).hexdigest()
    deep_link = f"noosphere://beam?p={encoded}&sig={sig}"

    # Generate PNG in memory
    qr = qrcode.QRCode(box_size=10, border=4)
    qr.add_data(deep_link)
    qr.make(fit=True)

    img_buffer = io.BytesIO()
    img = qr.make_image(fill_color="#2A0A48", back_color="white")
    img.save(img_buffer, format="PNG")

    return Response(content=img_buffer.getvalue(), media_type="image/png")


@app.post("/api/tether/chat")
async def tether_chat(request: TetherChatRequest, req: Request):
    """
    The mobile app sends chat messages here when tethered.
    We proxy to Ollama and return the response.
    """
    # Verify bearer token
    auth = req.headers.get("Authorization", "")
    if not auth.endswith(TETHER_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid tether token")

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": request.model,
                    "messages": request.messages,
                    "stream": False,
                },
            )

            if r.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"Ollama returned {r.status_code}: {r.text[:200]}",
                )

            return r.json()

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Ollama inference timed out")
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail=f"Cannot reach Ollama at {OLLAMA_URL}. Is it running?",
        )
