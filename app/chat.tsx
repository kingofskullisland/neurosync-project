/**
 * NeuroSync — Memory Chat Screen
 * RAG-powered chat with camera/audio upload and token streaming.
 * Connects to the Memory Server backend for semantic search and AI responses.
 */
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    FlatList,
    Keyboard,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

// ─── Configuration ───────────────────────────────────────────────
// Replace with your PC's LAN IP address
const API_BASE = 'http://192.168.1.100:8001';

// ─── Types ───────────────────────────────────────────────────────
interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    isStreaming?: boolean;
}

// ─── Colors (Mechanicus Industrial Theme) ────────────────────────
const C = {
    BG: '#0F0F0F',
    PANEL: '#1A1A1A',
    CARD: '#2C2C2C',
    SURFACE: '#333333',
    BORDER: '#6E4D25',
    GREEN: '#2ECC71',
    GREEN_DIM: '#1A5C37',
    RED: '#8B0000',
    AMBER: '#D35400',
    GOLD: '#FFD700',
    TEAL: '#00CED1',
    TEXT: '#E0E0E0',
    TEXT_MED: '#A0A0A0',
    TEXT_DIM: '#606060',
};

// ─── VPN Status Indicator ─────────────────────────────────
const NetworkStatus = React.memo(({ isVpnActive, onToggle }: { isVpnActive: boolean; onToggle: () => void }) => (
    <Pressable onPress={onToggle} style={({ pressed }) => [
        styles.vpnBadge,
        isVpnActive ? styles.vpnOn : styles.vpnOff,
        pressed && styles.vpnPressed,
    ]}>
        <Text style={styles.vpnIcon}>{isVpnActive ? '☁' : '📱'}</Text>
        <Text style={styles.vpnText}>{isVpnActive ? 'CLOUD' : 'LOCAL'}</Text>
    </Pressable>
));

// ─── Chat Bubble ─────────────────────────────────────────────────
const MessageBubble = React.memo(({ item, vpnActive }: { item: ChatMessage; vpnActive: boolean }) => {
    const isUser = item.role === 'user';
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (item.isStreaming) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [item.isStreaming]);

    const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
            <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
                {/* Role tag */}
                <Text style={[styles.roleTag, isUser ? styles.roleTagUser : styles.roleTagAI]}>
                    {isUser ? '[ USER ]' : vpnActive ? '[ NEUROSYNC@CLOUD ]' : '[ NEUROSYNC ]'}
                </Text>

                {/* Content */}
                <Animated.Text
                    style={[
                        styles.bubbleText,
                        isUser ? styles.bubbleTextUser : styles.bubbleTextAI,
                        item.isStreaming && { opacity: pulseAnim },
                    ]}
                >
                    {item.content}
                    {item.isStreaming && ' ▋'}
                </Animated.Text>

                {/* Timestamp */}
                <Text style={styles.timestamp}>{time}</Text>
            </View>
        </View>
    );
});

