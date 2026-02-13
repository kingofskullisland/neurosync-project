#!/bin/bash

# Configuration script for Ollama (Systemd)
# Goal: Allow external connections (0.0.0.0)

echo "🔧 Configuring Ollama for External Access..."
echo "Authenticated execution required (entering sudo mode)..."

# Ensure override directory exists
sudo mkdir -p /etc/systemd/system/ollama.service.d

# Create override file
echo "📝 Creating systemd override..."
echo "[Service]
Environment=\"OLLAMA_HOST=0.0.0.0\"
Environment=\"OLLAMA_ORIGINS=*\"" | sudo tee /etc/systemd/system/ollama.service.d/override.conf > /dev/null

# Reload and restart
echo "🔄 Reloading systemd..."
sudo systemctl daemon-reload

echo "🚀 Restarting Ollama..."
sudo systemctl restart ollama

echo "✅ Ollama is now listening on 0.0.0.0:11434"
echo "   Test with: curl http://localhost:11434/"
