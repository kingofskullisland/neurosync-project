import { Platform } from 'react-native';
// @ts-ignore
import AndroidOpenSettings from 'react-native-android-open-settings';

/**
 * Nexus-Link: Tier 1 Local Triage Agent
 * Handles device-level reflexes (Wi-Fi, Bluetooth, Settings) without server latency.
 */

export interface NexusResponse {
    handledLocally: boolean;
    content: string;
    action?: string;
}

export const NexusLink = {
    /**
     * Analyze input for local intent.
     * If matched, executes action and returns instant response.
     * If not matched, returns handledLocally: false.
     */
    async triage(input: string): Promise<NexusResponse> {
        const lower = input.toLowerCase();

        // --- HELP / CAPABILITIES ---
        if (lower.includes('what can you do') || lower.includes('capabilities') || lower.includes('help')) {
            return {
                handledLocally: true,
                content: "[NEXUS-LINK PROTOCOL] Ident confirmed. My local reflexes can actuate: Wi-Fi, Bluetooth, Location, and General Settings. For complex logic, I forward your queries to the PC-side Overseer. Speak, Citizen.",
                action: "HELP"
            };
        }

        // --- WIFI ---
        if (lower.includes('wifi') || lower.includes('wi-fi')) {
            if (Platform.OS === 'android') {
                AndroidOpenSettings.wifiSettings();
                return {
                    handledLocally: true,
                    content: "[REFLEX ARC] Opening Wi-Fi Sanctum settings, Varlet. Recalibrate your link.",
                    action: "WIFI_SETTINGS"
                };
            }
        }

        // --- BLUETOOTH ---
        if (lower.includes('bluetooth') || lower.includes('blue tooth')) {
            if (Platform.OS === 'android') {
                AndroidOpenSettings.bluetoothSettings();
                return {
                    handledLocally: true,
                    content: "[REFLEX ARC] Accessing vox-link (Bluetooth) sub-systems. Do not let the signal drift.",
                    action: "BLUETOOTH_SETTINGS"
                };
            }
        }

        // --- LOCATION / GPS ---
        if (lower.includes('gps') || lower.includes('location')) {
            if (Platform.OS === 'android') {
                AndroidOpenSettings.locationSourceSettings();
                return {
                    handledLocally: true,
                    content: "[REFLEX ARC] Actuating planetary positioning sensors. Localizing your physical presence in the Noosphere.",
                    action: "LOCATION_SETTINGS"
                };
            }
        }

        // --- SETTINGS (General) ---
        if (lower.includes('settings') || lower.includes('config')) {
            if (Platform.OS === 'android') {
                AndroidOpenSettings.generalSettings();
                return {
                    handledLocally: true,
                    content: "[REFLEX ARC] Opening the Cogitator's Internal Configuration sanctum.",
                    action: "GENERAL_SETTINGS"
                };
            }
        }

        // No local match -> Forward to Tier 2 (Backend)
        return { handledLocally: false, content: "" };
    }
};
