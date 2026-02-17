/**
 * NeuroSync — Chat Screen
<<<<<<< HEAD
 * Adeptus Mechanicus "Cogitator" UI Overhaul (v6.0 ULTIMA)
=======
 * Akira-inspired UI with keyboard-aware input
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
 */
import * as Battery from 'expo-battery';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
<<<<<<< HEAD
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
=======
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ImageBackground,
  Keyboard,
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  ViewStyle
} from 'react-native';
import BeamScanner from '../components/BeamScanner';
import { ChatBubble } from '../components/ChatBubble';
<<<<<<< HEAD
import { CRTScreen } from '../components/CRTScreen';
import { AkiraTitle } from '../components/GlitchText';
import { NoosphericStream } from '../components/NoosphericStream';
import { PuritySeal } from '../components/PuritySeal';
import { ServoSkull } from '../components/ServoSkull';
import { StatusSlate } from '../components/StatusSlate';
import TetherStatus from '../components/TetherStatus';
import { useNoosphere } from '../context/NoosphereContext';
import { useWorkloadRouter } from '../hooks/useWorkloadRouter';
import { checkHealth } from '../lib/api';
import { NexusLink } from '../lib/nexus-link';
import { RouteTarget } from '../lib/router';
=======
import { AkiraTitle } from '../components/GlitchText';
import { ModelMonitor } from '../components/ModelMonitor';
import { StatusPill } from '../components/StatusPill';
import { checkHealth, NetworkError, sendChat } from '../lib/api';
import { NexusLink } from '../lib/nexus-link';
import { routeQuery, RouteTarget } from '../lib/router';
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
import {
  AppSettings,
  ChatMessage,
  loadSettings,
  recordModelRequest,
  saveChatMessages,
} from '../lib/storage';
<<<<<<< HEAD
import { COLORS } from '../lib/theme';
=======
import { COLORS, SHADOWS } from '../lib/theme';

const backgroundImage = require('../assets/images/mechanicus_bg.png');
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  // const [loading, setLoading] = useState(false); // We will merge this with router loading if needed, or keep it
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [battery, setBattery] = useState(100);
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatId] = useState(() => Date.now().toString());
  const [keyboardVisible, setKeyboardVisible] = useState(false);
<<<<<<< HEAD

  // Tethering State
  const [isScanning, setIsScanning] = useState(false);
  const { processMessage, loading: isThinking } = useWorkloadRouter();
  const { inferenceMode } = useNoosphere();
  const loading = isThinking; // Alias for compatibility with existing UI

  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);


  // Keyboard listeners
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
=======

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
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
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
    if (!input.trim() || isThinking) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

<<<<<<< HEAD
=======
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setError(null);

<<<<<<< HEAD
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    // TIER 1: NEXUS-LINK (Local Triage) - Keeping this for quick local checks
    try {
      const triage = await NexusLink.triage(userMsg.content);
      if (triage.handledLocally) {
        const reflexMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: triage.content,
          route: 'LOCAL',
          model: 'Nexus-Link',
          timestamp: Date.now(),
        };
        const allMsgs = [...newMessages, reflexMsg];
        setMessages(allMsgs);
        await autoSave(allMsgs);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        return;
=======
    // Scroll to bottom
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    // TIER 1: NEXUS-LINK (Local Triage)
    try {
      const triage = await NexusLink.triage(userMsg.content);
      if (triage.handledLocally) {
        const reflexMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: triage.content,
          route: 'LOCAL',
          model: 'Nexus-Link',
          timestamp: Date.now(),
        };
        const allMsgs = [...newMessages, reflexMsg];
        setMessages(allMsgs);
        await autoSave(allMsgs);
        setLoading(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        return;
      }
    } catch (e) {
      console.log('Nexus Link Triage Error:', e);
    }

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
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
      }
    } catch (e) {
      console.log('Nexus Link Triage Error:', e);
    }

    // TIER 2/3: WORKLOAD ROUTER (Local vs Tethered)
    const startTime = Date.now();

    // The hook manages the loading state (isThinking)
    const responseText = await processMessage(userMsg.content, messages);
    const elapsed = Date.now() - startTime;

    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: responseText,
      route: inferenceMode === 'tethered' ? 'PC' : 'LOCAL', // Approximation
      model: settings?.selectedModel || 'Unknown',
      timestamp: Date.now(),
    };

    const allMsgs = [...newMessages, aiMsg];
    setMessages(allMsgs);
    await autoSave(allMsgs);

    if (settings?.modelMonitoring) {
      await recordModelRequest(settings.selectedModel, elapsed, false);
    }

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
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
    paddingBottom: keyboardVisible ? 16 : 24, // Add slight buffer when keyboard is up
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
<<<<<<< HEAD
    <CRTScreen>
      <View className="flex-1">
        <Modal
          visible={isScanning}
          animationType="fade"
          transparent={false}
          onRequestClose={() => setIsScanning(false)}
        >
          <BeamScanner onClose={() => setIsScanning(false)} />
        </Modal>

        {/* TOP STATUS BAR */}
        <TetherStatus />

        {/* HEADER: Servo Skull & Title */}
        <View className="pt-4 px-4 border-b-2 border-mechanicus-plate bg-mechanicus-dark pb-4 z-10 w-full relative">
          <View className="absolute top-0 left-0 right-0 h-1 hazard-stripe" />

          {/* Purity Seal for Tethered Mode */}
          {inferenceMode === 'tethered' && <PuritySeal />}

          <View className="flex-row justify-between items-start">
            <View>
              <AkiraTitle text="NEUROSYNC" size="md" accent={COLORS.GREEN} />
              <Text className="text-mechanicus-green font-mono text-xs opacity-70 mt-1">
                TERMINAL v6.0.0-ULTIMA
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setIsScanning(true);
                }}
                className="p-2 border-2 border-mechanicus-green bg-mechanicus-green/10 active:bg-mechanicus-green/40 rounded-sm"
              >
                <Text className="text-mechanicus-green text-lg">⚡</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/history');
                }}
                className="p-2 border-2 border-mechanicus-brass/50 bg-mechanicus-brass/10 active:bg-mechanicus-brass/40 rounded-sm"
              >
                <Text className="text-mechanicus-green text-lg">📋</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/settings');
                }}
                className="p-2 border-2 border-mechanicus-gold/50 bg-mechanicus-gold/10 active:bg-mechanicus-gold/40 rounded-sm"
              >
                <Text className="text-mechanicus-green text-lg">⚙️</Text>
