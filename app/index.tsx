/**
 * NeuroSync — Chat Screen
 * Adeptus Mechanicus "Cogitator" UI Overhaul (v6.0 ULTIMA)
 */
import * as Battery from 'expo-battery';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  ViewStyle
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BeamScanner from '../components/BeamScanner';
import { ChatBubble } from '../components/ChatBubble';
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
import { HyperAI } from '../lib/nexus-link';
import { RouteTarget } from '../lib/router';
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
  // const [loading, setLoading] = useState(false); // We will merge this with router loading if needed, or keep it
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [battery, setBattery] = useState(100);
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatId] = useState(() => Date.now().toString());
  const [keyboardVisible, setKeyboardVisible] = useState(false);

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

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    // TIER 1: HYPER-AI (Local Triage + Orchestrator)
    try {
      const triage = await HyperAI.triage(userMsg.content);
      if (triage.handledLocally) {
        const reflexMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: triage.content,
          route: 'LOCAL',
          model: 'HyperAI',
          timestamp: Date.now(),
        };
        const withReflex = [...newMessages, reflexMsg];
        setMessages(withReflex);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

        // ORCHESTRATOR: If HyperAI wants the PC to handle the heavy lifting
        if (triage.action === 'DELEGATE_TO_PC' && triage.syntheticPrompt) {
          const pcStartTime = Date.now();
          const pcResponse = await processMessage(triage.syntheticPrompt, withReflex);
          const pcElapsed = Date.now() - pcStartTime;

          const pcMsg: ChatMessage = {
            id: (Date.now() + 2).toString(),
            role: 'assistant',
            content: pcResponse,
            route: 'PC',
            model: settings?.pcModel || settings?.selectedModel || 'PC Model',
            timestamp: Date.now(),
          };
          const allMsgs = [...withReflex, pcMsg];
          setMessages(allMsgs);
          await autoSave(allMsgs);

          if (settings?.modelMonitoring) {
            await recordModelRequest(settings.pcModel || settings.selectedModel, pcElapsed, false);
          }
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
          return;
        }

        // Pure local action (no delegation needed)
        await autoSave(withReflex);
        return;
      }
    } catch (e) {
      console.log('HyperAI Triage Error:', e);
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
    <CRTScreen>
      <SafeAreaView className="flex-1" edges={['top', 'bottom', 'left', 'right']}>
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
        <View className="pt-4 px-4 border-b-2 border-mechanicus-brass bg-mechanicus-dark pb-4 z-10 w-full relative">
          <View className="absolute top-0 left-0 right-0 h-1 hazard-stripe" />

          {/* Purity Seal for Tethered Mode */}
          {inferenceMode === 'tethered' && <PuritySeal label="LINKED" />}

          <View className="flex-row justify-between items-start">
            <View>
              <AkiraTitle text="COGITATOR LINK" size="md" accent={COLORS.TEAL} />
              <Text className="text-mechanicus-gold font-mono text-xs opacity-70 mt-1">
                // OMNISSIAH_NET // v6.0.0
              </Text>
            </View>
            ...
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/settings');
              }}
              className="p-2 border-2 border-mechanicus-gold bg-mechanicus-gold/10 active:bg-mechanicus-gold/40 rounded-sm"
            >
              <Text className="text-mechanicus-gold text-lg">⚙️</Text>
            </Pressable>
          </View>
        </View>

        <View className="mt-4">
          <ServoSkull status={loading ? "COMPUTING" : "AWAITING RITES"} />
        </View>

        ...
        {messages.length === 0 ? (
          <View className="flex-1 items-center justify-center p-8">
            <Text className="text-mechanicus-green font-mono text-center opacity-80 mb-4">
              [MACHINE_SPIRIT_AWAKENED]
            </Text>
            <Text className="text-mechanicus-green font-mono text-center text-xs opacity-60">
              &quot;Knowledge is power, guard it well.&quot;
            </Text>
            <View className="w-12 h-1 bg-mechanicus-green mt-4 mb-4" />
            <Text className="text-mechanicus-green font-mono text-center text-xs">
              Initializing Logic Engines...
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
              <ChatBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                route={msg.route as RouteTarget}
                timestamp={msg.timestamp}
                model={msg.model}
              />
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
        <View className={`border-t-2 border-mechanicus-brass bg-mechanicus-plate p-3 ${keyboardVisible ? 'pb-3' : 'pb-[40px]'}`}>
          <View className="flex-row items-end space-x-2">
            <TextInput
              ref={inputRef}
              className="flex-1 bg-mechanicus-dark border-2 border-mechanicus-brass text-mechanicus-green font-mono p-3 text-sm min-h-[52px] etched-inset"
              value={input}
              onChangeText={setInput}
              placeholder=">>> INPUT DIRECTIVE..."
              placeholderTextColor="#5C3A2E"
              multiline
              maxLength={2000}
              editable={!loading}
            />
            <Pressable
              onPress={handleSend}
              disabled={loading || !input.trim()}
              className={`w-12 h-12 border-2 border-mechanicus-green items-center justify-center bg-mechanicus-green/10 active:bg-mechanicus-green/30 ${(loading || !input.trim()) ? 'opacity-50 border-mechanicus-plate' : ''
                }`}
            >
              <Text className={`font-mono font-bold ${(loading || !input.trim()) ? 'text-mechanicus-plate' : 'text-mechanicus-green'
                }`}>
                [TX]
              </Text>
            </Pressable>
          </View>
        </View>

        {/* FOOTER */}
        <StatusSlate />
        <NoosphericStream />
      </SafeAreaView>
    </CRTScreen>
  );
}