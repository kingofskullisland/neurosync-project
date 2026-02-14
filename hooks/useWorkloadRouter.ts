import { useState } from 'react';
import { useNoosphere } from '../context/NoosphereContext';

/**
 * useWorkloadRouter
 *
 * Decides whether to process AI prompts locally on the phone
 * or offload to the tethered desktop (Pop!_OS / Ollama).
 *
 * When tethered:  POST → http://<desktop-ip>:8000/api/tether/chat
 * When local:     Uses on-device llama.cpp or returns a fallback.
 */
export const useWorkloadRouter = () => {
    const {
        activeAgent,
        inferenceMode,
        upstreamUrl,
        authToken,
    } = useNoosphere();

    const [loading, setLoading] = useState(false);

    const processMessage = async (
        userMessage: string,
        history: { role: string; content: string }[]
    ): Promise<string> => {
        setLoading(true);
        let responseText = '';

        try {
            // ─── BRANCH 1: TETHERED MODE (Desktop handles the thinking) ───
            if (inferenceMode === 'tethered' && upstreamUrl) {
                console.log('⚡ Offloading to Desktop...');

                const resp = await fetch(`${upstreamUrl}/api/tether/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`,
                    },
                    body: JSON.stringify({
                        model: activeAgent,
                        messages: [...history, { role: 'user', content: userMessage }],
                    }),
                });

                if (!resp.ok) throw new Error('Desktop unreachable');

                const data = await resp.json();
                responseText = data.message?.content ?? data.response ?? '';

                // ─── BRANCH 2: LOCAL MODE (Phone tries its best) ──────────────
            } else {
                console.log('🐌 Processing Locally...');

                // Guard: Prevent running models that are too large for mobile
                if (activeAgent.includes('70b') || activeAgent.includes('command-r')) {
                    responseText = '⚠️ Model too large for device. Please Beam to Desktop.';
                } else {
                    // TODO: Replace with actual local llama.rn / llama.cpp call
                    responseText = 'I am thinking locally... (Simulated Response)';
                }
            }

        } catch (error) {
            console.error('Workload Error:', error);
            responseText = '⚠️ Error: Connection to Noosphere Desktop lost.';
        } finally {
            setLoading(false);
        }

        return responseText;
    };

    return { processMessage, loading };
};
