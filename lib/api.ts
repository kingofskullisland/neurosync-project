/**
 * Von Agent API Client
 * Connects to Python bridge on port 8082, Ollama on port 11434
 */

const BRIDGE_PORT = 8082;
const DEFAULT_TIMEOUT = 5000;
const CHAT_TIMEOUT = 120000; // 2 minutes for AI responses

// Request deduplication — abort previous in-flight chat request
let activeChatController: AbortController | null = null;

export interface HealthResponse {
    status: string;
    system: string;
    ollama: 'connected' | 'unreachable';
}

export interface ChatResponse {
    model: string;
    created_at?: string;
    response: string;
    done: boolean;
}

export interface ModelInfo {
    name: string;
    model: string;
    size: number;
    details?: {
        parameter_size: string;
        quantization_level: string;
    };
}

export interface ModelsResponse {
    models: ModelInfo[];
}

export class NetworkError extends Error {
    constructor(message: string, public code?: number) {
        super(message);
        this.name = 'NetworkError';
    }
}

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout: number = DEFAULT_TIMEOUT
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new NetworkError('Connection timed out');
        }
        throw new NetworkError('Network unreachable');
    }
}

/**
 * Build URL from IP address
 * Handles cases where user enters protocol, port, or path
 */
export function buildUrl(ip: string, port: number = BRIDGE_PORT): string {
    let cleanIp = ip.trim();
    // Remove protocol
    cleanIp = cleanIp.replace(/^https?:\/\//, '');
    // Remove trailing path
    cleanIp = cleanIp.split('/')[0];
    // Remove existing port to ensure we use the correct bridge port
    cleanIp = cleanIp.replace(/:\d+$/, '');

    if (!cleanIp) return `http://localhost:${port}`;

    return `http://${cleanIp}:${port}`;
}

/**
 * Check bridge health
 */
export async function checkHealth(ip: string): Promise<HealthResponse> {
    const url = `${buildUrl(ip)}/health`;

    try {
        const response = await fetchWithTimeout(url, { method: 'GET' });
        if (!response.ok) {
            throw new NetworkError(`Bridge error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        if (error instanceof NetworkError) throw error;
        throw new NetworkError('Failed to check health');
    }
}

/**
 * Get available models
 */
export async function getModels(ip: string): Promise<ModelsResponse> {
    const url = `${buildUrl(ip)}/models`;

    try {
        const response = await fetchWithTimeout(url, { method: 'GET' });
        if (!response.ok) {
            throw new NetworkError(`Models error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        if (error instanceof NetworkError) throw error;
        throw new NetworkError('Failed to get models');
    }
}

/**
 * Send chat prompt to AI
 * Includes deduplication — aborts previous in-flight request if still pending
 */
export async function sendChat(
    ip: string,
    prompt: string,
    model: string = 'llama3',
    history?: { role: string; content: string }[]
): Promise<ChatResponse> {
    // Abort any previous in-flight chat request
    if (activeChatController) {
        activeChatController.abort();
    }
    activeChatController = new AbortController();
    const currentController = activeChatController;

    const url = `${buildUrl(ip)}/chat`;

    try {
        const body: Record<string, unknown> = { prompt, model };
        if (history && history.length > 0) {
            body.history = history;
        }

        const response = await fetchWithTimeout(
            url,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: currentController.signal,
            },
            CHAT_TIMEOUT
        );

        if (!response.ok) {
            if (response.status === 503) {
                throw new NetworkError('Ollama unavailable. Start Alpaca on PC.', 503);
            }
            if (response.status === 504) {
                throw new NetworkError('AI processing timed out', 504);
            }
            const data = await response.json().catch(() => ({}));
            throw new NetworkError(data.error || `Server error: ${response.status}`);
        }

        const data = await response.json();

        // Check for explicit error in 200 OK response (legacy bridge behavior)
        if (data.error) {
            throw new NetworkError(data.error);
        }

        if (!data.response) {
            throw new NetworkError('Empty response from AI');
        }
        return data;
    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw new NetworkError('Request superseded by newer request');
        }
        if (error instanceof NetworkError) throw error;
        throw new NetworkError('Failed to send chat');
    } finally {
        // Clear the controller if this was the active one
        if (activeChatController === currentController) {
            activeChatController = null;
        }
    }
}
