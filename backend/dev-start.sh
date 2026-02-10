#!/bin/bash
#
# NeuroSync Router - Development Startup Script
# Author: DevOps Team
# Purpose: Automatically handle port conflicts and start the server
#

set -e  # Exit on error

PORT=8082
PYTHON_CMD="python3"
APP_MODULE="app.main"

echo "🚀 NeuroSync Router - Dev Startup"
echo "=================================="

# Function to check if port is in use
check_port() {
    if lsof -i :$PORT > /dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill process on port
kill_port_process() {
    echo "⚠️  Port $PORT is in use"
    
    # Get PID using lsof
    PID=$(lsof -t -i :$PORT 2>/dev/null || true)
    
    if [ -n "$PID" ]; then
        echo "🔪 Killing process $PID on port $PORT..."
        kill -9 $PID 2>/dev/null || true
        
        # Wait for socket to release
        echo "⏳ Waiting for socket to release..."
        sleep 1
        
        # Verify port is now free
        if check_port; then
            echo "❌ Failed to free port $PORT. Please check manually:"
            echo "   lsof -i :$PORT"
            exit 1
        fi
        
        echo "✅ Port $PORT is now free"
    fi
}

# Main execution
main() {
    # Check if port is already in use
    if check_port; then
        kill_port_process
    else
        echo "✅ Port $PORT is available"
    fi
    
    echo ""
    echo "🔧 Starting Python application..."
    echo "   Command: $PYTHON_CMD -m $APP_MODULE"
    echo ""
    
    # Start the application
    $PYTHON_CMD -m $APP_MODULE
}

# Trap Ctrl+C to cleanup
trap 'echo -e "\n\n🛑 Shutting down..."; exit 0' INT TERM

# Run main function
main
