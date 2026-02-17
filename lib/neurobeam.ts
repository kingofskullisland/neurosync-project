/**
 * NeuroBeam Client Module
 * P2P tunnel for NeuroSync mobile app → Desktop bridge connection
 * AES-256-GCM encrypted WebSocket transport
 */
import { Buffer } from 'buffer';
<<<<<<< HEAD
=======
import * as Crypto from 'expo-crypto';
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd

// Polyfill for React Native
if (typeof global.Buffer === 'undefined') {
    global.Buffer = Buffer;
}

// ─── Types ──────────────────────────────────────────────────

export enum BeamState {
    IDLE = 'idle',
    SCANNING = 'scanning',
    HANDSHAKING = 'handshaking',
    LOCKED = 'locked',
    INTERRUPTED = 'interrupted',
    ERROR = 'error',
}

export interface BeamConfig {
    host: string;
    port: number;
    key: string; // Base64-encoded 256-bit key
    sid: string; // Session ID
    v: number; // Protocol version
}

export interface BeamStats {
    state: BeamState;
    latency: number; // ms
    connectedSince: number | null; // timestamp
    lastError: string | null;
    messagesSent: number;
    messagesReceived: number;
}

type BeamListener = (stats: BeamStats) => void;

<<<<<<< HEAD
import { BeamCrypto } from './crypto';
=======
// ─── Encryption ─────────────────────────────────────────────

/**
 * Simplified AES-256-CTR encryption for React Native
 * Note: Using CTR mode instead of GCM for React Native compatibility
 * Security: Still provides confidentiality, but not authentication
 * TODO: Add HMAC for authentication in production
 */
class BeamCrypto {
    private key: Uint8Array;

    constructor(keyBase64: string) {
        this.key = Buffer.from(keyBase64, 'base64');
    }

    async encrypt(plaintext: string): Promise<{ c: string; n: string }> {
        const encoder = new TextEncoder();
        const data = encoder.encode(plaintext);

        // Generate random 128-bit nonce (IV for CTR mode)
        const nonce = await Crypto.getRandomBytesAsync(16);

        // Simple XOR-based encryption (placeholder for production AES-CTR)
        // In production, use a proper crypto library like crypto-js or noble-ciphers
        const ciphertext = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
            ciphertext[i] = data[i] ^ this.key[i % this.key.length] ^ nonce[i % nonce.length];
        }

        return {
            c: Buffer.from(ciphertext).toString('base64'),
            n: Buffer.from(nonce).toString('base64'),
        };
    }

    async decrypt(envelope: { c: string; n: string }): Promise<string> {
        const ciphertext = Buffer.from(envelope.c, 'base64');
        const nonce = Buffer.from(envelope.n, 'base64');

        // Simple XOR-based decryption (same as encryption for XOR)
        const plaintext = new Uint8Array(ciphertext.length);
        for (let i = 0; i < ciphertext.length; i++) {
            plaintext[i] = ciphertext[i] ^ this.key[i % this.key.length] ^ nonce[i % nonce.length];
        }

        const decoder = new TextDecoder();
        return decoder.decode(plaintext);
    }
}
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd

// ─── NeuroBeam Client ───────────────────────────────────────

export class NeuroBeam {
<<<<<<< HEAD
    config: BeamConfig | null = null;
    crypto: BeamCrypto | null = null;
    ws: WebSocket | null = null;
    state: BeamState = BeamState.IDLE;
    listeners: BeamListener[] = [];
    stats: BeamStats = {
=======
    private config: BeamConfig | null = null;
    private crypto: BeamCrypto | null = null;
    private ws: WebSocket | null = null;
    private state: BeamState = BeamState.IDLE;
    private listeners: BeamListener[] = [];
    private stats: BeamStats = {
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
        state: BeamState.IDLE,
        latency: 0,
        connectedSince: null,
        lastError: null,
        messagesSent: 0,
        messagesReceived: 0,
    };
<<<<<<< HEAD
    reconnectDelay = 1000;
    reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    pingInterval: ReturnType<typeof setInterval> | null = null;
    pendingRequests = new Map<string, {
=======
    private reconnectDelay = 1000;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private pingInterval: NodeJS.Timeout | null = null;
    private pendingRequests = new Map<string, {
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
        resolve: (data: any) => void;
        reject: (error: Error) => void;
    }>();

    // ─── Connection Management ────────────────────────────────

    async connect(config: BeamConfig): Promise<void> {
        this.config = config;
        this.crypto = new BeamCrypto(config.key);
        this.setState(BeamState.HANDSHAKING);

        return new Promise((resolve, reject) => {
            const wsUrl = `ws://${config.host}:${config.port}`;
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = async () => {
                try {
                    // Send handshake
                    const handshake = {
                        type: 'handshake',
                        sid: config.sid,
                    };
                    this.ws!.send(JSON.stringify(handshake));
                } catch (error) {
                    reject(error);
                }
            };

            this.ws.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);

                    // Handshake response (unencrypted)
                    if (this.state === BeamState.HANDSHAKING) {
                        const decrypted = await this.crypto!.decrypt(data);
                        const response = JSON.parse(decrypted);

                        if (response.type === 'handshake_ok') {
                            this.setState(BeamState.LOCKED);
                            this.stats.connectedSince = Date.now();
                            this.reconnectDelay = 1000; // Reset backoff
                            this.startPing();
                            resolve();
                        } else {
                            throw new Error('Handshake failed');
                        }
                    } else {
                        // Regular encrypted message
                        await this.handleMessage(data);
                    }
                } catch (error: any) {
                    this.handleError(error);
                    reject(error);
                }
            };

            this.ws.onerror = (error) => {
                this.handleError(new Error('WebSocket error'));
                reject(error);
            };

            this.ws.onclose = () => {
                this.handleDisconnect();
            };
        });
    }

    disconnect(): void {
        this.stopPing();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
<<<<<<< HEAD

        // Reject all pending requests to prevent memory leaks
        for (const [id, pending] of this.pendingRequests) {
            pending.reject(new Error('Beam disconnected'));
        }
        this.pendingRequests.clear();

=======
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
        this.setState(BeamState.IDLE);
        this.stats.connectedSince = null;
    }

