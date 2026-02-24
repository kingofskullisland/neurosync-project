#!/bin/bash

# Ultra-fast startup script for NeuroSync
echo "🔮 Initializing NeuroSync..."

# 1. Start Ollama if not running
if ! pgrep -x "ollama" > /dev/null; then
    echo "🧠 Starting Ollama..."
    ollama serve > ollama.log 2>&1 &
    # Wait for Ollama to be ready
    echo "   → Waiting for Ollama API..."
    until curl -s http://localhost:11434/api/tags > /dev/null; do
        sleep 1
    done
    echo "   → Ollama online."
else
    echo "🧠 Ollama already running."
fi

# 2. Start Backend
echo "🔗 Starting Memory Bridge..."
cd backend
# Check if venv exists (optional, assuming system python for now based on user context)
# No venv found in file listing, using python3 directly
nohup python3 -m memory.server > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "   → Backend running (PID: $BACKEND_PID)"
cd ..

# 3. Start Expo
echo "📱 Starting Expo..."
echo "   → Press 'w' for web, 'a' for Android in the Expo menu"
npx expo start --clear

# Cleanup on exit
kill $BACKEND_PID
