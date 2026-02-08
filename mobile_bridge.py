import http.server
import socketserver
import subprocess
import json
import os
import signal
import sys
import time

# --- CONFIG ---
PORT = 8081
LLAMA_PORT = 8080
MODEL_DIR = os.path.expanduser("~/models")
LLAMA_BIN = os.path.expanduser("~/llama.cpp/llama-server")

os.makedirs(MODEL_DIR, exist_ok=True)
current_process = None

def run_system_command(cmd):
    """Executes shell commands (Middle Tier Automation)"""
    print(f"⚡ Executing: {cmd}")
    try:
        result = subprocess.run(cmd, shell=True, text=True, capture_output=True, timeout=60)
        return f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    except Exception as e:
        return f"Execution Error: {str(e)}"

class Handler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        len = int(self.headers['Content-Length'])
        data = json.loads(self.rfile.read(len))
        resp = {}

        if data['action'] == 'execute_command':
            output = run_system_command(data['command'])
            resp = {"output": output}

        self.send_response(200)
        self.end_headers()
        self.wfile.write(json.dumps(resp).encode())

print(f"🌉 Bridge Active on {PORT}")
server = socketserver.TCPServer(("0.0.0.0", PORT), Handler)
server.serve_forever()
