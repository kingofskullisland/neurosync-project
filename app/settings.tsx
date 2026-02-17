/**
 * NeuroSync — Settings Screen
 * Full menu system with submenus, model picker, FAQ, and config management
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    LayoutAnimation,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Switch,
    Text,
    TextInput,
    UIManager,
    View,
    ViewStyle
} from 'react-native';
import { BeamMonitor } from '../components/BeamMonitor';
import BeamScanner from '../components/BeamScanner'; // Modified default import
import { AkiraTitle } from '../components/GlitchText';
import { ModelMonitor } from '../components/ModelMonitor';
import { ModelPicker } from '../components/ModelPicker';
import { NeonButton } from '../components/NeonButton';
import { StatusPill } from '../components/StatusPill';
import { buildUrl, checkHealth } from '../lib/api';
import { FAQ_CATEGORIES, FAQ_DATA, FAQItem } from '../lib/faq';
import { BeamConfig, BeamState, BeamStats, neurobeam } from '../lib/neurobeam';
import {
    AppSettings,
    clearAllChats,
    loadChatIndex,
    loadSettings,
    saveSettings,
} from '../lib/storage';
import { COLORS, SHADOWS } from '../lib/theme';

// ENABLE ANDROID ANIMATION FLAGS
if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

type SectionKey = 'neurobeam' | 'connection' | 'model' | 'routing' | 'appearance' | 'chats' | 'faq' | 'about';

export default function SettingsScreen() {
    const [settings, setSettings] = useState<AppSettings>({
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
    });
    const [testing, setTesting] = useState(false);
    const [status, setStatus] = useState<'online' | 'offline' | 'connecting'>('offline');
    const [openSection, setOpenSection] = useState<SectionKey | null>(null);
    const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
    const [chatCount, setChatCount] = useState(0);
    const [hasChanges, setHasChanges] = useState(false);
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const [beamStats, setBeamStats] = useState<BeamStats>(neurobeam.getStats());
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [beamConfig, setBeamConfig] = useState<BeamConfig | null>(null);

    useEffect(() => {
        loadSettings().then((s) => {
            setSettings(s);
            setSettingsLoaded(true);
        });
        loadChatIndex().then((chats) => setChatCount(chats.length));

        // Subscribe to NeuroBeam updates
        const unsubscribe = neurobeam.onUpdate((stats) => {
            setBeamStats(stats);
        });

        return unsubscribe;
    }, []);

    const toggleSection = (key: SectionKey) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setOpenSection(openSection === key ? null : key);
    };

    const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

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
            Haptics.notificationAsync(
                health.status === 'online'
                    ? Haptics.NotificationFeedbackType.Success
                    : Haptics.NotificationFeedbackType.Error
            );
            Alert.alert(
                health.status === 'online' ? '✓ Connected' : '✗ Failed',
                `Bridge: ${health.status}\nOllama: ${health.ollama}`
            );
        } catch (error: any) {
            setStatus('offline');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Connection Failed', error.message);
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        try {
            await saveSettings(settings);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setHasChanges(false);
            Alert.alert('✓ Saved', 'Settings saved successfully');
        } catch (error) {
            Alert.alert('Error', 'Failed to save settings');
        }
    };

    const handleClearChats = () => {
        Alert.alert('Clear All Chats', 'This will delete all saved conversations. Continue?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear',
                style: 'destructive',
                onPress: async () => {
                    await clearAllChats();
                    setChatCount(0);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                },
            },
        ]);
    };

    const handleQRScanWrapper = (data: string) => {
        try {
            // 1. Try JSON (Full Beam Config)
            const config: BeamConfig = JSON.parse(data);
            if (config.host && config.port && config.key) {
                handleQRScan(config);
                return;
            }
        } catch (e) {
            // Not JSON, continue
        }

        // 2. Try Simple URL (http://IP:PORT) from terminal script
        if (data.startsWith('http')) {
            // Basic parsing
            const clean = data.replace(/^https?:\/\//, '');
            const [host, portStr] = clean.split(':');
            const port = parseInt(portStr);

            if (host && !isNaN(port)) {
                updateSetting('pcIp', host);
                updateSetting('bridgePort', port);
                Alert.alert('Uplink Targeted', `Target coordinates locked: ${host}:${port}.\n\n(Secure Beam tunnel requires full handshake from Desktop App).`);
                setShowQRScanner(false);
                return;
            }
        }

        Alert.alert('Scan Failed', 'Unrecognized data format.');
    };

    const handleQRScan = async (config: BeamConfig) => {
        setBeamConfig(config);
        setShowQRScanner(false);
        try {
            await neurobeam.connect(config);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error: any) {
            Alert.alert('Connection Failed', error.message);
        }
    };

    const handleBeamDisconnect = () => {
        neurobeam.disconnect();
        setBeamConfig(null);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    // Show loading indicator while settings are being loaded from storage
    if (!settingsLoaded) {
        return (
            <View style={{ flex: 1, backgroundColor: COLORS.BG, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: COLORS.TEAL, fontFamily: 'monospace', fontSize: 12 }}>
                    LOADING COGITATOR SETTINGS...
                </Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: COLORS.BG }}>
            {/* Header */}
            <View
                style={{
                    paddingTop: 48,
                    paddingBottom: 12,
                    paddingHorizontal: 16,
                    backgroundColor: COLORS.PANEL,
                    borderBottomWidth: 1,
                    borderBottomColor: COLORS.BORDER,
                    flexDirection: 'row',
                    alignItems: 'center',
                    ...SHADOWS.md,
                }}
            >
                <Pressable
                    onPress={() => router.back()}
                    style={{
                        padding: 8,
                        borderRadius: 6,
                        backgroundColor: COLORS.CARD,
                        borderWidth: 1,
                        borderColor: COLORS.BORDER,
                        marginRight: 12,
                        ...SHADOWS.sm,
                    }}
                >
                    <Text style={{ color: COLORS.BLUE, fontSize: 16, fontWeight: '700' }}>←</Text>
                </Pressable>
                <AkiraTitle text="COGITATOR PROTOCOLS" size="md" />
                <View style={{ flex: 1 }} />
                <StatusPill label="Bridge" status={status} />
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                keyboardShouldPersistTaps="handled"
            >
                {/* ─── NEUROBEAM SECTION ─── */}
                <MenuSection
                    title="NOOSPHERE BEAM"
                    icon="⚡"
                    isOpen={openSection === 'neurobeam'}
                    onToggle={() => toggleSection('neurobeam')}
                >
                    <Text style={styles.sectionHint}>
                        Direct P2P tunnel to your desktop. Scan the QR code from the host bridge.
                    </Text>

                    <BeamMonitor stats={beamStats} />

                    <View style={{ marginTop: 12, gap: 8 }}>
                        {beamStats.state === BeamState.IDLE || beamStats.state === BeamState.ERROR ? (
                            <NeonButton
                                title="INITIATE SCAN"
                                onPress={() => setShowQRScanner(true)}
                                variant="blue"
                                icon="📷"
                            />
                        ) : beamStats.state === BeamState.LOCKED ? (
                            <NeonButton
                                title="SEVER LINK"
                                onPress={handleBeamDisconnect}
                                variant="red"
                                icon="✕"
                            />
                        ) : null}
                    </View>

                    {beamConfig && (
                        <View style={{ marginTop: 12 }}>
                            <Text style={styles.infoText}>
                                Host: {beamConfig.host}:{beamConfig.port}
                            </Text>
                            <Text style={styles.infoText}>
                                Session: {beamConfig.sid.substring(0, 8)}...
                            </Text>
                        </View>
                    )}
                </MenuSection>

                {/* ─── CONNECTION SECTION ─── */}
                <MenuSection
                    title="UPLINK PROTOCOLS"
                    icon="🔗"
                    isOpen={openSection === 'connection'}
                    onToggle={() => toggleSection('connection')}
                >
                    <InputField
                        label="PC IP ADDRESS"
                        value={settings.pcIp}
                        onChangeText={(v) => updateSetting('pcIp', v)}
                        placeholder="192.168.1.100"
                        keyboardType="numbers-and-punctuation"
                    />
                    <InputField
                        label="VPN / TAILSCALE IP"
                        value={settings.vpnIp}
                        onChangeText={(v) => updateSetting('vpnIp', v)}
                        placeholder="100.x.x.x"
                        hint="Takes priority over PC IP"
                        keyboardType="numbers-and-punctuation"
                    />
                    <InputField
                        label="BRIDGE PORT"
                        value={String(settings.bridgePort)}
                        onChangeText={(v) => updateSetting('bridgePort', parseInt(v) || 8082)}
                        placeholder="8082"
                        keyboardType="number-pad"
                    />
                    <View style={{ marginTop: 8 }}>
                        <NeonButton title="TEST UPLINK" onPress={handleTest} loading={testing} variant="blue" icon="⚡" />
                        <Text style={{
                            marginTop: 8,
                            color: COLORS.TEXT_DIM,
                            fontFamily: 'monospace',
                            fontSize: 10,
                            textAlign: 'center'
                        }}>
                            Target: {buildUrl(settings.vpnIp || settings.pcIp || 'localhost', settings.bridgePort)}
                        </Text>
                    </View>
                </MenuSection>

                {/* ─── AI MODEL SECTION ─── */}
                <MenuSection
                    title="LOGIC ENGINES"
                    icon="🧠"
                    isOpen={openSection === 'model'}
                    onToggle={() => toggleSection('model')}
                >
                    <Text style={styles.sectionHint}>
                        Select which model processes your queries. Models must be installed on your Ollama server.
                    </Text>
                    <ModelPicker
                        serverIp={settings.vpnIp || settings.pcIp}
                        selectedModel={settings.selectedModel}
                        onSelectModel={(m) => updateSetting('selectedModel', m)}
                    />
                    <View style={{ marginTop: 12 }}>
                        <InputField
                            label="MANUAL MODEL NAME"
                            value={settings.selectedModel}
                            onChangeText={(v) => updateSetting('selectedModel', v)}
                            placeholder="llama3.2:latest"
                            hint="Type a model name if not listed above"
                        />
                    </View>
                    {settings.modelMonitoring && (
                        <View style={{ marginTop: 12 }}>
                            <Text style={styles.subsectionTitle}>MODEL ACTIVITY</Text>
                            <ModelMonitor modelName={settings.selectedModel} />
                        </View>
                    )}
                    <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={styles.switchLabel}>Model Monitoring</Text>
                        <Switch
                            value={settings.modelMonitoring}
                            onValueChange={(v) => updateSetting('modelMonitoring', v)}
                            trackColor={{ false: COLORS.BORDER, true: COLORS.BLUE + '60' }}
                            thumbColor={settings.modelMonitoring ? COLORS.BLUE : COLORS.TEXT_DIM}
                        />
                    </View>
                </MenuSection>

                {/* ─── ROUTING SECTION ─── */}
                <MenuSection
                    title="DATA ROUTING"
                    icon="🔀"
                    isOpen={openSection === 'routing'}
                    onToggle={() => toggleSection('routing')}
                >
                    <Text style={styles.sectionHint}>
                        Choose how queries are routed between local, PC, and cloud.
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                        {(['auto', 'local', 'pc', 'cloud'] as const).map((mode) => {
                            const active = settings.routeMode === mode;
                            return (
                                <Pressable
                                    key={mode}
                                    onPress={() => {
                                        updateSetting('routeMode', mode);
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                    style={{
                                        paddingHorizontal: 16,
                                        paddingVertical: 10,
                                        borderRadius: 6,
                                        borderWidth: 1.5,
                                        borderColor: active ? COLORS.BLUE : COLORS.BORDER,
                                        backgroundColor: active ? COLORS.BLUE + '18' : COLORS.CARD,
                                        ...SHADOWS.sm,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontFamily: 'monospace',
                                            textTransform: 'uppercase',
                                            fontSize: 12,
                                            fontWeight: '700',
                                            letterSpacing: 1,
                                            color: active ? COLORS.BLUE : COLORS.TEXT_MED,
                                        }}
                                    >
                                        {mode}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                            <InputField
                                label="BATTERY THRESHOLD %"
                                value={String(settings.batteryThreshold)}
                                onChangeText={(v) => updateSetting('batteryThreshold', parseInt(v) || 0)}
                                keyboardType="number-pad"
                                placeholder="20"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <InputField
                                label="CHAR LIMIT"
                                value={String(settings.charThreshold)}
                                onChangeText={(v) => updateSetting('charThreshold', parseInt(v) || 0)}
                                keyboardType="number-pad"
                                placeholder="100"
                            />
                        </View>
                    </View>
                </MenuSection>

                {/* ─── APPEARANCE SECTION ─── */}
                <MenuSection
                    title="OPTICAL ARRAYS"
                    icon="🎨"
                    isOpen={openSection === 'appearance'}
                    onToggle={() => toggleSection('appearance')}
                >
                    <InputField
                        label="FONT SIZE"
                        value={String(settings.fontSize)}
                        onChangeText={(v) => updateSetting('fontSize', parseInt(v) || 13)}
                        keyboardType="number-pad"
                        placeholder="13"
                        hint="Chat message font size (10-20)"
                    />
                </MenuSection>

                {/* ─── CHAT MANAGEMENT SECTION ─── */}
                <MenuSection
                    title="ARCHIVE PROTOCOLS"
                    icon="💬"
                    isOpen={openSection === 'chats'}
                    onToggle={() => toggleSection('chats')}
                >
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 12,
                        }}
                    >
                        <Text style={styles.switchLabel}>Auto-Save Chats</Text>
                        <Switch
                            value={settings.autoSaveChats}
                            onValueChange={(v) => updateSetting('autoSaveChats', v)}
                            trackColor={{ false: COLORS.BORDER, true: COLORS.TEAL + '60' }}
                            thumbColor={settings.autoSaveChats ? COLORS.TEAL : COLORS.TEXT_DIM}
                        />
                    </View>
                    <InputField
                        label="MAX CHAT HISTORY"
                        value={String(settings.maxChatHistory)}
                        onChangeText={(v) => updateSetting('maxChatHistory', parseInt(v) || 50)}
                        keyboardType="number-pad"
                        placeholder="50"
                        hint="Maximum number of saved conversations"
                    />
                    <View style={{ marginTop: 8 }}>
                        <Text style={styles.infoText}>
                            {chatCount} saved conversation{chatCount !== 1 ? 's' : ''}
                        </Text>
                    </View>
                    <View style={{ marginTop: 12, gap: 8 }}>
                        <NeonButton
                            title="View Chat History"
                            onPress={() => router.push('/history')}
                            variant="teal"
                            icon="📋"
                        />
                        <NeonButton
                            title="Clear All Chats"
                            onPress={handleClearChats}
                            variant="red"
                            icon="🗑️"
                        />
                    </View>
                </MenuSection>

                {/* ─── FAQ SECTION ─── */}
                <MenuSection
                    title="PRIMER / RITES"
                    icon="❓"
                    isOpen={openSection === 'faq'}
                    onToggle={() => toggleSection('faq')}
                >
                    {FAQ_CATEGORIES.map((cat) => {
                        const items = FAQ_DATA.filter((f) => f.category === cat.key);
                        if (items.length === 0) return null;
                        return (
                            <View key={cat.key} style={{ marginBottom: 16 }}>
                                <Text style={styles.faqCategory}>
                                    {cat.icon} {cat.label}
                                </Text>
                                {items.map((item) => (
                                    <FAQAccordion
                                        key={item.id}
                                        item={item}
                                        expanded={expandedFaq === item.id}
                                        onToggle={() => {
                                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                            setExpandedFaq(expandedFaq === item.id ? null : item.id);
                                        }}
                                    />
                                ))}
                            </View>
                        );
                    })}
                </MenuSection>

                {/* ─── ABOUT SECTION ─── */}
                <MenuSection
                    title="ORIGIN DATA"
                    icon="ℹ️"
                    isOpen={openSection === 'about'}
                    onToggle={() => toggleSection('about')}
                >
                    <View style={{ gap: 8 }}>
                        <InfoRow label="Construct" value="NeuroSync v1.0.0" />
                        <InfoRow label="Aesthetic" value="Grimdark | Mechanicus" />
                        <InfoRow label="Bridge Port" value={String(settings.bridgePort)} />
                        <InfoRow label="Active Model" value={settings.selectedModel} />
                        <InfoRow label="Route Mode" value={settings.routeMode.toUpperCase()} />
                        <InfoRow label="Saved Chats" value={String(chatCount)} />
                    </View>
                </MenuSection>
            </ScrollView>

            {/* Floating Save Button */}
            <View
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: 16,
                    backgroundColor: COLORS.PANEL,
                    borderTopWidth: 1,
                    borderTopColor: COLORS.BORDER,
                    ...SHADOWS.lg,
                }}
            >
                <NeonButton
                    title={hasChanges ? '● SAVE SETTINGS' : 'SAVE SETTINGS'}
                    onPress={handleSave}
                    variant={hasChanges ? 'amber' : 'green'}
                    icon="💾"
                />
            </View>

            {/* QR Scanner Modal */}
            <Modal
                visible={showQRScanner}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowQRScanner(false)}
            >
                <BeamScanner
                    onClose={() => setShowQRScanner(false)}
                    onScan={handleQRScanWrapper}
                />
            </Modal>
        </View >
    );
}

