from flask import Flask, jsonify
import sys

app = Flask(__name__)
vpn_controller = None

@app.route('/')
def home():
    return "<h1>VPN Controller</h1><button onclick=\"fetch('/api/connect', {method: 'POST'})\">Connect VPN</button>"

@app.route('/api/connect', methods=['POST'])
def connect():
    if vpn_controller:
        vpn_controller.start_vpn()
        return jsonify({"status": "starting"})
    return jsonify({"error": "No controller"}), 500

def run_server(controller):
    global vpn_controller
    vpn_controller = controller
    # use_reloader=False is critical to prevent thread looping
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)
