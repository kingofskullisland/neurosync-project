#!/bin/bash

# Kill any existing bridge process
pkill -f mobile_bridge.py

# Start the bridge in the background
echo "Starting Von Agent Bridge..."
nohup python3 backend/bridge.py > bridge.log 2>&1 &
BRIDGE_PID=$!
echo "Bridge started with PID $BRIDGE_PID"

# Wait for bridge to be ready
echo "Waiting for bridge to initialize..."
sleep 2
curl -s http://localhost:8082/health | jq .

# Start Expo
echo "Starting Expo..."
npx expo start --clear
