#!/bin/bash
# NeuroBeam QR Code Generator
# Generates a terminal-based QR code for mobile app pairing

# Install qrencode if missing (for Termux/Linux)
if ! command -v qrencode &> /dev/null; then
    echo "📦 Installing qrencode..."
    if command -v pkg &> /dev/null; then
        # Termux
        pkg install qrencode -y
    elif command -v apt &> /dev/null; then
        # Debian/Ubuntu
        sudo apt install qrencode -y
    else
        echo "❌ Cannot find package manager. Please install 'qrencode' manually."
        exit 1
    fi
fi

# Get the Local IP (Priority: Tailscale -> WLAN -> eth0)
IP=""

# Try Tailscale first
if command -v tailscale &> /dev/null; then
    IP=$(tailscale ip -4 2>/dev/null | head -n 1)
fi

# Fallback to tailscale0 interface
if [ -z "$IP" ]; then
    IP=$(ip -4 addr show tailscale0 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n 1)
fi

# Fallback to wlan0 (WiFi)
if [ -z "$IP" ]; then
    IP=$(ip -4 addr show wlan0 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n 1)
fi

# Fallback to eth0 (Ethernet)
if [ -z "$IP" ]; then
    IP=$(ip -4 addr show eth0 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n 1)
fi

# Last resort: first non-loopback interface
if [ -z "$IP" ]; then
    IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

if [ -z "$IP" ]; then
    echo "❌ Could not detect network IP address"
    exit 1
fi

# Port configuration (default: 8000)
PORT="${NEUROBEAM_PORT:-8080}"
URL="http://$IP:$PORT"

# Display header
clear
echo "=========================================="
echo "      NEUROBEAM CONNECTION QR             "
echo "=========================================="
echo ""
echo "🌐 Detected IP: $IP"
echo "🔌 Port: $PORT"
echo ""
echo "Scan this with NeuroSync to pair:"
echo ""

# Generate ASCII QR code
qrencode -t ANSIUTF8 "$URL"

echo ""
echo "📱 Connection URL: $URL"
echo "=========================================="
echo ""
echo "💡 Tip: Keep this terminal open while pairing"
echo "⚙️  To change port: export NEUROBEAM_PORT=<port>"
echo ""
