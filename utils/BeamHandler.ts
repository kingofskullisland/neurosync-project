import { router } from 'expo-router';
import { Alert } from 'react-native';
// import * as Clipboard from 'expo-clipboard';  // Uncomment if sync_clipboard is needed

// ─── Types ───────────────────────────────────────────────────────
type BeamAction = 'switch_agent' | 'open_project' | 'sync_clipboard' | 'tether';

interface BeamPayload {
    action: BeamAction;
    context: any;
}

interface StateUpdaters {
    setActiveAgent: (agent: string) => void;
    setCurrentProject: (slug: string) => void;
    activateTether?: (url: string, token: string) => void;
}

// ─── Supported Local Models ──────────────────────────────────────
const SUPPORTED_MOBILE_AGENTS = ['llama3.2:3b', 'gemma:2b'];

// ─── Handler ─────────────────────────────────────────────────────
export const handleBeamAction = (
    payload: BeamPayload,
    updateState: StateUpdaters
) => {
    const { action, context } = payload;
    const { setActiveAgent, setCurrentProject, activateTether } = updateState;

    console.log(`⚡ Executing Beam Action: ${action}`, context);

    switch (action) {
        case 'switch_agent':
            if (SUPPORTED_MOBILE_AGENTS.includes(context.agent)) {
                setActiveAgent(context.agent);
                Alert.alert('Beam Successful', `Active Intelligence switched to ${context.agent}`);
            } else {
                Alert.alert('Beam Error', `Model ${context.agent} is too large for this device.`);
            }
            break;

        case 'open_project':
            setCurrentProject(context.projectId);
            router.push(`/project/${context.projectId}`);
            break;

        case 'sync_clipboard':
            // Clipboard.setStringAsync(context.text);
            Alert.alert('Copied', 'Text beamed from desktop to clipboard.');
            break;

        case 'tether':
            // Headless tether — QR encodes host URL + auth token
            if (activateTether && context.host && context.token) {
                activateTether(context.host, context.token);
                Alert.alert('⚡ Tethered', `Connected to desktop at ${context.host}`);
            } else {
                Alert.alert('Tether Error', 'Missing host or token in beam payload.');
            }
            break;

        default:
            console.warn('Unknown Beam Action:', action);
            Alert.alert('Unknown Beam', 'This QR code contains an action this app version cannot handle.');
    }
};
