import React, { createContext, useCallback, useContext, useState } from 'react';

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

    const activateTether = useCallback((url: string, token: string) => {
        console.log(`⚡ TETHER ACTIVATED → ${url}`);
        setUpstreamUrl(url);
        setAuthToken(token);
        setInferenceMode('tethered');
    }, []);

    const disconnectTether = useCallback(() => {
        console.log('🔌 TETHER DISCONNECTED → Local Mode');
        setUpstreamUrl(null);
        setAuthToken(null);
        setInferenceMode('local');
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
