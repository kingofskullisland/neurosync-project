# NeuroSync

**A 3-tier local AI chat system** — React Native/Expo → Python Bridge → Ollama — with a Warhammer 40K Mechanicus aesthetic.

## Architecture

```
┌─────────────────────┐
│   Mobile Client     │  React Native / Expo
│   (Tier 1)          │  Mechanicus UI, local triage, routing
├─────────────────────┤
│   Desktop Bridge    │  Python backend (NeuroBeam P2P tunnel)
│   (Tier 2)          │  Memory management, model orchestration
├─────────────────────┤
│   Ollama Server     │  Local LLM inference (llama3.2, etc.)
│   (Tier 3)          │
└─────────────────────┘
```

## Quick Start

### Mobile Client
```bash
npm install
npx expo start
```

### Backend (Desktop)
```bash
cd backend
pip install -r requirements.txt
python -m memory.server
```

### Ollama
```bash
ollama serve
ollama pull llama3.2:latest
```

## Configuration

1. Start Ollama and the backend on your desktop
2. Open the mobile app → Settings → **Uplink Protocols**
3. Enter your desktop IP and test the connection
4. Alternatively, use **NeuroBeam** (P2P tunnel via QR code scan)

## Project Structure

```
app/              # Expo Router screens (chat, settings, history)
components/       # Reusable UI components (ChatBubble, ServoSkull, etc.)
lib/              # Core libraries (api, storage, crypto, router, theme)
hooks/            # React hooks (useWorkloadRouter)
context/          # Context providers (NoosphereContext)
backend/          # Python backend
  memory/         # Memory management system
  neurobeam/      # P2P host bridge
  test_backend.py # Backend test suite
scripts/          # Deployment scripts
```

## Environment Variables

See `backend/.env.example` for required backend configuration.

## Tech Stack

- **Frontend**: React Native, Expo SDK 54, Expo Router
- **Backend**: Python (FastAPI / ASGI)
- **AI**: Ollama (local LLM inference)
- **Encryption**: AES-256-GCM (react-native-quick-crypto / Web Crypto API)
- **Tunnel**: NeuroBeam P2P WebSocket
