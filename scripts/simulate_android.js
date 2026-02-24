/**
 * simulate_android.js
 * 
 * Simulates the Android client network calls.
 * Runs in Node.js but uses the same logic as the app.
 */

const http = require('http');

const BASE_URL = 'http://localhost:8082';

async function fetchJson(path, options = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(`${BASE_URL}${path}`, {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const result = {
                    status: res.statusCode,
                    data: data ? JSON.parse(data) : null
                };
                resolve(result);
            });
        });

        req.on('error', reject);

        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        req.end();
    });
}

async function runSimulation() {
    console.log("📱 [Android Sim] Starting Client Simulation...");

    // 1. App Startup: Check Health
    try {
        console.log("📱 [App Start] Checking API health...");
        const health = await fetchJson('/health');

        if (health.status !== 200) throw new Error(`Health status ${health.status}`);
        if (health.data.status !== 'online') throw new Error(`Invalid status: ${health.data.status}`);

        console.log("✅ [App Start] API is Online.");
    } catch (e) {
        console.error("❌ [App Start] Failed:", e.message);
        process.exit(1);
    }

    // 2. Chat Screen: User sends message
    try {
        console.log("📱 [Chat] Sending 'Hello'...");
        const chat = await fetchJson('/chat', {
            method: 'POST',
            body: { prompt: "Hello", model: "llama3" }
        });

        console.log(`📱 [Chat] Response Status: ${chat.status}`);

        if (chat.status === 200) {
            console.log("✅ [Chat] Success:", chat.data);
        } else if (chat.status === 503) {
            console.log("⚠️ [Chat] Service Unavailable (Expected if Ollama off):", chat.data);
            if (!chat.data.error) throw new Error("Missing error message in 503 response");
            console.log("✅ [Chat] Error handled correctly.");
        } else {
            console.error("❌ [Chat] Unexpected status:", chat.status);
            process.exit(1);
        }

    } catch (e) {
        console.error("❌ [Chat] Network Error:", e.message);
        process.exit(1);
    }

    console.log("✨ [Android Sim] Simulation passed.");
}

runSimulation();