// ─── Sub-components ─────────────────────────────────────────

function MenuSection({
    title,
    icon,
    isOpen,
    onToggle,
    children,
}: {
    title: string;
    icon: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    const sectionStyle: ViewStyle = {
        marginBottom: 12,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: isOpen ? COLORS.TEAL : COLORS.BORDER,
        backgroundColor: COLORS.CARD,
        overflow: 'hidden',
        borderLeftWidth: 6,
        borderLeftColor: isOpen ? COLORS.TEAL : COLORS.BORDER_LIGHT,
        ...SHADOWS.industrialDepth,
    };

    return (
        <View style={sectionStyle}>
            <Pressable
                onPress={onToggle}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 14,
                    backgroundColor: isOpen ? COLORS.SURFACE : COLORS.CARD,
                }}
            >
                <Text style={{ fontSize: 18, marginRight: 10 }}>{icon}</Text>
                <Text
                    style={{
                        flex: 1,
                        color: isOpen ? COLORS.TEAL : COLORS.TEXT_BRIGHT,
                        fontFamily: 'monospace',
                        fontSize: 14,
                        fontWeight: '900',
                        letterSpacing: 2,
                    }}
                >
                    {title}
                </Text>
                <Text style={{ color: COLORS.TEXT_MED, fontSize: 12 }}>{isOpen ? '▲' : '▼'}</Text>
            </Pressable>
            {isOpen && (
                <View
                    style={{
                        padding: 16,
                        backgroundColor: COLORS.PANEL,
                        borderTopWidth: 2,
                        borderTopColor: COLORS.BORDER,
                    }}
                >
                    {children}
                </View>
            )}
        </View>
    );
}