// ─── Main Screen ─────────────────────────────────────────────────
export default function MemoryChatScreen() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [vpnActive, setVpnActive] = useState(false);  // Manual override toggle
    const flatListRef = useRef<FlatList>(null);

    // Scroll to bottom on new messages
    const scrollToBottom = useCallback(() => {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // ── Send Message ─────────────────────────────────────────────
    const handleSend = async () => {
        const text = input.trim();
        if (!text || isLoading) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Optimistic update: show user message immediately
        const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text,
            timestamp: Date.now(),
        };

        const streamingMsg: ChatMessage = {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true,
        };

        setMessages(prev => [...prev, userMsg, streamingMsg]);
        setInput('');
        setIsLoading(true);
        Keyboard.dismiss();

        try {
            // Also ingest to memory in the background (fire-and-forget)
            fetch(`${API_BASE}/v1/memory/ingest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, role: 'user', device_id: 'mobile' }),
            }).catch(() => { }); // Don't block on this

            // Get AI response via the chat endpoint
            const response = await fetch(`${API_BASE}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, device_id: 'mobile' }),
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();
            const aiContent = data.response || 'No response from server.';

            // Update streaming message with final content
            setMessages(prev =>
                prev.map(m =>
                    m.id === streamingMsg.id
                        ? { ...m, content: aiContent, isStreaming: false, timestamp: Date.now() }
                        : m
                )
            );

        } catch (err: any) {
            // Update streaming message with error
            setMessages(prev =>
                prev.map(m =>
                    m.id === streamingMsg.id
                        ? {
                            ...m,
                            content: `[ERROR] ${err.message || 'Connection failed'}`,
                            isStreaming: false,
                        }
                        : m
                )
            );
        } finally {
            setIsLoading(false);
        }
    };

    // ── Camera Upload ────────────────────────────────────────────
    const handleCamera = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Camera access is needed to take photos.');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.8,
            });

            if (result.canceled || !result.assets?.[0]) return;

            const asset = result.assets[0];
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Upload to server
            const formData = new FormData();
            formData.append('file', {
                uri: asset.uri,
                type: asset.mimeType || 'image/jpeg',
                name: asset.fileName || `photo_${Date.now()}.jpg`,
            } as any);

            // Show upload status message
            const uploadMsg: ChatMessage = {
                id: `sys-${Date.now()}`,
                role: 'system',
                content: '📸 Uploading image to memory…',
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, uploadMsg]);

            const response = await fetch(`${API_BASE}/v1/media/upload`, {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                setMessages(prev =>
                    prev.map(m =>
                        m.id === uploadMsg.id
                            ? { ...m, content: `📸 Image uploaded: ${data.filename}\nThe cortex worker will process it for semantic search.` }
                            : m
                    )
                );
            } else {
                throw new Error(`Upload failed: ${response.status}`);
            }
        } catch (err: any) {
            Alert.alert('Upload Error', err.message);
        }
    };

    // ── Audio Recording ──────────────────────────────────────────
    const startRecording = async () => {
        try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Microphone access is needed to record audio.');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: rec } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(rec);
            setIsRecording(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } catch (err) {
            console.error('Failed to start recording:', err);
        }
    };

    const stopRecording = async () => {
        if (!recording) return;

        setIsRecording(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecording(null);

            if (!uri) return;

            // Show upload status
            const uploadMsg: ChatMessage = {
                id: `sys-${Date.now()}`,
                role: 'system',
                content: '🎙️ Uploading audio to memory…',
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, uploadMsg]);

            // Upload
            const formData = new FormData();
            formData.append('file', {
                uri,
                type: 'audio/m4a',
                name: `recording_${Date.now()}.m4a`,
            } as any);

            const response = await fetch(`${API_BASE}/v1/media/upload`, {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                setMessages(prev =>
                    prev.map(m =>
                        m.id === uploadMsg.id
                            ? { ...m, content: `🎙️ Audio uploaded: ${data.filename}\nThe cortex worker will transcribe and index it.` }
                            : m
                    )
                );
            } else {
                throw new Error(`Upload failed: ${response.status}`);
            }
        } catch (err: any) {
            console.error('Recording upload error:', err);
            Alert.alert('Upload Error', err.message);
        }
    };

    // ── Empty State ──────────────────────────────────────────────
    const EmptyState = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🧠</Text>
            <Text style={styles.emptyTitle}>[MEMORY_CORTEX_ONLINE]</Text>
            <View style={styles.divider} />
            <Text style={styles.emptySubtitle}>
                RAG-enhanced conversations with{'\n'}semantic memory recall
            </Text>
            <Text style={styles.emptyHint}>
                Your messages are vectorized and stored{'\n'}for intelligent context retrieval.
            </Text>
        </View>
    );

    // ── Render ───────────────────────────────────────────────────
    return (
        <View style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <Text style={styles.backText}>◂</Text>
                    </Pressable>
                    <View>
                        <Text style={styles.headerTitle}>MEMORY CORTEX</Text>
                        <Text style={styles.headerSub}>HyDE-RAG • Semantic Search</Text>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <NetworkStatus
                        isVpnActive={vpnActive}
                        onToggle={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setVpnActive(!vpnActive);
                        }}
                    />
                    <View style={[styles.statusDot, isLoading ? styles.statusBusy : styles.statusReady]} />
                </View>
            </View>

            {/* MESSAGES */}
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <MessageBubble item={item} vpnActive={vpnActive} />}
                contentContainerStyle={styles.messageList}
                ListEmptyComponent={EmptyState}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={scrollToBottom}
            />

            {/* INPUT AREA */}
            <View style={styles.inputBar}>
                {/* Camera Button */}
                <Pressable
                    onPress={handleCamera}
                    style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
                >
                    <Text style={styles.iconText}>📷</Text>
                </Pressable>

                {/* Audio Record Button */}
                <Pressable
                    onPressIn={startRecording}
                    onPressOut={stopRecording}
                    style={({ pressed }) => [
                        styles.iconButton,
                        isRecording && styles.iconButtonRecording,
                        pressed && styles.iconButtonPressed,
                    ]}
                >
                    <Text style={styles.iconText}>{isRecording ? '⏺' : '🎙'}</Text>
                </Pressable>

                {/* Text Input */}
                <TextInput
                    style={styles.textInput}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Query memory…"
                    placeholderTextColor={C.TEXT_DIM}
                    multiline
                    maxLength={2000}
                    editable={!isLoading}
                    onSubmitEditing={handleSend}
                    blurOnSubmit={false}
                />

                {/* Send Button */}
                <Pressable
                    onPress={handleSend}
                    disabled={isLoading || !input.trim()}
                    style={({ pressed }) => [
                        styles.sendButton,
                        (!input.trim() || isLoading) && styles.sendButtonDisabled,
                        pressed && styles.sendButtonPressed,
                    ]}
                >
                    {isLoading ? (
                        <ActivityIndicator color={C.GREEN} size="small" />
                    ) : (
                        <Text style={[styles.sendText, (!input.trim() || isLoading) && styles.sendTextDisabled]}>
                            [TX]
                        </Text>
                    )}
                </Pressable>
            </View>
        </View>
    );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.BG,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 56 : 40,
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: C.PANEL,
        borderBottomWidth: 2,
        borderBottomColor: C.BORDER,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backButton: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.BORDER,
    },
    backText: {
        color: C.GREEN,
        fontSize: 18,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    headerTitle: {
        color: C.GREEN,
        fontSize: 16,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        letterSpacing: 2,
    },
    headerSub: {
        color: C.TEXT_DIM,
        fontSize: 10,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        marginTop: 2,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    statusReady: {
        backgroundColor: C.GREEN,
        shadowColor: C.GREEN,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
    },
    statusBusy: {
        backgroundColor: C.AMBER,
        shadowColor: C.AMBER,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },

    // Messages
    messageList: {
        paddingHorizontal: 12,
        paddingVertical: 16,
        flexGrow: 1,
    },
    bubbleRow: {
        flexDirection: 'row',
        marginBottom: 12,
        justifyContent: 'flex-start',
    },
    bubbleRowUser: {
        justifyContent: 'flex-end',
    },
    bubble: {
        maxWidth: '82%',
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    bubbleUser: {
        backgroundColor: C.GREEN_DIM,
        borderColor: C.GREEN,
        borderTopLeftRadius: 2,
        borderTopRightRadius: 12,
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 2,
    },
    bubbleAI: {
        backgroundColor: C.CARD,
        borderColor: C.BORDER,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 2,
        borderBottomLeftRadius: 2,
        borderBottomRightRadius: 12,
    },
    roleTag: {
        fontSize: 9,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontWeight: '700',
        letterSpacing: 1.5,
        marginBottom: 4,
    },
    roleTagUser: {
        color: C.GREEN,
    },
    roleTagAI: {
        color: C.GOLD,
    },
    bubbleText: {
        fontSize: 14,
        lineHeight: 20,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    bubbleTextUser: {
        color: C.TEXT,
    },
    bubbleTextAI: {
        color: C.TEXT_MED,
    },
    timestamp: {
        fontSize: 9,
        color: C.TEXT_DIM,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        marginTop: 6,
        textAlign: 'right',
    },

    // Empty state
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingTop: 80,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        color: C.GREEN,
        fontSize: 14,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontWeight: '700',
        letterSpacing: 2,
        marginBottom: 12,
    },
    divider: {
        width: 48,
        height: 2,
        backgroundColor: C.GREEN,
        marginBottom: 12,
    },
    emptySubtitle: {
        color: C.TEXT_MED,
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 8,
    },
    emptyHint: {
        color: C.TEXT_DIM,
        fontSize: 10,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        textAlign: 'center',
        lineHeight: 16,
    },

    // Input bar
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 8,
        paddingTop: 8,
        paddingBottom: Platform.OS === 'ios' ? 28 : 12,
        backgroundColor: C.PANEL,
        borderTopWidth: 2,
        borderTopColor: C.BORDER,
        gap: 6,
    },
    iconButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.BORDER,
        backgroundColor: C.CARD,
    },
    iconButtonPressed: {
        backgroundColor: C.SURFACE,
    },
    iconButtonRecording: {
        borderColor: C.RED,
        backgroundColor: '#2A0000',
    },
    iconText: {
        fontSize: 18,
    },
    textInput: {
        flex: 1,
        minHeight: 44,
        maxHeight: 120,
        backgroundColor: C.BG,
        borderWidth: 1,
        borderColor: C.BORDER,
        color: C.TEXT,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 13,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    sendButton: {
        width: 48,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: C.GREEN,
        backgroundColor: `${C.GREEN}15`,
    },
    sendButtonDisabled: {
        borderColor: C.SURFACE,
        backgroundColor: 'transparent',
    },
    sendButtonPressed: {
        backgroundColor: `${C.GREEN}30`,
    },
    sendText: {
        color: C.GREEN,
        fontSize: 12,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    sendTextDisabled: {
        color: C.TEXT_DIM,
    },

    // VPN Status Badge
    vpnBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 4,
        borderWidth: 1,
        gap: 6,
    },
    vpnOn: {
        backgroundColor: `${C.TEAL}20`,
        borderColor: C.TEAL,
    },
    vpnOff: {
        backgroundColor: C.CARD,
        borderColor: C.BORDER,
    },
    vpnPressed: {
        opacity: 0.7,
    },
    vpnIcon: {
        fontSize: 14,
    },
    vpnText: {
        fontSize: 10,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        color: C.TEXT,
        letterSpacing: 1,
    },
});
