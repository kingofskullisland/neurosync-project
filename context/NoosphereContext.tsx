import React, { createContext, ReactNode, useContext, useState } from 'react';

type InferenceMode = 'local' | 'tethered';
type AgentType = 'llama3.2:latest' | 'gemma:2b' | 'mistral:latest';

interface NoosphereState {
    // AI State
    activeAgent: AgentType;
    setActiveAgent: (agent: AgentType) => void;

    // Tethering State
    inferenceMode: InferenceMode;
    setInferenceMode: (mode: InferenceMode) => void;
    upstreamUrl: string | null; // e.g., "http://192.168.1.50:8000"
    authToken: string | null;   // The UUID token from the QR code

    // Actions
    connectTether: (url: string, token: string) => void;
    disconnectTether: () => void;
}

const NoosphereContext = createContext<NoosphereState | undefined>(undefined);

export const NoosphereProvider = ({ children }: { children: ReactNode }) => {
    const [activeAgent, setActiveAgent] = useState<AgentType>('llama3.2:latest');
    const [inferenceMode, setInferenceMode] = useState<InferenceMode>('local');
    const [upstreamUrl, setUpstreamUrl] = useState<string | null>(null);
    const [authToken, setAuthToken] = useState<string | null>(null);

    // Helper to cleanly link to desktop
    const connectTether = (url: string, token: string) => {
        setUpstreamUrl(url);
        setAuthToken(token);
        setInferenceMode('tethered');
        console.log(`🔗 Tethered to Brain at ${url}`);
    };

    // Helper to cleanly sever the link
    const disconnectTether = () => {
        setUpstreamUrl(null);
        setAuthToken(null);
        setInferenceMode('local');
        console.log("🔌 Tether disconnected. Reverting to local brain.");
    };

    return (
        <NoosphereContext.Provider value={{
            activeAgent, setActiveAgent,
            inferenceMode, setInferenceMode,
            upstreamUrl, authToken,
            connectTether, disconnectTether
        }}>
            {children}
        </NoosphereContext.Provider>
    );
};

export const useNoosphere = () => {
    const context = useContext(NoosphereContext);
    if (!context) throw new Error("useNoosphere must be used within a NoosphereProvider");
    return context;
};
