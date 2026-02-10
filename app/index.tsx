/**
 * Von Agent - Neural Link (Chat Screen)
 */
import * as Battery from 'expo-battery';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChatBubble } from '../components/ChatBubble';
import { GlitchText } from '../components/GlitchText';
import { StatusPill } from '../components/StatusPill';
import { checkHealth, NetworkError, sendChat } from '../lib/api';
import { routeQuery, RouteTarget } from '../lib/router';
import { AppSettings, loadSettings } from '../lib/storage';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  route?: RouteTarget;
  timestamp: number;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [battery, setBattery] = useState(100);
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const scanlineAnim = useRef(new Animated.Value(0)).current;

  // Scanline animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanlineAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(scanlineAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
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

  const handleSend = async () => {
    if (!input.trim() || loading || !settings) return;

    const ip = settings.vpnIp || settings.pcIp;
    if (!ip) {
      setError('Configure server IP in settings');
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    // Get route decision
    const decision = routeQuery(userMsg.content, settings, {
      battery,
      localOnline: ollamaOnline,
      pcOnline: bridgeOnline,
    });

    try {
      const response = await sendChat(ip, userMsg.content, settings.selectedModel);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        route: decision.target,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, aiMsg]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      if (err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError('Failed to get response');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-cyber-bg"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Scanline */}
      <Animated.View
        className="absolute left-0 right-0 h-0.5 bg-neon-cyan/10 z-10"
        style={{
          transform: [{
            translateY: scanlineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 800] })
          }]
        }}
      />

      {/* Header */}
      <View className="pt-12 pb-4 px-4 border-b border-cyber-border">
        <View className="flex-row justify-between items-center">
          <GlitchText text="VON.AGENT" size="md" />
          <TouchableOpacity onPress={() => router.push('/settings')} className="p-2">
            <Text className="text-2xl">⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Status Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 -mx-1">
          <View className="flex-row gap-2 px-1">
            <StatusPill
              label="Local"
              status={ollamaOnline ? 'online' : 'offline'}
            />
            <StatusPill
              label="Bridge"
              status={bridgeOnline ? 'online' : 'offline'}
            />
            <StatusPill
              label="Battery"
              status={battery > 20 ? 'online' : 'warning'}
              value={`${battery}%`}
            />
          </View>
        </ScrollView>
      </View>

      {/* Error Banner */}
      {error && (
        <View className="bg-red-500/20 border-b border-red-500 px-4 py-3">
          <Text className="text-red-400 text-sm font-mono text-center">{error}</Text>
        </View>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingVertical: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-6xl mb-4">🤖</Text>
            <Text className="text-neon-cyan text-lg font-mono font-bold">NEURAL LINK READY</Text>
            <Text className="text-slate-500 text-sm mt-2 text-center px-8">
              {bridgeOnline
                ? 'Send a message to begin'
                : 'Configure connection in settings'}
            </Text>
          </View>
        ) : (
          messages.map(msg => (
            <ChatBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              route={msg.route}
              timestamp={msg.timestamp}
            />
          ))
        )}

        {loading && (
          <View className="flex-row items-center gap-3 p-4">
            <ActivityIndicator color="#00f0ff" />
            <Text className="text-neon-cyan text-sm font-mono">Processing...</Text>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View className="px-4 pb-6 pt-3 border-t border-cyber-border">
        <View className="flex-row gap-3">
          <TextInput
            className="flex-1 bg-cyber-card border border-cyber-border rounded-lg px-4 py-3 text-slate-200 font-mono"
            value={input}
            onChangeText={setInput}
            placeholder="Enter command..."
            placeholderTextColor="#667"
            multiline
            maxLength={1000}
            editable={!loading}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={loading || !input.trim()}
            className={`w-14 h-14 rounded-lg items-center justify-center border ${loading || !input.trim()
                ? 'bg-cyber-card border-cyber-border opacity-50'
                : 'bg-neon-cyan/20 border-neon-cyan'
              }`}
          >
            <Text className="text-neon-cyan text-2xl">➤</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}