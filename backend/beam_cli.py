#!/usr/bin/env python3
"""
beam_cli.py — Standalone QR Generator for Noosphere Tethering

Run this in your terminal:
    python backend/beam_cli.py

It prints a QR code that your phone can scan to tether to this machine.
Does NOT start a server — use alongside `uvicorn backend.main:app`.
"""

import json
import time
import uuid
import hmac
import hashlib
import base64
import socket

import qrcode


# ─── Config ───────────────────────────────────────────────────────
SERVER_SECRET_KEY = b"super_secret_key_change_this_in_prod"
DEFAULT_MODEL = "llama3.2:3b"
SERVER_PORT = 8000
QR_VALIDITY_SECONDS = 300


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


def generate_tether():
    ip = get_local_ip()
    token = str(uuid.uuid4())[:16]
    host = f"http://{ip}:{SERVER_PORT}"

    # Build payload
    payload = {
        "action": "tether",
        "context": {
            "host": host,
            "token": token,
            "agent": DEFAULT_MODEL,
        },
        "ts": int(time.time()),
        "exp": QR_VALIDITY_SECONDS,
    }

    # Encode + Sign
    json_str = json.dumps(payload, separators=(",", ":"))
    b64_payload = base64.urlsafe_b64encode(json_str.encode()).decode()

    signature = hmac.new(
        SERVER_SECRET_KEY,
        b64_payload.encode(),
        hashlib.sha256,
    ).hexdigest()

    deep_link = f"noosphere://beam?p={b64_payload}&sig={signature}"

    # Output
    print("\n" + "=" * 50)
    print("⚡  NOOSPHERE BEAM CLI  ⚡")
    print("=" * 50)

    qr = qrcode.QRCode(border=2, box_size=1)
    qr.add_data(deep_link)
    qr.print_ascii(invert=True)

    print(f"\n  Host:    {host}")
    print(f"  Token:   {token}")
    print(f"  Model:   {DEFAULT_MODEL}")
    print(f"  Expires: {QR_VALIDITY_SECONDS}s")
    print("\n  Scan this to tether your mobile app.")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    generate_tether()
