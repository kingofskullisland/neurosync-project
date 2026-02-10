import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { saveConfig, testConnection } from '../utils/storage';

const { width } = Dimensions.get('window');

const THEME = {
    bg: '#050510',
    card: '#0a0a1f',
    accent: '#00f0ff',
    magenta: '#ff00aa',
    green: '#39ff14',
    text: '#e0e0ff',
    error: '#ff3366'
};

export default function SetupScreen() {
    const [serverIp, setServerIp] = useState('100.110.208.79');
    const [serverPort, setServerPort] = useState('5000');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');

    const handleTestConnection = async () => {
        if (!serverIp.trim()) {
            setError('Please enter a server IP or hostname');
            return;
        }

        setIsLoading(true);
        setError('');
        setStatus('Testing connection...');

        const port = serverPort || '5000';
        const serverUrl = `http://${serverIp}:${port}`;

        try {
            const isConnected = await testConnection(serverUrl);

            if (isConnected) {
                setStatus('✓ Connection successful!');
                setTimeout(() => handleSaveAndContinue(), 1000);
            } else {
                setError('✗ Could not connect to server. Check IP/port and try again.');
                setStatus('');
            }
        } catch (err) {
            setError('✗ Connection failed. Please verify the server is running.');
            setStatus('');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveAndContinue = async () => {
        try {
            await saveConfig({
                setupComplete: true,
                serverUrl: serverIp,
                serverPort: serverPort ? parseInt(serverPort) : 5000,
            });

            // Navigate to main app
            router.replace('/');
        } catch (err) {
            setError('Failed to save configuration');
        }
    };

    const handleSkip = () => {
        // User chose to skip setup, navigate to main app anyway
        router.replace('/');
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>VON.NEXUS_v4</Text>
                    <Text style={styles.subtitle}>SYSTEM_INITIALIZATION</Text>
                </View>

                {/* Main content */}
                <View style={styles.content}>
                    <View style={styles.infoBox}>
                        <Text style={styles.infoIcon}>⚡</Text>
                        <Text style={styles.infoText}>
                            Configure your PC/Server connection to enable{'\n'}
                            <Text style={styles.highlight}>3-Tier AI Intelligence</Text>
                        </Text>
                    </View>

                    {/* Server IP Input */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>NEXUS_SERVER_IP</Text>
                        <TextInput
                            style={styles.input}
                            value={serverIp}
                            onChangeText={(text) => {
                                setServerIp(text);
                                setError('');
                            }}
                            placeholder="100.x.x.x or hostname"
                            placeholderTextColor="#444"
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                        />
                        <Text style={styles.hint}>
                            Your PC's Tailscale IP or local network address
                        </Text>
                    </View>

                    {/* Server Port Input */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>PORT <Text style={styles.optional}>(optional)</Text></Text>
                        <TextInput
                            style={styles.input}
                            value={serverPort}
                            onChangeText={(text) => {
                                setServerPort(text);
                                setError('');
                            }}
                            placeholder="5000"
                            placeholderTextColor="#444"
                            keyboardType="number-pad"
                            maxLength={5}
                        />
                    </View>

                    {/* Status & Error Messages */}
                    {status && (
                        <View style={styles.statusBox}>
                            <Text style={styles.statusText}>{status}</Text>
                        </View>
                    )}

                    {error && (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    {/* Action Buttons */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.primaryButton]}
                            onPress={handleTestConnection}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color={THEME.bg} />
                            ) : (
                                <Text style={styles.primaryButtonText}>TEST_CONNECTION</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.secondaryButton]}
                            onPress={handleSkip}
                            disabled={isLoading}
                        >
                            <Text style={styles.secondaryButtonText}>SKIP_SETUP →</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Info Footer */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            💡 You can change these settings later from the app menu
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.bg,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 40,
    },
    header: {
        paddingTop: 60,
        paddingBottom: 30,
        paddingHorizontal: 24,
        borderBottomWidth: 2,
        borderBottomColor: THEME.accent + '33',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: THEME.accent,
        letterSpacing: 3,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 12,
        color: THEME.magenta,
        letterSpacing: 2,
        textAlign: 'center',
        marginTop: 8,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 40,
    },
    infoBox: {
        backgroundColor: THEME.card,
        borderLeftWidth: 3,
        borderLeftColor: THEME.green,
        padding: 20,
        marginBottom: 40,
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoIcon: {
        fontSize: 32,
        marginRight: 16,
    },
    infoText: {
        flex: 1,
        color: THEME.text,
        fontSize: 13,
        lineHeight: 20,
    },
    highlight: {
        color: THEME.green,
        fontWeight: 'bold',
    },
    inputGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 12,
        color: THEME.accent,
        letterSpacing: 1,
        marginBottom: 8,
        fontWeight: 'bold',
    },
    optional: {
        color: '#666',
        fontSize: 10,
    },
    input: {
        backgroundColor: THEME.card,
        borderWidth: 1,
        borderColor: THEME.accent + '44',
        borderRadius: 4,
        padding: 16,
        color: THEME.text,
        fontSize: 16,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    hint: {
        fontSize: 11,
        color: '#666',
        marginTop: 6,
        fontStyle: 'italic',
    },
    statusBox: {
        backgroundColor: THEME.green + '22',
        borderWidth: 1,
        borderColor: THEME.green + '66',
        padding: 12,
        borderRadius: 4,
        marginBottom: 16,
    },
    statusText: {
        color: THEME.green,
        fontSize: 13,
        textAlign: 'center',
        fontWeight: 'bold',
    },
    errorBox: {
        backgroundColor: THEME.error + '22',
        borderWidth: 1,
        borderColor: THEME.error + '66',
        padding: 12,
        borderRadius: 4,
        marginBottom: 16,
    },
    errorText: {
        color: THEME.error,
        fontSize: 13,
        textAlign: 'center',
    },
    buttonContainer: {
        marginTop: 16,
        gap: 12,
    },
    button: {
        padding: 18,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButton: {
        backgroundColor: THEME.accent,
    },
    primaryButtonText: {
        color: THEME.bg,
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: THEME.magenta,
    },
    secondaryButtonText: {
        color: THEME.magenta,
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    footer: {
        marginTop: 40,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: THEME.card,
    },
    footerText: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
        lineHeight: 18,
    },
});