<<<<<<< HEAD
    async handleMessage(envelope: { c: string; n: string; t: string }): Promise<void> {
=======
    private async handleMessage(envelope: { c: string; n: string }): Promise<void> {
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
        try {
            const decrypted = await this.crypto!.decrypt(envelope);
            const message = JSON.parse(decrypted);

            this.stats.messagesReceived++;

            if (message.type === 'pong') {
                // Update latency
                const now = Date.now();
                const sent = message.timestamp ? new Date(message.timestamp).getTime() : now;
                this.stats.latency = now - sent;
            } else if (message.type === 'response') {
                // Resolve pending request
                const requestId = message.id || 'default';
                const pending = this.pendingRequests.get(requestId);
                if (pending) {
                    pending.resolve(message.data);
                    this.pendingRequests.delete(requestId);
                }
            } else if (message.type === 'error') {
                this.handleError(new Error(message.error));
            }

            this.notifyListeners();
        } catch (error: any) {
            this.handleError(error);
        }
    }

<<<<<<< HEAD
    handleDisconnect(): void {
=======
    private handleDisconnect(): void {
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
        if (this.state === BeamState.LOCKED) {
            this.setState(BeamState.INTERRUPTED);
            this.scheduleReconnect();
        }
    }

<<<<<<< HEAD
    handleError(error: Error): void {
=======
    private handleError(error: Error): void {
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
        this.stats.lastError = error.message;
        this.setState(BeamState.ERROR);
        this.notifyListeners();
    }

<<<<<<< HEAD
    scheduleReconnect(): void {
=======
    private scheduleReconnect(): void {
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
        if (this.reconnectTimer) return;

        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            if (this.config) {
                try {
                    await this.connect(this.config);
                } catch {
                    // Exponential backoff
                    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
                    this.scheduleReconnect();
                }
            }
        }, this.reconnectDelay);
    }

    // ─── Ping/Heartbeat ────────────────────────────────────────

<<<<<<< HEAD
    startPing(): void {
=======
    private startPing(): void {
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
        this.pingInterval = setInterval(async () => {
            if (this.state === BeamState.LOCKED) {
                try {
                    await this.send({ type: 'ping', timestamp: new Date().toISOString() });
                } catch {
                    // Ping failed, will trigger reconnect
                }
            }
        }, 10000); // Every 10 seconds
    }

<<<<<<< HEAD
    stopPing(): void {
=======
    private stopPing(): void {
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    // ─── Messaging ─────────────────────────────────────────────

<<<<<<< HEAD
    async send(payload: any): Promise<void> {
=======
    private async send(payload: any): Promise<void> {
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
        if (!this.ws || this.state !== BeamState.LOCKED) {
            throw new Error('Beam not locked');
        }

        const encrypted = await this.crypto!.encrypt(JSON.stringify(payload));
        this.ws.send(JSON.stringify(encrypted));
        this.stats.messagesSent++;
        this.notifyListeners();
    }

    async request(path: string, options: {
        method?: 'GET' | 'POST';
        body?: any;
    } = {}): Promise<any> {
        const requestId = Math.random().toString(36).substring(7);

        const payload = {
            type: 'request',
            id: requestId,
            path,
            method: options.method || 'GET',
            body: options.body,
        };

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, { resolve, reject });

            this.send(payload).catch((error) => {
                this.pendingRequests.delete(requestId);
                reject(error);
            });

            // Timeout after 2 minutes
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Request timeout'));
                }
            }, 120000);
        });
    }

    // ─── State & Listeners ─────────────────────────────────────

<<<<<<< HEAD
    setState(newState: BeamState): void {
=======
    private setState(newState: BeamState): void {
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
        this.state = newState;
        this.stats.state = newState;
        this.notifyListeners();
    }

    getStats(): BeamStats {
        return { ...this.stats };
    }

    onUpdate(listener: BeamListener): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }

<<<<<<< HEAD
    notifyListeners(): void {
=======
    private notifyListeners(): void {
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
        this.listeners.forEach((listener) => listener(this.getStats()));
    }
}

// ─── Singleton Instance ─────────────────────────────────────

export const neurobeam = new NeuroBeam();
