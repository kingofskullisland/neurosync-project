#!/bin/bash

# 1. Setup Project Directory
echo "Initializing VPN Project..."
mkdir -p vpn_project
cd vpn_project

# Create internal structure
mkdir -p src/java/org/test/vpnflask
mkdir -p assets

# ---------------------------------------------------------
# 2. Generate Python Source Files
# ---------------------------------------------------------

# main.py - The Kivy Entry Point
cat <<EOF > main.py
import threading
import sys
import time
from kivy.app import App
from kivy.uix.label import Label
from src.bridge import VpnController
from src.server import run_server

class VpnApp(App):
    def build(self):
        self.controller = VpnController()
        # Start Flask in a background thread
        self.server_thread = threading.Thread(target=run_server, args=(self.controller,))
        self.server_thread.daemon = True
        self.server_thread.start()
        return Label(text="VPN Backend Active\nControl via Web UI at 127.0.0.1:5000")

if __name__ == '__main__':
    VpnApp().run()
EOF

# src/__init__.py
touch src/__init__.py

# src/server.py - The Flask Web Server
cat <<EOF > src/server.py
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
EOF

# src/bridge.py - The Python-to-Java Bridge
cat <<EOF > src/bridge.py
import sys
from jnius import autoclass

class VpnController:
    def start_vpn(self):
        print("Attempting to start VPN Service...")
        if sys.platform == 'android':
            try:
                # 1. Get Context
                PythonActivity = autoclass('org.kivy.android.PythonActivity')
                Intent = autoclass('android.content.Intent')
                context = PythonActivity.mActivity
                
                # 2. Reference our custom Java Service
                service_class = autoclass('org.test.vpnflask.PythonVpnService')
                
                # 3. Start Service
                intent = Intent(context, service_class)
                intent.setAction("START_VPN")
                context.startService(intent)
                print("Service Intent Sent.")
            except Exception as e:
                print(f"CRITICAL ERROR: {e}")
        else:
            print("Linux logic placeholder (subprocess openvpn)")
EOF

# ---------------------------------------------------------
# 3. Generate Java Source File (VpnService)
# ---------------------------------------------------------

cat <<EOF > src/java/org/test/vpnflask/PythonVpnService.java
package org.test.vpnflask;

import android.content.Intent;
import android.net.VpnService;
import android.os.ParcelFileDescriptor;
import android.util.Log;
import java.io.IOException;

public class PythonVpnService extends VpnService {
    private ParcelFileDescriptor mInterface;
    private Thread mThread;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "START_VPN".equals(intent.getAction())) {
            // Stop previous thread if running
            if (mThread != null) mThread.interrupt();
            
            mThread = new Thread(() -> {
                configureVpn();
            });
            mThread.start();
        }
        return START_STICKY;
    }

    private void configureVpn() {
        if (mInterface != null) return;
        try {
            Log.i("PythonVpnService", "Building VPN Interface...");
            Builder builder = new Builder();
            builder.setSession("PythonVPN")
                   .addAddress("10.0.0.2", 24)
                   .addDnsServer("8.8.8.8")
                   .addRoute("0.0.0.0", 0);
            
            // Establish the TUN interface
            mInterface = builder.establish();
            Log.i("PythonVpnService", "Interface Established: " + mInterface);
            
            // TODO: Here is where you would start the loop to read/write packets
            // straight from mInterface.getFileDescriptor()
            
        } catch (Exception e) {
            Log.e("PythonVpnService", "Error", e);
        }
    }

    @Override
    public void onDestroy() {
        try { if (mInterface != null) mInterface.close(); } catch (Exception e) {}
        super.onDestroy();
    }
}
EOF

# ---------------------------------------------------------
# 4. Generate Buildozer Spec
# ---------------------------------------------------------

cat <<EOF > buildozer.spec
[app]
title = Python VPN
package.name = vpnflask
package.domain = org.test
source.dir = .
source.include_exts = py,png,jpg,kv,atlas,html,css,js,java

version = 0.1
requirements = python3,kivy,flask,pyjnius,android,requests

orientation = portrait
fullscreen = 0

# Android Permissions
android.permissions = INTERNET, ACCESS_NETWORK_STATE, BIND_VPN_SERVICE, FOREGROUND_SERVICE

# API Configuration
android.api = 33
android.minapi = 21
android.ndk = 25b

# Java Source Integration
android.add_src = src/java

# Service Manifest Injection
android.manifest.extra_xml = <service android:name="org.test.vpnflask.PythonVpnService" android:permission="android.permission.BIND_VPN_SERVICE"><intent-filter><action android:name="android.net.VpnService"/></intent-filter></service>

[buildozer]
log_level = 2
warn_on_root = 1
EOF

echo "---------------------------------------------------"
echo "Project 'vpn_project' created successfully."
echo "To build the APK, run:"
echo "cd vpn_project && buildozer android debug"
echo "---------------------------------------------------"
