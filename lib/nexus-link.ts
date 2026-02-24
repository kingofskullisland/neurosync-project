import { Platform } from 'react-native';
// @ts-ignore
import AndroidOpenSettings from 'react-native-android-open-settings';

/**
 * HyperAI: Tier 1 Local Triage Agent
 * Handles device-level reflexes (Wi-Fi, Bluetooth, Settings) without server latency.
 */

export interface NexusResponse {
    handledLocally: boolean;
    content: string;
    action?: string;
    /** If set, HyperAI wants the PC to process this prompt on its behalf */
    syntheticPrompt?: string;
}

export const HyperAI = {
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
                content: "[HYPER-AI PROTOCOL] Ident confirmed. My local reflexes can actuate: Wi-Fi, Bluetooth, Location, and General Settings. For complex logic, I forward your queries to the PC-side Overseer. Speak, Citizen.",
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

        // ─── DELEGATION TRIGGERS ──────────────────────────────────
        // HyperAI intercepts these locally but constructs a synthetic
        // prompt to offload heavy compute to the PC-side model.

        // --- DEEP RESEARCH / ANALYSIS ---
        if (lower.includes('research') || lower.includes('analyze') || lower.includes('analyse') || lower.includes('deep dive')) {
            return {
                handledLocally: true,
                content: "[HYPER-AI] Heavy cogitation detected. Routing to PC Logic Engine for deep analysis...",
                action: "DELEGATE_TO_PC",
                syntheticPrompt: `The user requests a thorough analysis. Their query: "${input}". Provide a detailed, structured response with key findings, implications, and actionable insights.`
            };
        }

        // --- CODE GENERATION / DEBUGGING ---
        if (lower.includes('write code') || lower.includes('debug') || lower.includes('write a script') || lower.includes('fix this code') || lower.includes('refactor')) {
            return {
                handledLocally: true,
                content: "[HYPER-AI] Code generation request intercepted. Delegating to PC Logic Engine...",
                action: "DELEGATE_TO_PC",
                syntheticPrompt: `The user needs code assistance. Their request: "${input}". Provide clean, well-commented code with explanations.`
            };
        }

        // --- SUMMARIZATION ---
        if (lower.includes('summarize') || lower.includes('summarise') || lower.includes('tldr') || lower.includes('sum up')) {
            return {
                handledLocally: true,
                content: "[HYPER-AI] Summarization request logged. Offloading to PC for processing...",
                action: "DELEGATE_TO_PC",
                syntheticPrompt: `The user wants a concise summary. Their input: "${input}". Provide a clear, bullet-pointed summary capturing all key points.`
            };
        }

        // --- EXPLANATION ---
        if (lower.includes('explain') || lower.includes('how does') || lower.includes('what is') || lower.includes('define')) {
            return {
                handledLocally: true,
                content: "[HYPER-AI] Knowledge query detected. Consulting PC Logic Engine...",
                action: "DELEGATE_TO_PC",
                syntheticPrompt: `The user is asking for an explanation. Their question: "${input}". Provide a clear, thorough explanation suitable for someone with intermediate technical knowledge.`
            };
        }

        // --- COMPARISON ---
        if (lower.includes('compare') || lower.includes('difference between') || lower.includes('vs') || lower.includes('versus')) {
            return {
                handledLocally: true,
                content: "[HYPER-AI] Comparative analysis requested. Delegating to PC...",
                action: "DELEGATE_TO_PC",
                syntheticPrompt: `The user wants a comparison. Their query: "${input}". Provide a structured comparison with pros, cons, and a recommendation.`
            };
        }

        // --- TRANSLATION ---
        if (lower.includes('translate') || lower.includes('translation')) {
            return {
                handledLocally: true,
                content: "[HYPER-AI] Translation request intercepted. Routing to PC Logic Engine...",
                action: "DELEGATE_TO_PC",
                syntheticPrompt: `The user needs a translation. Their request: "${input}". Provide an accurate translation and note any nuances.`
            };
        }

        // No local match -> Forward to Tier 2 (Backend) directly
        return { handledLocally: false, content: "" };
    }
};
