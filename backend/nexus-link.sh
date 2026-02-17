#!/bin/bash
echo "[NEXUS PROTOCOL] Purging zombie processes..."
# Kill anything on the bridge port (8082) and Ollama port (11435)
fuser -k 8082/tcp
fuser -k 11435/tcp

echo "[NEXUS PROTOCOL] Initializing Machine Spirits (Vulkan/ROCm)..."
export OLLAMA_VULKAN=1
export HSA_OVERRIDE_GFX_VERSION=10.3.0

# Ensure we are in the correct directory (the one containing 'app')
cd "$(dirname "$0")"
# If we are in 'scripts' or elsewhere, this ensure we find 'app'
if [ ! -d "app" ]; then
    # Search for app directory if not found in current dir
    if [ -d "../backend/app" ]; then
        cd ../backend
    elif [ -d "backend/app" ]; then
        cd backend
    fi
fi

# Start the bridge in the background
echo "[NEXUS PROTOCOL] Starting FastAPI Bridge..."
<<<<<<< HEAD
python3 -m uvicorn memory.server:app --host 0.0.0.0 --port 8082 --reload &
=======
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8082 --reload &
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd

# Wait a moment for bridge to init
sleep 2

# Start Ollama
echo "[NEXUS PROTOCOL] Starting Ollama (Port 11435)..."
OLLAMA_HOST=0.0.0.0:11435 ollama serve
