# NeuroBeam Host Bridge

Lightweight WebSocket bridge for direct P2P connection between NeuroSync mobile app and desktop Ollama instance.

## Features
- **AES-256-GCM encryption** for all traffic
- **QR code discovery** — no manual IP entry
- **Session-based auth** — rejects unauthorized connections
- **Ollama reverse proxy** — forwards requests to localhost:11434
- **Akira-themed CLI** — industrial terminal aesthetics

## Installation

```bash
cd backend/neurobeam
pip install -r requirements.txt
```

## Usage

```bash
python host-bridge.py
```

A QR code will appear in the terminal. Scan it with the NeuroSync mobile app (Settings → NeuroBeam → Scan QR).

## Architecture

```
Mobile App ←→ [WebSocket:8083] ←→ Host Bridge ←→ [HTTP:11434] ←→ Ollama
            (AES-256-GCM encrypted)
```

## Security
- 256-bit pre-shared key (generated per session)
- 96-bit nonce per message (GCM mode)
- Session timeout: 1 hour
- No cloud dependencies — fully local P2P
