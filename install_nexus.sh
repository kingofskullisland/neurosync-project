#!/bin/bash
###############################################################################
# Von Agent — Master Installer
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${CYAN}[VON]${NC} $1"; }
log_success() { echo -e "${GREEN}[VON] ✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}[VON] ⚠${NC} $1"; }
log_error() { echo -e "${RED}[VON] ✗${NC} $1"; }

PROJECT_DIR="/home/kosi/mobile-dev-lab/my-expo-app"
SYSTEMD_DIR="$HOME/.config/systemd/user"
DESKTOP_DIR="$HOME/.local/share/applications"

# CRITICAL: Port 11435 (Alpaca flatpak), NOT 11434
OLLAMA_PORT=11435

log "Von Agent Installation Starting..."
echo ""

# Check Python3
if ! command -v python3 &> /dev/null; then
    log_error "Python3 not found."
    exit 1
fi
log_success "Python3: $(python3 --version)"

# Install Flask/requests
log "Checking Python dependencies..."
pip3 install --user flask requests >/dev/null 2>&1 || true
log_success "Flask and requests available"

# Check ADB
if ! command -v adb &> /dev/null; then
    log_warn "ADB not found. Add ~/Android/Sdk/platform-tools to PATH."
else
    log_success "ADB: $(adb --version | head -n1)"
fi

# Check Ollama on correct port
if curl -sf http://localhost:$OLLAMA_PORT/api/tags >/dev/null 2>&1; then
    log_success "Ollama reachable on port $OLLAMA_PORT"
else
    log_warn "Ollama not reachable on port $OLLAMA_PORT. Ensure Alpaca flatpak is running."
fi

echo ""
log "Installing systemd service..."

mkdir -p "$SYSTEMD_DIR"
cp "$PROJECT_DIR/nexus-bridge.service" "$SYSTEMD_DIR/"
log_success "Service copied to $SYSTEMD_DIR"

systemctl --user daemon-reload
systemctl --user enable nexus-bridge.service
systemctl --user restart nexus-bridge.service
log_success "Service enabled and started"

loginctl enable-linger "$USER" 2>/dev/null || true
log_success "Lingering enabled"

echo ""
log "Installing desktop entry..."

mkdir -p "$DESKTOP_DIR"
cp "$PROJECT_DIR/nexus-os.desktop" "$DESKTOP_DIR/"
chmod +x "$DESKTOP_DIR/nexus-os.desktop"
log_success "Desktop entry installed"

chmod +x "$PROJECT_DIR/nexus-link.sh"
chmod +x "$PROJECT_DIR/mobile_bridge.py"
log_success "Scripts made executable"

echo ""
log "========================================="
log "        INSTALLATION COMPLETE"
log "========================================="
echo ""

# Status
bridge_status=$(systemctl --user is-active nexus-bridge.service || echo "inactive")
if [ "$bridge_status" = "active" ]; then
    log_success "Bridge service: ${GREEN}ACTIVE${NC}"
    if curl -sf http://localhost:8082/health >/dev/null 2>&1; then
        log_success "Bridge health: ${GREEN}OK${NC}"
    fi
else
    log_error "Bridge service: ${RED}INACTIVE${NC}"
fi

echo ""
log "Next steps:"
log "  1. Launch 'Von Agent Link' from app menu"
log "  2. Connect phone via USB"
log "  3. Run: npx expo start"
echo ""
