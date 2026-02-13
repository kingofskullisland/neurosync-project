import { useState } from 'react';
import { Alert } from 'react-native';
import { useNoosphere } from '../context/NoosphereContext';

export const useWorkloadRouter = () => {
    const { activeAgent, inferenceMode, upstreamUrl, authToken, setInferenceMode } = useNoosphere();
    const [isThinking, setIsThinking] = useState(false);

    const processMessage = async (userMessage: string, history: any[]) => {
        setIsThinking(true);
        let aiResponse = "";

        try {
            // ⚡ BRANCH A: TETHERED (Desktop)
            if (inferenceMode === 'tethered' && upstreamUrl) {
                console.log(`⚡ Offloading to ${upstreamUrl}...`);

                const response = await fetch(`${upstreamUrl}/api/tether/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        model: activeAgent, // e.g., "llama3.2:latest"
                        messages: [...history, { role: 'user', content: userMessage }]
                    })
                });

                if (!response.ok) throw new Error("Desktop unreachable");

                const data = await response.json();
                // Ollama often returns 'message' object, or we might need to adapt based on backend response
                aiResponse = data.message?.content || data.response || "No response content";
            }

            // 🐌 BRANCH B: LOCAL (Phone)
            else {
                console.log("🐌 Using Local Inference...");
                // This is where we would call the local model. 
                // For now, we simulate a delay and a response to indicate local mode.
                await new Promise(r => setTimeout(r, 1000));
                aiResponse = "[Local Mode] I am limited by this phone's hardware. I cannot process complex queries efficiently.";
            }

        } catch (error) {
            console.error("Router Error:", error);
            Alert.alert("Connection Lost", "Reverting to local intelligence.");
            setInferenceMode('local'); // Auto-fallback
            aiResponse = "Error: Tether lost. Switched to local mode.";
        } finally {
            setIsThinking(false);
        }

        return aiResponse;
    };

    return { processMessage, isThinking };
};
