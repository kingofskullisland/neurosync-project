/**
 * Von Agent - Settings Screen
 */
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { GlitchText } from '../components/GlitchText';
import { NeonButton } from '../components/NeonButton';
import { StatusPill } from '../components/StatusPill';
import { checkHealth, getModels } from '../lib/api';
import { AppSettings, loadSettings, saveSettings } from '../lib/storage';

export default function SettingsScreen() {
    const [settings, setSettings] = useState<AppSettings>({
        pcIp: '',
        vpnIp: '',
        bridgePort: 8082,
        routeMode: 'auto',
        batteryThreshold: 20,
        charThreshold: 100,
        selectedModel: 'llama3',
    });
    const [models, setModels] = useState<string[]>([]);
    const [testing, setTesting] = useState(false);
    const [status, setStatus] = useState<'online' | 'offline' | 'connecting'>('offline');

    useEffect(() => {
        loadSettings().then(s => setSettings(s));
    }, []);

    const handleTest = async () => {
        const ip = settings.vpnIp || settings.pcIp;
        if (!ip) {
            Alert.alert('Error', 'Enter a server IP first');
            return;
        }

        setTesting(true);
        setStatus('connecting');

        try {
            const health = await checkHealth(ip);
            setStatus(health.status === 'online' ? 'online' : 'offline');

            if (health.ollama === 'connected') {
                const modelData = await getModels(ip);
                setModels(modelData.models?.map(m => m.name) || []);
            }

            Alert.alert('Success', `Bridge: ${health.status}\nOllama: ${health.ollama}`);
        } catch (error: any) {
            setStatus('offline');
            Alert.alert('Connection Failed', error.message);
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        try {
            await saveSettings(settings);
            Alert.alert('Saved', 'Settings saved successfully');
            router.back();
        } catch (error) {
            Alert.alert('Error', 'Failed to save settings');
        }
    };

    const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <KeyboardAvoidingView
            className="flex-1 bg-cyber-bg"
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {/* Header */}
            <View className="pt-12 pb-4 px-4 border-b border-cyber-border flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="p-2 mr-3">
                    <Text className="text-neon-cyan text-2xl">←</Text>
                </TouchableOpacity>
                <GlitchText text="CONFIG" size="md" />
                <View className="flex-1" />
                <StatusPill label="Bridge" status={status} />
            </View>

            <ScrollView className="flex-1 px-4 py-6" keyboardShouldPersistTaps="handled">
                {/* Server Section */}
                <Text className="text-neon-cyan text-sm font-mono font-bold mb-4 uppercase tracking-wider">
                    Server Connection
                </Text>

                <View className="mb-4">
                    <Text className="text-slate-400 text-xs font-mono mb-2 uppercase">PC IP Address</Text>
                    <TextInput
                        className="bg-cyber-card border border-cyber-border rounded px-4 py-3 text-slate-200 font-mono"
                        value={settings.pcIp}
                        onChangeText={(v) => updateSetting('pcIp', v)}
                        placeholder="192.168.1.100"
                        placeholderTextColor="#556"
                        keyboardType="numbers-and-punctuation"
                        autoCapitalize="none"
                    />
                </View>

                <View className="mb-4">
                    <Text className="text-slate-400 text-xs font-mono mb-2 uppercase">VPN/Tailscale IP</Text>
                    <TextInput
                        className="bg-cyber-card border border-cyber-border rounded px-4 py-3 text-slate-200 font-mono"
                        value={settings.vpnIp}
                        onChangeText={(v) => updateSetting('vpnIp', v)}
                        placeholder="100.x.x.x"
                        placeholderTextColor="#556"
                        keyboardType="numbers-and-punctuation"
                        autoCapitalize="none"
                    />
                    <Text className="text-slate-500 text-xs mt-1">Takes priority over PC IP</Text>
                </View>

                <View className="mb-6">
                    <NeonButton title="Test Connection" onPress={handleTest} loading={testing} variant="cyan" />
                </View>

                {/* Route Mode */}
                <Text className="text-neon-cyan text-sm font-mono font-bold mb-4 uppercase tracking-wider mt-4">
                    Route Mode
                </Text>

                <View className="flex-row flex-wrap gap-2 mb-6">
                    {(['auto', 'local', 'pc', 'cloud'] as const).map(mode => (
                        <TouchableOpacity
                            key={mode}
                            onPress={() => updateSetting('routeMode', mode)}
                            className={`px-4 py-2 rounded border ${settings.routeMode === mode
                                    ? 'bg-neon-cyan/20 border-neon-cyan'
                                    : 'bg-cyber-card border-cyber-border'
                                }`}
                        >
                            <Text className={`font-mono uppercase text-sm ${settings.routeMode === mode ? 'text-neon-cyan' : 'text-slate-400'
                                }`}>
                                {mode}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Thresholds */}
                <Text className="text-neon-cyan text-sm font-mono font-bold mb-4 uppercase tracking-wider">
                    Auto Mode Thresholds
                </Text>

                <View className="flex-row gap-4 mb-6">
                    <View className="flex-1">
                        <Text className="text-slate-400 text-xs font-mono mb-2 uppercase">Battery %</Text>
                        <TextInput
                            className="bg-cyber-card border border-cyber-border rounded px-4 py-3 text-slate-200 font-mono"
                            value={String(settings.batteryThreshold)}
                            onChangeText={(v) => updateSetting('batteryThreshold', parseInt(v) || 0)}
                            keyboardType="number-pad"
                            maxLength={3}
                        />
                    </View>
                    <View className="flex-1">
                        <Text className="text-slate-400 text-xs font-mono mb-2 uppercase">Char Limit</Text>
                        <TextInput
                            className="bg-cyber-card border border-cyber-border rounded px-4 py-3 text-slate-200 font-mono"
                            value={String(settings.charThreshold)}
                            onChangeText={(v) => updateSetting('charThreshold', parseInt(v) || 0)}
                            keyboardType="number-pad"
                            maxLength={4}
                        />
                    </View>
                </View>

                {/* Model Selection */}
                <Text className="text-neon-cyan text-sm font-mono font-bold mb-4 uppercase tracking-wider">
                    AI Model
                </Text>

                <View className="mb-4">
                    <TextInput
                        className="bg-cyber-card border border-cyber-border rounded px-4 py-3 text-slate-200 font-mono"
                        value={settings.selectedModel}
                        onChangeText={(v) => updateSetting('selectedModel', v)}
                        placeholder="llama3"
                        placeholderTextColor="#556"
                        autoCapitalize="none"
                    />
                    {models.length > 0 && (
                        <View className="flex-row flex-wrap gap-2 mt-2">
                            {models.slice(0, 5).map(m => (
                                <TouchableOpacity
                                    key={m}
                                    onPress={() => updateSetting('selectedModel', m)}
                                    className="px-3 py-1 bg-cyber-card border border-cyber-border rounded"
                                >
                                    <Text className="text-slate-400 text-xs font-mono">{m}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* Save Button */}
                <View className="mt-8 mb-10">
                    <NeonButton title="Save Settings" onPress={handleSave} variant="green" />
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