function InputField({
    label,
    value,
    onChangeText,
    placeholder,
    hint,
    keyboardType,
}: {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
    placeholder?: string;
    hint?: string;
    keyboardType?: 'default' | 'numbers-and-punctuation' | 'number-pad';
}) {
    return (
        <View style={{ marginBottom: 12 }}>
            <Text
                style={{
                    color: COLORS.TEXT_MED,
                    fontSize: 10,
                    fontFamily: 'monospace',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    marginBottom: 6,
                    fontWeight: '600',
                }}
            >
                {label}
            </Text>
            <TextInput
                style={{
                    backgroundColor: COLORS.BG,
                    borderWidth: 2,
                    borderColor: COLORS.BORDER,
                    borderRadius: 2,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    color: COLORS.TEAL,
                    fontFamily: 'monospace',
                    fontSize: 14,
                    fontWeight: '700',
                }}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={COLORS.TEXT_MUTED}
                keyboardType={keyboardType}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
                spellCheck={false}
            />
            {hint && (
                <Text
                    style={{
                        color: COLORS.TEXT_DIM,
                        fontSize: 10,
                        marginTop: 4,
                        fontStyle: 'italic',
                    }}
                >
                    {hint}
                </Text>
            )}
        </View>
    );
}

function FAQAccordion({
    item,
    expanded,
    onToggle,
}: {
    item: FAQItem;
    expanded: boolean;
    onToggle: () => void;
}) {
    return (
        <View
            style={{
                marginBottom: 6,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: expanded ? COLORS.BORDER_LIGHT : COLORS.BORDER + '60',
                backgroundColor: expanded ? COLORS.SURFACE : 'transparent',
                overflow: 'hidden',
            }}
        >
            <Pressable
                onPress={onToggle}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 10 }}
            >
                <Text
                    style={{
                        flex: 1,
                        color: expanded ? COLORS.BLUE : COLORS.TEXT_BRIGHT,
                        fontFamily: 'monospace',
                        fontSize: 12,
                        fontWeight: '600',
                    }}
                >
                    {item.question}
                </Text>
                <Text style={{ color: COLORS.TEXT_DIM, fontSize: 10 }}>{expanded ? '−' : '+'}</Text>
            </Pressable>
            {expanded && (
                <View
                    style={{
                        paddingHorizontal: 10,
                        paddingBottom: 12,
                        borderTopWidth: 1,
                        borderTopColor: COLORS.BORDER + '40',
                    }}
                >
                    <Text
                        style={{
                            color: COLORS.TEXT_MED,
                            fontSize: 11,
                            lineHeight: 18,
                            marginTop: 8,
                        }}
                    >
                        {item.answer}
                    </Text>
                </View>
            )}
        </View>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <View
            style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 6,
                borderBottomWidth: 1,
                borderBottomColor: COLORS.BORDER + '30',
            }}
        >
            <Text
                style={{
                    color: COLORS.TEXT_DIM,
                    fontFamily: 'monospace',
                    fontSize: 11,
                }}
            >
                {label}
            </Text>
            <Text
                style={{
                    color: COLORS.TEXT_BRIGHT,
                    fontFamily: 'monospace',
                    fontSize: 11,
                    fontWeight: '600',
                }}
            >
                {value}
            </Text>
        </View>
    );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = {
    sectionHint: {
        color: COLORS.TEXT_DIM,
        fontSize: 11,
        lineHeight: 16,
        marginBottom: 12,
    } as ViewStyle,
    subsectionTitle: {
        color: COLORS.TEXT_MED,
        fontFamily: 'monospace',
        fontSize: 10,
        fontWeight: '700' as const,
        letterSpacing: 1.5,
        textTransform: 'uppercase' as const,
        marginBottom: 8,
    },
    switchLabel: {
        color: COLORS.TEXT_BRIGHT,
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: '500' as const,
    },
    infoText: {
        color: COLORS.TEXT_DIM,
        fontFamily: 'monospace',
        fontSize: 11,
    },
    faqCategory: {
        color: COLORS.TEXT_MED,
        fontFamily: 'monospace',
        fontSize: 11,
        fontWeight: '700' as const,
        letterSpacing: 1,
        marginBottom: 8,
        textTransform: 'uppercase' as const,
    },
};
