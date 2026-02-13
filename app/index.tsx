/**
 * NeuroSync — Chat Screen
 * Akira-inspired UI with keyboard-aware input
 */
import * as Battery from 'expo-battery';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  ViewStyle
} from 'react-native';
import { ChatBubble } from '../components/ChatBubble';
import { AkiraTitle } from '../components/GlitchText';
import { ModelMonitor } from '../components/ModelMonitor';
import { StatusPill } from '../components/StatusPill';
import { checkHealth, NetworkError, sendChat } from '../lib/api';
import { routeQuery, RouteTarget } from '../lib/router';
import {
  AppSettings,
  ChatMessage,
  loadSettings,
  recordModelRequest,
  saveChatMessages,
} from '../lib/storage';
import { COLORS, SHADOWS } from '../lib/theme';

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [battery, setBattery] = useState(100);
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatId] = useState(() => Date.now().toString());
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  // Subtle pulse animation for the header accent bar
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Keyboard listeners for Android
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Load settings and check status
  useEffect(() => {
    init();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const init = async () => {
    const s = await loadSettings();
    setSettings(s);
    const level = await Battery.getBatteryLevelAsync();
    setBattery(Math.round(level * 100));
    if (s.pcIp || s.vpnIp) {
      await checkStatus(s);
    }
  };

  const checkStatus = async (s?: AppSettings) => {
    const cfg = s || settings;
    if (!cfg) return;
    const ip = cfg.vpnIp || cfg.pcIp;
    if (!ip) return;
    try {
      const health = await checkHealth(ip);
      setBridgeOnline(health.status === 'online');
      setOllamaOnline(health.ollama === 'connected');
    } catch {
      setBridgeOnline(false);
      setOllamaOnline(false);
    }
  };

  const autoSave = useCallback(
    async (msgs: ChatMessage[]) => {
      if (settings?.autoSaveChats && msgs.length > 0) {
        await saveChatMessages(chatId, msgs);
      }
    },
    [chatId, settings]
  );

  const handleSend = async () => {
    if (!input.trim() || loading || !settings) return;

    const ip = settings.vpnIp || settings.pcIp;
    if (!ip) {
      setError('Configure server IP in settings');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setError(null);

    // Scroll to bottom
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    const decision = routeQuery(userMsg.content, settings, {
      battery,
      localOnline: ollamaOnline,
      pcOnline: bridgeOnline,
    });

    const startTime = Date.now();
    try {
      const response = await sendChat(ip, userMsg.content, settings.selectedModel);
      const elapsed = Date.now() - startTime;

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        route: decision.target,
        model: settings.selectedModel,
        timestamp: Date.now(),
      };

      const allMsgs = [...newMessages, aiMsg];
      setMessages(allMsgs);
      await autoSave(allMsgs);

      // Record model performance
      if (settings.modelMonitoring) {
        await recordModelRequest(settings.selectedModel, elapsed, false);
      }

      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      const elapsed = Date.now() - startTime;
      if (settings.modelMonitoring) {
        await recordModelRequest(settings.selectedModel, elapsed, true);
      }
      if (err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError('Failed to get response');
      }
    } finally {
      setLoading(false);
    }
  };

  const headerStyle: ViewStyle = {
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.PANEL,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
    ...(SHADOWS.md as object),
  };

  const inputAreaStyle: ViewStyle = {
    paddingHorizontal: 12,
    paddingBottom: keyboardVisible ? 8 : 24,
    paddingTop: 10,
    backgroundColor: COLORS.PANEL,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    ...(SHADOWS.lg as object),
  };

  const sendButtonStyle: ViewStyle = {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    ...(SHADOWS.sm as object),
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.BG }}>
      {/* Header */}
      <View style={headerStyle}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <AkiraTitle text="NEUROSYNC" size="md" />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => router.push('/history')}
              style={{
                padding: 8,
                borderRadius: 6,
                backgroundColor: COLORS.CARD,
                borderWidth: 1,
                borderColor: COLORS.BORDER,
                ...(SHADOWS.sm as object),
              }}
            >
              <Text style={{ fontSize: 18 }}>📋</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/settings')}
              style={{
                padding: 8,
                borderRadius: 6,
                backgroundColor: COLORS.CARD,
                borderWidth: 1,
                borderColor: COLORS.BORDER,
                ...(SHADOWS.sm as object),
              }}
            >
              <Text style={{ fontSize: 18 }}>⚙️</Text>
            </Pressable>
          </View>
        </View>

        {/* Animated accent bar */}
        <Animated.View
          style={{
            height: 2,
            backgroundColor: COLORS.RED,
            marginTop: 8,
            opacity: pulseAnim,
            borderRadius: 1,
          }}
        />

        {/* Status Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatusPill label="Ollama" status={ollamaOnline ? 'online' : 'offline'} />
            <StatusPill label="Bridge" status={bridgeOnline ? 'online' : 'offline'} />
            <StatusPill
              label="Battery"
              status={battery > 20 ? 'online' : 'warning'}
              value={`${battery}%`}
            />
          </View>
        </ScrollView>

        {/* Compact model monitor */}
        {settings?.modelMonitoring && settings?.selectedModel && (
          <View style={{ marginTop: 8 }}>
            <ModelMonitor modelName={settings.selectedModel} compact />
          </View>
        )}
      </View>

      {/* Error Banner */}
      {error && (
        <Pressable
          onPress={() => setError(null)}
          style={{
            backgroundColor: COLORS.RED + '20',
            borderBottomWidth: 1,
            borderBottomColor: COLORS.RED + '60',
            paddingHorizontal: 16,
            paddingVertical: 10,
          }}
        >
          <Text
            style={{
              color: COLORS.RED,
              fontSize: 12,
              fontFamily: 'monospace',
              textAlign: 'center',
            }}
          >
            {error}
          </Text>
        </Pressable>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, paddingHorizontal: 14 }}
        contentContainerStyle={{ paddingVertical: 16, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: true })
        }
      >
        {messages.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🧠</Text>
            <Text
              style={{
                color: COLORS.TEXT_BRIGHT,
                fontSize: 16,
                fontFamily: 'monospace',
                fontWeight: '700',
                letterSpacing: 2,
              }}
            >
              NEURAL LINK READY
            </Text>
            <View
              style={{
                width: 40,
                height: 2,
                backgroundColor: COLORS.RED,
                marginTop: 8,
                marginBottom: 12,
              }}
            />
            <Text
              style={{
                color: COLORS.TEXT_DIM,
                fontSize: 12,
                textAlign: 'center',
                paddingHorizontal: 40,
                lineHeight: 18,
              }}
            >
              {bridgeOnline
                ? 'Send a message to begin'
                : 'Configure connection in settings'}
            </Text>
          </View>
        ) : (
          messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              route={msg.route as RouteTarget}
              timestamp={msg.timestamp}
              model={msg.model}
            />
          ))
        )}

        {loading && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              padding: 16,
            }}
          >
            <ActivityIndicator color={COLORS.TEAL} />
            <Text
              style={{
                color: COLORS.TEAL,
                fontSize: 12,
                fontFamily: 'monospace',
              }}
            >
              Processing...
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Input Area — properly keyboard-aware */}
      <View style={inputAreaStyle}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
          <TextInput
            ref={inputRef}
            style={{
              flex: 1,
              backgroundColor: COLORS.CARD,
              borderWidth: 1,
              borderColor: COLORS.BORDER,
              borderRadius: 8,
              paddingHorizontal: 14,
              paddingVertical: 10,
              color: COLORS.TEXT_BRIGHT,
              fontFamily: 'monospace',
              fontSize: settings?.fontSize || 13,
              maxHeight: 120,
              ...(SHADOWS.sm as object),
            }}
            value={input}
            onChangeText={setInput}
            placeholder="Enter command..."
            placeholderTextColor={COLORS.TEXT_MUTED}
            multiline
            maxLength={2000}
            editable={!loading}
            returnKeyType="default"
            blurOnSubmit={false}
          />
          <Pressable
            onPress={handleSend}
            disabled={loading || !input.trim()}
            style={[
              sendButtonStyle,
              {
                borderColor:
                  loading || !input.trim() ? COLORS.BORDER : COLORS.RED,
                backgroundColor:
                  loading || !input.trim() ? COLORS.CARD : COLORS.RED + '20',
                opacity: loading || !input.trim() ? 0.5 : 1,
              },
            ]}
          >
            <Text
              style={{
                color:
                  loading || !input.trim() ? COLORS.TEXT_DIM : COLORS.RED,
                fontSize: 20,
                fontWeight: '700',
              }}
            >
              ➤
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}