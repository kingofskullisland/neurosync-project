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
} from 'react-native';
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
import { NexusLink } from '../lib/nexus-link';
import { RouteTarget } from '../lib/router';
import {
  AppSettings,
  ChatMessage,
  loadSettings,
  recordModelRequest,
  saveChatMessages,
} from '../lib/storage';
import { COLORS } from '../lib/theme';

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
  const { processMessage, isThinking } = useWorkloadRouter();
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

  return (
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
                className="p-2 border border-mechanicus-plate bg-mechanicus-dark active:bg-mechanicus-plate"
              >
                <Text className="text-mechanicus-green text-lg">⚡</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/history');
                }}
                className="p-2 border border-mechanicus-plate bg-mechanicus-dark active:bg-mechanicus-plate"
              >
                <Text className="text-mechanicus-green text-lg">📋</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/settings');
                }}
                className="p-2 border border-mechanicus-plate bg-mechanicus-dark active:bg-mechanicus-plate"
              >
                <Text className="text-mechanicus-green text-lg">⚙️</Text>
              </Pressable>
            </View>
          </View>

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
              "There is no strength in flesh, only weakness."
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
        <View className={`border-t-2 border-mechanicus-plate bg-mechanicus-dark p-2 ${keyboardVisible ? 'pb-2' : 'pb-6'}`}>
          <View className="flex-row items-end space-x-2">
            <TextInput
              ref={inputRef}
              className="flex-1 bg-mechanicus-dark border border-mechanicus-plate text-mechanicus-green font-mono p-3 text-sm min-h-[48px]"
              value={input}
              onChangeText={setInput}
              placeholder="Input Directive..."
              placeholderTextColor="#2d382d"
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
      </View>
    </CRTScreen>
  );
}