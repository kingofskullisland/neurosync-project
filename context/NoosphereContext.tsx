import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { BeamState, neurobeam } from '../lib/neurobeam';

// ─── Types ───────────────────────────────────────────────────────
type AgentType = 'llama3.2:3b' | 'gemma:2b' | 'mistral:latest';
type InferenceMode = 'local' | 'tethered';

interface NoosphereState {
    // Agent
    activeAgent: AgentType;
    setActiveAgent: (agent: AgentType) => void;

    // Project
    currentProject: string | null;
    setCurrentProject: (slug: string) => void;

    // Tethering (Headless Desktop Connection)
    inferenceMode: InferenceMode;
    upstreamUrl: string | null;       // e.g. "http://192.168.1.50:8000"
    authToken: string | null;         // Bearer token from QR handshake

    // Actions
    activateTether: (url: string, token: string) => void;
    disconnectTether: () => void;

    // Noosphere Comm Link
    connected: boolean;
    logs: any[];
    sendIntent: (intent: string) => void;
}

// ─── Context ─────────────────────────────────────────────────────
const NoosphereContext = createContext<NoosphereState | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────
export const NoosphereProvider = ({ children }: { children: React.ReactNode }) => {
    const [activeAgent, setActiveAgent] = useState<AgentType>('llama3.2:3b');
    const [currentProject, setCurrentProject] = useState<string | null>(null);
    const [inferenceMode, setInferenceMode] = useState<InferenceMode>('local');
    const [upstreamUrl, setUpstreamUrl] = useState<string | null>(null);
    const [authToken, setAuthToken] = useState<string | null>(null);

    const [connected, setConnected] = useState(false);
    const [logs, setLogs] = useState<any[]>([]);

    useEffect(() => {
        // Subscribe to neurobeam stats and incoming payloads
        const unsubscribe = neurobeam.onUpdate((payload: any) => {
            if (payload.state !== undefined) {
                // It's a stats object update
                setConnected(payload.state === BeamState.LOCKED);
            } else {
                // It's a custom payload (e.g., from executeDeviceCommand or PC handler)
                setLogs((prev) => [...prev, payload]);
            }
        });
        return unsubscribe;
    }, []);

    const activateTether = useCallback(async (url: string, token: string) => {
        console.log(`⚡ TETHER ACTIVATED → ${url}`);
        setUpstreamUrl(url);
        setAuthToken(token);
        setInferenceMode('tethered');

        try {
            // Assume url is of form ws://IP:PORT and token is base64 key string with sid
            // The existing QR code format is {"host":IP, "port":PORT, "key":KEY, "sid":SID}
            // but the NoosphereContext might just receive strings. 
            // In a real flow, you parse the QR code.
            const parsed = JSON.parse(token);
            await neurobeam.connect(parsed);
        } catch (e) {
            console.error("Failed to lock beam:", e);
        }
    }, []);

    const disconnectTether = useCallback(() => {
        console.log('🔌 TETHER DISCONNECTED → Local Mode');
        neurobeam.disconnect();
        setUpstreamUrl(null);
        setAuthToken(null);
        setInferenceMode('local');
        setConnected(false);
        setLogs([]);
    }, []);

    const sendIntent = useCallback((intent: string) => {
        if (!intent.trim()) return;
        const getTimestamp = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
        // Push optimistic log
        setLogs(prev => [...prev, { sender: 'OPERATOR', text: intent, timestamp: getTimestamp() }]);
        neurobeam.sendIntent(intent);
    }, []);

    return (
        <NoosphereContext.Provider
            value={{
                activeAgent,
                setActiveAgent,
                currentProject,
                setCurrentProject,
                inferenceMode,
                upstreamUrl,
                authToken,
                activateTether,
                disconnectTether,
                connected,
                logs,
                sendIntent,
            }}
        >
            {children}
        </NoosphereContext.Provider>
    );
};

// ─── Hook ────────────────────────────────────────────────────────
export const useNoosphere = () => {
    const context = useContext(NoosphereContext);
    if (!context) {
        throw new Error('useNoosphere must be used within a NoosphereProvider');
    }
    return context;
};
