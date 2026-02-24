/**
 * NeuroBeam Client Module
 * P2P tunnel for NeuroSync mobile app → Desktop bridge connection
 * AES-256-GCM encrypted WebSocket transport
 * + Device command routing via Noosphere link
 */
import { Buffer } from 'buffer';

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
type DeviceCommandHandler = (action: string, params: Record<string, any>) => Promise<any>;

import { BeamCrypto } from './crypto';

// ─── NeuroBeam Client ───────────────────────────────────────

export class NeuroBeam {
    config: BeamConfig | null = null;
    crypto: BeamCrypto | null = null;
    ws: WebSocket | null = null;
    state: BeamState = BeamState.IDLE;
    listeners: BeamListener[] = [];
    stats: BeamStats = {
        state: BeamState.IDLE,
        latency: 0,
        connectedSince: null,
        lastError: null,
        messagesSent: 0,
        messagesReceived: 0,
    };
    reconnectDelay = 1000;
    reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    pingInterval: ReturnType<typeof setInterval> | null = null;
    pendingRequests = new Map<string, {
        resolve: (data: any) => void;
        reject: (error: Error) => void;
    }>();
    deviceCommandHandler: DeviceCommandHandler | null = null;

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

        // Reject all pending requests to prevent memory leaks
        for (const [id, pending] of this.pendingRequests) {
            pending.reject(new Error('Beam disconnected'));
        }
        this.pendingRequests.clear();

        this.setState(BeamState.IDLE);
        this.stats.connectedSince = null;
    }

    async handleMessage(envelope: { c: string; n: string; t: string }): Promise<void> {
        try {
            const decrypted = await this.crypto!.decrypt(envelope);
            const message = JSON.parse(decrypted);

            this.stats.messagesReceived++;

            if (message.type === 'pong') {
                // Update latency
                const now = Date.now();
                const sent = message.timestamp ? new Date(message.timestamp).getTime() : now;
                this.stats.latency = now - sent;
            } else if (message.type === 'device_command') {
                // ⚡ Device command from PC host → route through Noosphere
                console.log(`⚡ [BEAM] Device command received: ${message.action}`);
                if (this.deviceCommandHandler) {
                    try {
                        const result = await this.deviceCommandHandler(message.action, message.params || {});
                        // Send result back to PC host
                        await this.sendCommandResult(message.action, result);
                    } catch (err: any) {
                        await this.sendCommandResult(message.action, {
                            success: false,
                            error: err.message,
                        });
                    }
                } else {
                    console.warn('[BEAM] No device command handler registered');
                }
            } else if (message.type === 'command_result') {
                // Result from a command we sent to the PC
                const requestId = message.id || 'command';
                const pending = this.pendingRequests.get(requestId);
                if (pending) {
                    pending.resolve(message.data);
                    this.pendingRequests.delete(requestId);
                }
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

    handleDisconnect(): void {
        if (this.state === BeamState.LOCKED) {
            this.setState(BeamState.INTERRUPTED);
            this.scheduleReconnect();
        }
    }

    handleError(error: Error): void {
        this.stats.lastError = error.message;
        this.setState(BeamState.ERROR);
        this.notifyListeners();
    }

    scheduleReconnect(): void {
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

    startPing(): void {
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

    stopPing(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    // ─── Messaging ─────────────────────────────────────────────

    async send(payload: any): Promise<void> {
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

    /**
     * Send a device command result back to the PC host.
     */
    async sendCommandResult(action: string, result: any): Promise<void> {
        await this.send({
            type: 'command_result',
            action,
            data: result,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Send a direct command to the PC host (bypass LLM).
     */
    async sendCommand(target: string, action: string, params: Record<string, any> = {}): Promise<any> {
        const requestId = Math.random().toString(36).substring(7);
        const payload = {
            type: 'command',
            id: requestId,
            target,
            action,
            params,
        };

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, { resolve, reject });
            this.send(payload).catch((error) => {
                this.pendingRequests.delete(requestId);
                reject(error);
            });
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Command timeout'));
                }
            }, 30000);
        });
    }

    /**
     * Register a handler for incoming device commands from the PC host.
     * This should be called by NoosphereContext to wire up the Noosphere link.
     */
    setDeviceCommandHandler(handler: DeviceCommandHandler): void {
        this.deviceCommandHandler = handler;
    }

    // ─── State & Listeners ─────────────────────────────────────

    setState(newState: BeamState): void {
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

    notifyListeners(): void {
        this.listeners.forEach((listener) => listener(this.getStats()));
    }
}

// ─── Singleton Instance ─────────────────────────────────────

export const neurobeam = new NeuroBeam();
