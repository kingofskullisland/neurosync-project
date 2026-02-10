import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'VON_AGENT_CONFIG';

export interface AppConfig {
    setupComplete: boolean;
    serverUrl: string;
    serverPort?: number;
    lastUpdated: number;
}

/**
 * Check if the initial setup has been completed
 */
export async function isSetupComplete(): Promise<boolean> {
    try {
        const config = await getConfig();
        return config?.setupComplete === true && !!config?.serverUrl;
    } catch (error) {
        console.error('Error checking setup status:', error);
        return false;
    }
}

/**
 * Get the current configuration
 */
export async function getConfig(): Promise<AppConfig | null> {
    try {
        const configString = await AsyncStorage.getItem(STORAGE_KEY);
        if (!configString) {
            return null;
        }
        return JSON.parse(configString) as AppConfig;
    } catch (error) {
        console.error('Error loading config:', error);
        return null;
    }
}

/**
 * Save the configuration
 */
export async function saveConfig(config: Partial<AppConfig>): Promise<void> {
    try {
        const existingConfig = await getConfig();
        const newConfig: AppConfig = {
            setupComplete: config.setupComplete ?? existingConfig?.setupComplete ?? false,
            serverUrl: config.serverUrl ?? existingConfig?.serverUrl ?? '',
            serverPort: config.serverPort ?? existingConfig?.serverPort,
            lastUpdated: Date.now(),
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    } catch (error) {
        console.error('Error saving config:', error);
        throw error;
    }
}

/**
 * Get the server URL from config, or return default
 */
export async function getServerUrl(): Promise<string> {
    try {
        const config = await getConfig();
        if (config?.serverUrl) {
            const port = config.serverPort ? `:${config.serverPort}` : ':5000';
            return `http://${config.serverUrl}${port}`;
        }
        // Fallback to hardcoded default
        return 'http://100.110.208.79:5000';
    } catch (error) {
        console.error('Error getting server URL:', error);
        return 'http://100.110.208.79:5000';
    }
}

/**
 * Clear all configuration (for reset/logout)
 */
export async function clearConfig(): Promise<void> {
    try {
        await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Error clearing config:', error);
        throw error;
    }
}

/**
 * Test connection to a server URL
 */
export async function testConnection(serverUrl: string): Promise<boolean> {
    try {
        const response = await fetch(`${serverUrl}/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        return response.ok;
    } catch (error) {
        console.error('Connection test failed:', error);
        return false;
    }
}
