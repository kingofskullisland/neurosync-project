import { useState } from 'react';
import { useNoosphere } from '../context/NoosphereContext';
import { sendChat } from '../lib/api';
import { loadSettings } from '../lib/storage';

/**
 * useWorkloadRouter
 *
 * Routes AI prompts through the backend bridge which applies
 * the Hadron persona and conversation history, then forwards to Ollama.
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
            const settings = await loadSettings();
            const ip = settings.vpnIp || settings.pcIp;
            const model = settings.selectedModel || 'llama3.2:latest';

            if (!ip) {
                responseText = '⚠️ No server IP configured. Go to Settings → Uplink Protocols.';
                return responseText;
            }

            // Convert ChatMessage[] to simple {role, content}[] for the API
            const historyPayload = history
                .filter((m: any) => m.role === 'user' || m.role === 'assistant')
                .slice(-20)
                .map((m: any) => ({ role: m.role, content: m.content }));

            const result = await sendChat(ip, userMessage, model, historyPayload);
            responseText = result.response;

        } catch (error: any) {
            console.error('Workload Error:', error);
            responseText = `⚠️ ${error.message || 'Connection to Noosphere lost.'}`;
        } finally {
            setLoading(false);
        }

        return responseText;
    };

    return { processMessage, loading };
};
