#!/bin/bash
###############################################################################
# Von Agent — USB Link Watchdog
# Maintains ADB reverse tunnels for bridge (8082) and Ollama (11435)
###############################################################################

set -euo pipefail

# CRITICAL: Port 11435 (Alpaca flatpak), NOT 11434
BRIDGE_PORT=8082
OLLAMA_PORT=11435
DEVICE_ID="2406APNFAG"
POLL_INTERVAL=3
HEALTH_CHECK_INTERVAL=10

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

health_counter=0

log() {
    echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')] ✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date '+%H:%M:%S')] ✗${NC} $1"
}

# Check ADB
if ! command -v adb &> /dev/null; then
    log_error "ADB not found. Install Android SDK or add to PATH."
    exit 1
fi

# Cleanup on exit
cleanup() {
    log_warn "Shutting down Von Agent Link..."
    adb reverse --remove tcp:$BRIDGE_PORT 2>/dev/null || true
    adb reverse --remove tcp:$OLLAMA_PORT 2>/dev/null || true
    log "Tunnels removed. Goodbye."
    exit 0
}

trap cleanup SIGINT SIGTERM

log "Starting ADB server..."
adb start-server >/dev/null 2>&1

establish_tunnels() {
    log "Establishing reverse tunnels..."
    adb reverse tcp:$BRIDGE_PORT tcp:$BRIDGE_PORT >/dev/null 2>&1 && \
        log_success "Bridge: $BRIDGE_PORT → localhost:$BRIDGE_PORT"
    adb reverse tcp:$OLLAMA_PORT tcp:$OLLAMA_PORT >/dev/null 2>&1 && \
        log_success "Ollama: $OLLAMA_PORT → localhost:$OLLAMA_PORT"
}

check_bridge_health() {
    if curl -sf http://localhost:$BRIDGE_PORT/health >/dev/null 2>&1; then
        echo -ne "${GREEN}●${NC}"
    else
        echo -ne "${RED}●${NC}"
    fi
}

check_ollama_health() {
    if curl -sf http://localhost:$OLLAMA_PORT/api/tags >/dev/null 2>&1; then
        echo -ne "${GREEN}●${NC}"
    else
        echo -ne "${RED}●${NC}"
    fi
}

verify_tunnels() {
    adb reverse --list 2>/dev/null | grep -q "tcp:$BRIDGE_PORT" && \
    adb reverse --list 2>/dev/null | grep -q "tcp:$OLLAMA_PORT"
}

log "🔗 Von Agent Link Active"
log "Device: ${DEVICE_ID} | Bridge: ${BRIDGE_PORT} | Ollama: ${OLLAMA_PORT}"
echo ""

device_connected=false

while true; do
    if adb devices | grep -q "$DEVICE_ID"; then
        if [ "$device_connected" = false ]; then
            log_success "Device connected: $DEVICE_ID"
            establish_tunnels
            device_connected=true
            health_counter=0
        fi
        
        ((health_counter++)) || true
        if [ $((health_counter % (HEALTH_CHECK_INTERVAL / POLL_INTERVAL))) -eq 0 ]; then
            if ! verify_tunnels; then
                log_warn "Tunnels dropped, re-establishing..."
                establish_tunnels
            else
                bridge_status=$(check_bridge_health)
                ollama_status=$(check_ollama_health)
                log "Health: Bridge ${bridge_status} | Ollama ${ollama_status}"
            fi
        fi
    else
        if [ "$device_connected" = true ]; then
            log_warn "Device disconnected. Waiting..."
            device_connected=false
        fi
    fi
    
    sleep $POLL_INTERVAL
done
