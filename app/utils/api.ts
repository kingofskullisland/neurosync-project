/**
 * NEXUS OS API Client
 * Network layer for connecting to Python/Ollama bridge
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface HealthResponse {
    status: string;
    system: string;
    ollama: 'connected' | 'unreachable';
}

export interface ChatResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
    route?: string;  // Routing target
    complexity?: number;  // Complexity score
    reasoning?: string;  // Routing decision explanation
    persona?: 'SPARK' | 'CORE';  // AI persona
}

export interface ChatRequest {
    prompt: string;
    model?: string;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    persona?: 'SPARK' | 'CORE';  // AI persona
    reasoning?: string;  // Routing reasoning
}

export class NetworkError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NetworkError';
    }
}

// ============================================================================
// FETCH WITH TIMEOUT
// ============================================================================

/**
 * Fetch wrapper with timeout support using AbortController
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param timeout - Timeout in milliseconds (default: 5000ms)
 * @returns Promise resolving to Response
 * @throws NetworkError on timeout or connection failure
 */
export async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout: number = 5000
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
            throw new NetworkError('Connection Timed Out. Check Tailscale link.');
        }

        throw new NetworkError('Cannot reach NEXUS bridge. Is the PC running?');
    }
}

// ============================================================================
// NEXUS API CLIENT
// ============================================================================

export class NexusAPI {
    private static readonly PORT = 8082;
    private static readonly HEALTH_TIMEOUT = 5000;
    private static readonly CHAT_TIMEOUT = 60000;

    /**
     * Build the base URL from an IP address
     * @param ip - Server IP (e.g., "100.110.208.79")
     * @returns Full URL (e.g., "http://100.110.208.79:8082")
     */
    private static buildUrl(ip: string): string {
        // Ensure IP doesn't already have protocol
        const cleanIp = ip.replace(/^https?:\/\//, '');
        return `http://${cleanIp}:${this.PORT}`;
    }

    /**
     * Test connection to NEXUS bridge
     * @param ip - Server IP address
     * @returns Health status or throws NetworkError
     */
    static async testConnection(ip: string): Promise<HealthResponse> {
        const url = `${this.buildUrl(ip)}/health`;

        try {
            const response = await fetchWithTimeout(
                url,
                { method: 'GET' },
                this.HEALTH_TIMEOUT
            );

            if (!response.ok) {
                throw new NetworkError(
                    `Bridge returned error: ${response.status} ${response.statusText}`
                );
            }

            const data = await response.json();
            return data as HealthResponse;
        } catch (error) {
            if (error instanceof NetworkError) {
                throw error;
            }
            throw new NetworkError('Failed to parse health response');
        }
    }

    /**
     * Send a chat prompt to the AI
     * @param ip - Server IP address
     * @param prompt - User's message
     * @param model - Model name (default: "llama3")
     * @returns AI response or throws NetworkError
     */
    static async sendPrompt(
        ip: string,
        prompt: string,
        model: string = 'llama3'
    ): Promise<ChatResponse> {
        const url = `${this.buildUrl(ip)}/chat`;

        const requestBody: ChatRequest = {
            prompt,
            model,
        };

        try {
            const response = await fetchWithTimeout(
                url,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                },
                this.CHAT_TIMEOUT
            );

            if (!response.ok) {
                // Handle specific error codes
                if (response.status === 503) {
                    throw new NetworkError('AI model unavailable. Start Alpaca on PC.');
                }
                if (response.status === 504) {
                    throw new NetworkError('AI processing timed out. Try a simpler prompt.');
                }

                const errorData = await response.json().catch(() => ({}));
                const errorMsg = errorData.error || `Server error: ${response.status}`;
                throw new NetworkError(errorMsg);
            }

            const data = await response.json();

            // Validate response has required fields
            if (!data.response) {
                throw new NetworkError('AI returned empty response. Try again.');
            }

            return data as ChatResponse;
        } catch (error) {
            if (error instanceof NetworkError) {
                throw error;
            }
            throw new NetworkError('Failed to communicate with AI');
        }
    }
}
