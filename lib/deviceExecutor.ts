/**
 * NeuroSync Device Executor
 * Executes device-targeted commands received from the PC host via Noosphere.
 * Maps incoming action payloads to Expo / React Native native APIs.
 */
import { Alert, Linking, Platform } from 'react-native';

// ─── Types ──────────────────────────────────────────────────

export interface DeviceCommand {
    action: string;
    params?: Record<string, any>;
    timestamp?: string;
}

export interface DeviceCommandResult {
    success: boolean;
    action: string;
    message?: string;
    error?: string;
    data?: any;
}

// ─── Flashlight ─────────────────────────────────────────────

let flashlightOn = false;

async function toggleFlashlight(params?: Record<string, any>): Promise<DeviceCommandResult> {
    try {
        // expo-camera provides torch mode control
        const { Camera } = await import('expo-camera');
        const { status } = await Camera.requestCameraPermissionsAsync();

        if (status !== 'granted') {
            return { success: false, action: 'toggle_flashlight', error: 'Camera permission denied' };
        }

        flashlightOn = !flashlightOn;
        // The actual torch toggle is handled by the CameraView component's
        // enableTorch prop — we broadcast the state change and let the UI react
        return {
            success: true,
            action: 'toggle_flashlight',
            message: flashlightOn ? 'Flashlight ON' : 'Flashlight OFF',
            data: { state: flashlightOn },
        };
    } catch (e: any) {
        return { success: false, action: 'toggle_flashlight', error: e.message };
    }
}

// ─── Camera ─────────────────────────────────────────────────

async function openCamera(params?: Record<string, any>): Promise<DeviceCommandResult> {
    try {
        const { Camera } = await import('expo-camera');
        const { status } = await Camera.requestCameraPermissionsAsync();

        if (status !== 'granted') {
            return { success: false, action: 'open_camera', error: 'Camera permission denied' };
        }

        // Signal UI to open camera view
        return {
            success: true,
            action: 'open_camera',
            message: 'Camera activated',
            data: { shouldOpenCamera: true },
        };
    } catch (e: any) {
        return { success: false, action: 'open_camera', error: e.message };
    }
}

// ─── Microphone ─────────────────────────────────────────────

let micRecording: any = null;

async function toggleMic(params?: Record<string, any>): Promise<DeviceCommandResult> {
    try {
        const { Audio } = await import('expo-av');

        if (micRecording) {
            // Stop recording
            await micRecording.stopAndUnloadAsync();
            const uri = micRecording.getURI();
            micRecording = null;
            return {
                success: true,
                action: 'toggle_mic',
                message: 'Recording stopped',
                data: { state: false, uri },
            };
        } else {
            // Start recording
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                return { success: false, action: 'toggle_mic', error: 'Microphone permission denied' };
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            micRecording = recording;

            return {
                success: true,
                action: 'toggle_mic',
                message: 'Recording started',
                data: { state: true },
            };
        }
    } catch (e: any) {
        return { success: false, action: 'toggle_mic', error: e.message };
    }
}

// ─── Screen Capture ─────────────────────────────────────────

async function captureScreen(params?: Record<string, any>): Promise<DeviceCommandResult> {
    try {
        // Signal UI to take a screenshot (requires react-native-view-shot or similar)
        return {
            success: true,
            action: 'capture_screen',
            message: 'Screen capture requested',
            data: { shouldCapture: true },
        };
    } catch (e: any) {
        return { success: false, action: 'capture_screen', error: e.message };
    }
}

// ─── Launch App ─────────────────────────────────────────────

const APP_SCHEMES: Record<string, string> = {
    browser: 'https://google.com',
    chrome: 'googlechrome://',
    youtube: 'vnd.youtube://',
    maps: 'geo:0,0?q=',
    phone: 'tel:',
    sms: 'sms:',
    email: 'mailto:',
    settings: Platform.OS === 'android' ? 'android.settings.SETTINGS' : 'App-Prefs:',
    camera: Platform.OS === 'android' ? 'intent:#Intent;action=android.media.action.STILL_IMAGE_CAMERA;end' : 'camera://',
    whatsapp: 'whatsapp://',
    telegram: 'tg://',
    spotify: 'spotify://',
    twitter: 'twitter://',
};

async function launchApp(params?: Record<string, any>): Promise<DeviceCommandResult> {
    const appName = params?.app?.toLowerCase()?.trim();

    if (!appName) {
        return {
            success: false,
            action: 'launch_app',
            error: 'Missing app name',
            data: { available_apps: Object.keys(APP_SCHEMES) },
        };
    }

    const scheme = APP_SCHEMES[appName];
    if (!scheme) {
        return {
            success: false,
            action: 'launch_app',
            error: `Unknown app: ${appName}`,
            data: { available_apps: Object.keys(APP_SCHEMES) },
        };
    }

    try {
        const url = params?.url || scheme;
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
            await Linking.openURL(url);
            return { success: true, action: 'launch_app', message: `Launched ${appName}` };
        } else {
            return { success: false, action: 'launch_app', error: `Cannot open ${appName} (not installed?)` };
        }
    } catch (e: any) {
        return { success: false, action: 'launch_app', error: e.message };
    }
}

// ─── Remote Start (Keep Awake) ──────────────────────────────

async function remoteStart(params?: Record<string, any>): Promise<DeviceCommandResult> {
    try {
        const KeepAwake = await import('expo-keep-awake');
        KeepAwake.activateKeepAwakeAsync('neurosync_remote');
        return {
            success: true,
            action: 'remote_start',
            message: 'Device wake-lock activated',
        };
    } catch (e: any) {
        // Fallback: just confirm the command was received
        return {
            success: true,
            action: 'remote_start',
            message: 'Remote start signal received (keep-awake unavailable)',
        };
    }
}

// ─── Action Dispatcher ──────────────────────────────────────

const ACTION_MAP: Record<string, (params?: Record<string, any>) => Promise<DeviceCommandResult>> = {
    toggle_flashlight: toggleFlashlight,
    open_camera: openCamera,
    toggle_mic: toggleMic,
    capture_screen: captureScreen,
    launch_app: launchApp,
    remote_start: remoteStart,
};

/**
 * Execute a device command received from the PC host.
 */
export async function executeDeviceCommand(command: DeviceCommand): Promise<DeviceCommandResult> {
    const handler = ACTION_MAP[command.action];

    if (!handler) {
        return {
            success: false,
            action: command.action,
            error: `Unknown Android action: ${command.action}`,
            data: { available_actions: Object.keys(ACTION_MAP) },
        };
    }

    console.log(`⚡ [DEVICE_EXEC] ${command.action}(${JSON.stringify(command.params || {})})`);

    try {
        const result = await handler(command.params);

        // Show user-visible feedback
        if (result.success && result.message) {
            Alert.alert('⚡ NeuroSync', result.message);
        } else if (!result.success && result.error) {
            Alert.alert('⚠️ Command Failed', result.error);
        }

        return result;
    } catch (e: any) {
        return { success: false, action: command.action, error: e.message };
    }
}

/**
 * Get list of supported actions.
 */
export function getSupportedActions(): string[] {
    return Object.keys(ACTION_MAP);
}
