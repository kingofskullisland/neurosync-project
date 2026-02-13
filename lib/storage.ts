/**
 * NeuroSync Storage — Extended with chat management
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'VON_AGENT_CONFIG';
const CHATS_INDEX_KEY = 'NEUROSYNC_CHATS_INDEX';
const CHAT_PREFIX = 'NEUROSYNC_CHAT_';
const MODEL_STATS_KEY = 'NEUROSYNC_MODEL_STATS';

// ─── Settings ───────────────────────────────────────────────

export interface AppSettings {
    pcIp: string;
    vpnIp: string;
    bridgePort: number;
    routeMode: 'auto' | 'local' | 'pc' | 'cloud';
    batteryThreshold: number;
    charThreshold: number;
    selectedModel: string;
    // New settings
    fontSize: number;
    autoSaveChats: boolean;
    modelMonitoring: boolean;
    maxChatHistory: number;
}

const DEFAULT_SETTINGS: AppSettings = {
    pcIp: '',
    vpnIp: '',
    bridgePort: 8082,
    routeMode: 'auto',
    batteryThreshold: 20,
    charThreshold: 100,
    selectedModel: 'llama3.2:latest',
    fontSize: 13,
    autoSaveChats: true,
    modelMonitoring: true,
    maxChatHistory: 50,
};

export async function loadSettings(): Promise<AppSettings> {
    try {
        const data = await AsyncStorage.getItem(SETTINGS_KEY);
        if (data) {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
        }
        return DEFAULT_SETTINGS;
    } catch (error) {
        console.error('Failed to load settings:', error);
        return DEFAULT_SETTINGS;
    }
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
    try {
        const current = await loadSettings();
        const updated = { ...current, ...settings };
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch (error) {
        console.error('Failed to save settings:', error);
        throw error;
    }
}

export async function clearSettings(): Promise<void> {
    try {
        await AsyncStorage.removeItem(SETTINGS_KEY);
    } catch (error) {
        console.error('Failed to clear settings:', error);
    }
}

export function getServerUrl(settings: AppSettings): string {
    const ip = settings.vpnIp || settings.pcIp;
    return ip ? `http://${ip}:${settings.bridgePort}` : '';
}

// ─── Chat Storage ───────────────────────────────────────────

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    route?: string;
    model?: string;
    timestamp: number;
}

export interface ChatMeta {
    id: string;
    title: string;
    date: number;
    messageCount: number;
    model?: string;
}

export async function saveChatMessages(chatId: string, messages: ChatMessage[]): Promise<void> {
    try {
        await AsyncStorage.setItem(CHAT_PREFIX + chatId, JSON.stringify(messages));
        // Update index
        const index = await loadChatIndex();
        const firstMsg = messages.find((m) => m.role === 'user');
        const existing = index.findIndex((c) => c.id === chatId);
        const meta: ChatMeta = {
            id: chatId,
            title: firstMsg?.content.substring(0, 60) || 'New Chat',
            date: Date.now(),
            messageCount: messages.length,
            model: messages.find((m) => m.model)?.model,
        };
        if (existing >= 0) {
            index[existing] = meta;
        } else {
            index.unshift(meta);
        }
        await AsyncStorage.setItem(CHATS_INDEX_KEY, JSON.stringify(index));
    } catch (error) {
        console.error('Failed to save chat:', error);
    }
}

export async function loadChatIndex(): Promise<ChatMeta[]> {
    try {
        const data = await AsyncStorage.getItem(CHATS_INDEX_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export async function loadChatMessages(chatId: string): Promise<ChatMessage[]> {
    try {
        const data = await AsyncStorage.getItem(CHAT_PREFIX + chatId);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export async function deleteChat(chatId: string): Promise<void> {
    try {
        await AsyncStorage.removeItem(CHAT_PREFIX + chatId);
        const index = await loadChatIndex();
        const filtered = index.filter((c) => c.id !== chatId);
        await AsyncStorage.setItem(CHATS_INDEX_KEY, JSON.stringify(filtered));
    } catch (error) {
        console.error('Failed to delete chat:', error);
    }
}

export async function clearAllChats(): Promise<void> {
    try {
        const index = await loadChatIndex();
        const keys = index.map((c) => CHAT_PREFIX + c.id);
        keys.push(CHATS_INDEX_KEY);
        await AsyncStorage.multiRemove(keys);
    } catch (error) {
        console.error('Failed to clear chats:', error);
    }
}

// ─── Model Stats ────────────────────────────────────────────

export interface ModelStats {
    name: string;
    totalRequests: number;
    totalErrors: number;
    avgResponseTime: number;
    lastUsed: number;
    responseTimes: number[]; // last 20 response times
}

export async function loadModelStats(): Promise<Record<string, ModelStats>> {
    try {
        const data = await AsyncStorage.getItem(MODEL_STATS_KEY);
        return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
}

export async function recordModelRequest(
    modelName: string,
    responseTimeMs: number,
    isError: boolean
): Promise<void> {
    try {
        const stats = await loadModelStats();
        const existing = stats[modelName] || {
            name: modelName,
            totalRequests: 0,
            totalErrors: 0,
            avgResponseTime: 0,
            lastUsed: 0,
            responseTimes: [],
        };

        existing.totalRequests += 1;
        if (isError) existing.totalErrors += 1;
        existing.lastUsed = Date.now();

        if (!isError) {
            existing.responseTimes.push(responseTimeMs);
            if (existing.responseTimes.length > 20) {
                existing.responseTimes = existing.responseTimes.slice(-20);
            }
            existing.avgResponseTime =
                existing.responseTimes.reduce((a, b) => a + b, 0) / existing.responseTimes.length;
        }

        stats[modelName] = existing;
        await AsyncStorage.setItem(MODEL_STATS_KEY, JSON.stringify(stats));
    } catch (error) {
        console.error('Failed to record model stats:', error);
    }
}
