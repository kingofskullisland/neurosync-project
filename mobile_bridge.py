#!/usr/bin/env python3
"""
Von Agent Bridge Server
Port: 8082 | Upstream: Ollama on localhost:11435 (Alpaca flatpak)
"""
from flask import Flask, request, jsonify
import requests
import signal
import sys

app = Flask(__name__)

# CRITICAL: Port 11435 (Alpaca flatpak), NOT 11434
OLLAMA_URL      = "http://localhost:11435/api/generate"
OLLAMA_CHAT_URL = "http://localhost:11435/api/chat"
OLLAMA_TAGS_URL = "http://localhost:11435/api/tags"
PORT            = 8082

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    ollama_ok = False
    try:
        r = requests.get(OLLAMA_TAGS_URL, timeout=3)
        ollama_ok = r.status_code == 200
    except Exception:
        pass
    return jsonify({
        "status": "online",
        "system": "VON_AGENT_BRIDGE",
        "ollama": "connected" if ollama_ok else "unreachable",
        "port": PORT,
        "ollama_port": 11435
    }), 200

@app.route('/models', methods=['GET'])
def get_models():
    """List available Ollama models"""
    try:
        response = requests.get(OLLAMA_TAGS_URL, timeout=10)
        return response.json(), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/chat', methods=['POST'])
def chat():
    """Send prompt to Ollama"""
    data = request.json
    if not data or "prompt" not in data:
        return jsonify({"error": "Missing 'prompt' in request body"}), 400
    
    prompt = data.get("prompt")
    model  = data.get("model", "llama3")
    payload = {"model": model, "prompt": prompt, "stream": False}
    
    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=120)
        return response.json(), 200
    except requests.exceptions.Timeout:
        return jsonify({"error": "Model processing timed out (120s)"}), 504
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "Cannot reach Ollama at port 11435. Is Alpaca running?"}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/', methods=['POST'])
def execute():
    """Legacy command execution endpoint"""
    data = request.json
    if not data:
        return jsonify({"error": "Empty request"}), 400
    
    action = data.get("action")
    if action == "execute_command":
        import subprocess
        cmd = data.get("command", "echo 'no command'")
        try:
            result = subprocess.run(cmd, shell=True, text=True, capture_output=True, timeout=60)
            return jsonify({"output": f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"}), 200
        except Exception as e:
            return jsonify({"output": f"Execution Error: {str(e)}"}), 500
    return jsonify({"error": f"Unknown action: {action}"}), 400

def signal_handler(sig, frame):
    print("\n[VON] Bridge shutting down gracefully...")
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

if __name__ == '__main__':
    from werkzeug.serving import WSGIRequestHandler
    WSGIRequestHandler.protocol_version = "HTTP/1.1"
    print(f"[VON] Bridge starting on 0.0.0.0:{PORT}")
    print(f"[VON] Ollama upstream: {OLLAMA_URL}")
    app.run(host='0.0.0.0', port=PORT, debug=False, use_reloader=False, threaded=True)
