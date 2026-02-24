#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  NeuroSync Forge — Unified Desktop Launcher
#  "By the Omnissiah's grace, the machine spirits awaken."
# ═══════════════════════════════════════════════════════════════

set -e

# ─── CONFIGURATION ───
OLLAMA_PORT=11435
BRIDGE_PORT=8082
MONITOR_PORT=8888
BACKEND_DIR="$(cd "$(dirname "$0")/../backend" && pwd)"
DESKTOP_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
AMBER='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# PIDs to track for cleanup
PIDS=()

# ─── CLEANUP ───
cleanup() {
    echo -e "\n${RED}═══ SHUTDOWN INITIATED ═══${NC}"
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            echo -e "${DIM}  Terminating process $pid...${NC}"
            kill "$pid" 2>/dev/null || true
        fi
    done
    echo -e "${RED}═══ MACHINE SPIRITS DORMANT ═══${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# ─── HEADER ───
echo -e "${CYAN}${BOLD}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           ⚙  NEUROSYNC FORGE — IGNITION RITE  ⚙         ║"
echo "║        The Omnissiah's blessing upon this machine        ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── STEP 1: TAILSCALE ───
echo -e "${AMBER}[1/5] TAILSCALE VPN${NC}"
if command -v tailscale &> /dev/null; then
    TS_STATUS=$(tailscale status --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('BackendState','Unknown'))" 2>/dev/null || echo "Unknown")
    if [ "$TS_STATUS" = "Running" ]; then
        TS_IP=$(tailscale ip -4 2>/dev/null || echo "N/A")
        echo -e "  ${GREEN}✓ Tailscale ACTIVE${NC} — IP: ${CYAN}${TS_IP}${NC}"
    else
        echo -e "  ${AMBER}⚠ Tailscale not connected (state: $TS_STATUS)${NC}"
        echo -e "  ${DIM}  Run: sudo tailscale up${NC}"
        TS_IP="N/A"
    fi
else
    echo -e "  ${DIM}  Tailscale not installed. Skipping.${NC}"
    TS_IP="N/A"
fi

# ─── STEP 2: OLLAMA ───
echo -e "\n${AMBER}[2/5] OLLAMA SERVER${NC}"
if command -v ollama &> /dev/null; then
    # Check if already running
    if curl -sf "http://localhost:${OLLAMA_PORT}/api/version" > /dev/null 2>&1; then
        OLLAMA_VER=$(curl -sf "http://localhost:${OLLAMA_PORT}/api/version" | python3 -c "import sys,json; print(json.load(sys.stdin).get('version','?'))" 2>/dev/null || echo "?")
        echo -e "  ${GREEN}✓ Ollama already running${NC} (v${OLLAMA_VER}, port ${OLLAMA_PORT})"
    else
        echo -e "  ${AMBER}  Starting Ollama on port ${OLLAMA_PORT}...${NC}"
        OLLAMA_HOST="0.0.0.0:${OLLAMA_PORT}" ollama serve > /tmp/ollama.log 2>&1 &
        PIDS+=($!)
        
        # Wait for startup
        for i in {1..15}; do
            if curl -sf "http://localhost:${OLLAMA_PORT}/api/version" > /dev/null 2>&1; then
                echo -e "  ${GREEN}✓ Ollama started${NC} (port ${OLLAMA_PORT})"
                break
            fi
            sleep 1
        done
        
        if ! curl -sf "http://localhost:${OLLAMA_PORT}/api/version" > /dev/null 2>&1; then
            echo -e "  ${RED}✗ Ollama failed to start. Check /tmp/ollama.log${NC}"
        fi
    fi
    
    # List models
    MODELS=$(curl -sf "http://localhost:${OLLAMA_PORT}/api/tags" | python3 -c "
import sys,json
data = json.load(sys.stdin)
models = data.get('models', [])
for m in models:
    size = m.get('size', 0) / (1024**3)
    print(f\"    • {m['name']} ({size:.1f}GB)\")
" 2>/dev/null || echo "    (failed to list)")
    echo -e "  ${DIM}Models loaded:${NC}"
    echo -e "${CYAN}${MODELS}${NC}"
else
    echo -e "  ${RED}✗ Ollama not installed${NC}"
    echo -e "  ${DIM}  Install: curl -fsSL https://ollama.com/install.sh | sh${NC}"
fi

# ─── STEP 3: BACKEND ───
echo -e "\n${AMBER}[3/5] BACKEND BRIDGE (FastAPI)${NC}"
if curl -sf "http://localhost:${BRIDGE_PORT}/health" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Bridge already running${NC} on port ${BRIDGE_PORT}"
else
    if [ -d "$BACKEND_DIR" ]; then
        echo -e "  ${AMBER}  Starting backend on port ${BRIDGE_PORT}...${NC}"
        cd "$BACKEND_DIR"
        
        # Check for venv
        if [ -d "venv" ]; then
            source venv/bin/activate 2>/dev/null || true
        fi
        
        python3 -m uvicorn app.main:app --host 0.0.0.0 --port ${BRIDGE_PORT} --log-level warning > /tmp/neurosync-bridge.log 2>&1 &
        PIDS+=($!)
        cd "$PROJECT_DIR"
        
        # Wait for startup
        sleep 3
        if curl -sf "http://localhost:${BRIDGE_PORT}/health" > /dev/null 2>&1; then
            echo -e "  ${GREEN}✓ Bridge started${NC} on port ${BRIDGE_PORT}"
        else
            echo -e "  ${RED}✗ Bridge failed to start. Check /tmp/neurosync-bridge.log${NC}"
        fi
    else
        echo -e "  ${RED}✗ Backend directory not found: ${BACKEND_DIR}${NC}"
    fi
fi

# ─── STEP 4: MONITORING UI ───
echo -e "\n${AMBER}[4/5] MONITORING CONSOLE${NC}"
if [ -f "${DESKTOP_DIR}/index.html" ]; then
    # Check if already running
    if curl -sf "http://localhost:${MONITOR_PORT}" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Monitor already running${NC} on port ${MONITOR_PORT}"
    else
        cd "$DESKTOP_DIR"
        python3 -m http.server ${MONITOR_PORT} --bind 0.0.0.0 > /tmp/neurosync-monitor.log 2>&1 &
        PIDS+=($!)
        cd "$PROJECT_DIR"
        echo -e "  ${GREEN}✓ Monitor started${NC} → ${CYAN}http://localhost:${MONITOR_PORT}${NC}"
    fi
else
    echo -e "  ${RED}✗ index.html not found in ${DESKTOP_DIR}${NC}"
fi

# ─── STEP 5: CONNECTION INFO ───
echo -e "\n${AMBER}[5/5] CONNECTION SUMMARY${NC}"

# Get local IP
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "Unknown")

echo -e "${CYAN}${BOLD}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              CONNECTION INFORMATION                      ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo -e "║  ${NC}${GREEN}Local IP:      ${CYAN}${LOCAL_IP}${NC}${CYAN}${BOLD}"
printf "%-59s║\n" ""
echo -e "║  ${NC}${GREEN}Tailscale IP:  ${CYAN}${TS_IP}${NC}${CYAN}${BOLD}"
printf "%-59s║\n" ""
echo -e "║  ${NC}${GREEN}Ollama:        ${CYAN}http://${LOCAL_IP}:${OLLAMA_PORT}${NC}${CYAN}${BOLD}"
printf "%-59s║\n" ""
echo -e "║  ${NC}${GREEN}Bridge:        ${CYAN}http://${LOCAL_IP}:${BRIDGE_PORT}${NC}${CYAN}${BOLD}"
printf "%-59s║\n" ""
echo -e "║  ${NC}${GREEN}Monitor:       ${CYAN}http://localhost:${MONITOR_PORT}${NC}${CYAN}${BOLD}"
printf "%-59s║\n" ""
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  Mobile App Settings:                                    ║"
echo -e "║  ${NC}${AMBER}PC IP:     ${LOCAL_IP}${NC}${CYAN}${BOLD}"
printf "%-59s║\n" ""
if [ "$TS_IP" != "N/A" ]; then
echo -e "║  ${NC}${AMBER}VPN IP:    ${TS_IP}${NC}${CYAN}${BOLD}"
printf "%-59s║\n" ""
fi
echo -e "║  ${NC}${AMBER}Port:      ${BRIDGE_PORT}${NC}${CYAN}${BOLD}"
printf "%-59s║\n" ""
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── QR CODE ───
echo -e "\n${AMBER}[6/6] MOBILE UPLINK QR${NC}"
CONNECTION_STRING="neurosync://${LOCAL_IP}:${BRIDGE_PORT}"
if [ -f "${DESKTOP_DIR}/gen_qr.py" ]; then
    # Activate venv if available for qrcode lib (assuming installed in system or venv)
    # We use python3 directly as qrcode might be system-wide or in venv
    python3 "${DESKTOP_DIR}/gen_qr.py" "$CONNECTION_STRING" || echo -e "${RED}QR Generation Failed${NC}"
else
    echo -e "${RED}gen_qr.py not found${NC}"
fi

echo -e "${GREEN}${BOLD}═══ ALL SYSTEMS NOMINAL — THE FORGE IS ONLINE ═══${NC}"
echo -e "${DIM}Press Ctrl+C to shut down all services.${NC}"
echo ""

# Keep alive
wait