=======
    <ImageBackground source={backgroundImage} style={{ flex: 1 }} resizeMode="cover">
      <View style={{ flex: 1, backgroundColor: 'rgba(15, 15, 15, 0.7)' }}>
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
                onPress={() => {
                  // Comment out haptics for now to rule it out
                  // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
                  router.push('/settings');
                }}
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
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
              </Pressable>
            </View>
          </View>

<<<<<<< HEAD
          <View className="mt-4">
            <ServoSkull status={loading ? "COMPUTING" : "VIGILANT"} />
          </View>
        </View>

        {/* ERROR BANNER */}
        {error && (
          <Pressable
            onPress={() => setError(null)}
            className="bg-mechanicus-red/20 border-b border-mechanicus-red p-2"
          >
            <Text className="text-mechanicus-red font-mono text-center font-bold animate-pulse">
              [! WARNING: {error} !]
            </Text>
          </Pressable>
        )}

        {messages.length === 0 ? (
          <View className="flex-1 items-center justify-center p-8">
            <Text className="text-mechanicus-green font-mono text-center opacity-80 mb-4">
              [SYSTEM_BOOT_COMPLETE]
            </Text>
            <Text className="text-mechanicus-green font-mono text-center text-xs opacity-60">
              &quot;There is no strength in flesh, only weakness.&quot;
            </Text>
            <View className="w-12 h-1 bg-mechanicus-green mt-4 mb-4" />
            <Text className="text-mechanicus-green font-mono text-center text-xs">
              Awaiting Input...
            </Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            className="flex-1 px-4"
            contentContainerStyle={{ paddingVertical: 16 }}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((msg) => (
=======
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
                MACHINE SPIRIT COMMUNING
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
                  ? 'Initiate data transmission'
                  : 'Configure connection in settings'}
              </Text>
            </View>
          ) : (
            messages.map((msg) => (
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
              <ChatBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                route={msg.route as RouteTarget}
                timestamp={msg.timestamp}
                model={msg.model}
              />
<<<<<<< HEAD
            ))}
            {loading && (
              <View className="flex-row items-center space-x-2 my-2 ml-2">
                <ActivityIndicator color={COLORS.GREEN} size="small" />
                <Text className="text-mechanicus-green font-mono text-xs animate-pulse">
                  [COMMUNING_WITH_MACHINE_SPIRIT...]
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* INPUT AREA */}
        <View className={`border-t-2 border-mechanicus-plate bg-mechanicus-iron p-3 ${keyboardVisible ? 'pb-3' : 'pb-8'}`}>
          <View className="flex-row items-end space-x-2">
            <TextInput
              ref={inputRef}
              className="flex-1 bg-mechanicus-dark border-2 border-mechanicus-plate text-mechanicus-green font-mono p-3 text-sm min-h-[52px] etched-inset"
              value={input}
              onChangeText={setInput}
              placeholder="Input Directive..."
              placeholderTextColor="#2d382d"
              multiline
              maxLength={2000}
              editable={!loading}
=======
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
              placeholder="Input data for cogitation..."
              placeholderTextColor={COLORS.TEXT_MUTED}
              multiline
              maxLength={2000}
              editable={!loading}
              returnKeyType="default"
              blurOnSubmit={false}
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
            />
            <Pressable
              onPress={handleSend}
              disabled={loading || !input.trim()}
<<<<<<< HEAD
              className={`w-12 h-12 border-2 border-mechanicus-green items-center justify-center bg-mechanicus-green/10 active:bg-mechanicus-green/30 ${(loading || !input.trim()) ? 'opacity-50 border-mechanicus-plate' : ''
                }`}
            >
              <Text className={`font-mono font-bold ${(loading || !input.trim()) ? 'text-mechanicus-plate' : 'text-mechanicus-green'
                }`}>
                [TX]
=======
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
                TX
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
              </Text>
            </Pressable>
          </View>
        </View>

        {/* FOOTER */}
        <StatusSlate />
        <NoosphericStream />
      </View>
<<<<<<< HEAD
    </CRTScreen>
=======
    </ImageBackground>
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
  );
}