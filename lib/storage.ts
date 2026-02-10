/**
 * Von Agent AsyncStorage helpers
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'VON_AGENT_CONFIG';

export interface AppSettings {
    pcIp: string;
    vpnIp: string;
    bridgePort: number;
    routeMode: 'auto' | 'local' | 'pc' | 'cloud';
    batteryThreshold: number;
    charThreshold: number;
    selectedModel: string;
}

const DEFAULT_SETTINGS: AppSettings = {
    pcIp: '',
    vpnIp: '',
    bridgePort: 8082,
    routeMode: 'auto',
    batteryThreshold: 20,
    charThreshold: 100,
    selectedModel: 'llama3',
};

/**
 * Load settings from storage
 */
export async function loadSettings(): Promise<AppSettings> {
    try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        if (data) {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
        }
        return DEFAULT_SETTINGS;
    } catch (error) {
        console.error('Failed to load settings:', error);
        return DEFAULT_SETTINGS;
    }
}

/**
 * Save settings to storage
 */
export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
    try {
        const current = await loadSettings();
        const updated = { ...current, ...settings };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
        console.error('Failed to save settings:', error);
        throw error;
    }
}

/**
 * Clear all settings
 */
export async function clearSettings(): Promise<void> {
    try {
        await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Failed to clear settings:', error);
    }
}

/**
 * Get server URL based on settings
 */
export function getServerUrl(settings: AppSettings): string {
    const ip = settings.vpnIp || settings.pcIp;
    return ip ? `http://${ip}:${settings.bridgePort}` : '';
}
