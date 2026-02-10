import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet, Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const THEME = {
  bg: '#050510',
  card: '#0a0a1f',
  accent: '#00f0ff',
  magenta: '#ff00aa',
  green: '#39ff14',
  text: '#e0e0ff'
};

export default function App() {
  const [conversation, setConversation] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [tier, setTier] = useState('Standby');
  const [battery, setBattery] = useState(0);
  const [vpnIP, setVpnIP] = useState('100.x.x.x'); // Default Tailscale
  const [showConfig, setShowConfig] = useState(false);

  const scanlineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Battery.getBatteryLevelAsync().then(setBattery);
    loadConfig();
    startScanline();
  }, []);

  const startScanline = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanlineAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(scanlineAnim, { toValue: 0, duration: 0, useNativeDriver: true })
      ])
    ).start();
  };

  const loadConfig = async () => {
    const ip = await AsyncStorage.getItem('vpnIP');
    if (ip) setVpnIP(ip);
  };

  const saveConfig = async (ip) => {
    setVpnIP(ip);
    await AsyncStorage.setItem('vpnIP', ip);
  };

  // --- 3-TIER INTELLIGENCE ---
  const fetchWithTimeout = async (resource, options = {}) => {
    const { timeout = 5000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    return response;
  }

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const prompt = inputText;
    setInputText('');
    setConversation(prev => [...prev, { role: 'user', content: prompt }]);
    setLoading(true);

    let finalResponse = null;

    try {
      // TIER 1-2: LOCAL + ROUTER (NeuroSync Backend on port 8082)
      setTier('Local AI Processing...');

      const res = await fetchWithTimeout("http://127.0.0.1:8082/chat", {
        method: 'POST',
        body: JSON.stringify({ prompt }),
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000 // 30s for local processing
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        finalResponse = data.response;
        setTier(`${data.persona} | ${data.route} | Complexity: ${data.complexity.toFixed(3)}`);
      } else {
        // TIER 3: FALLBACK TO PC/CLOUD (if local fails)
        setTier('Tier 3: Nexus (PC/Cloud)');
        const res3 = await fetchWithTimeout(`http://${vpnIP}:5000/process`, {
          method: 'POST',
          body: JSON.stringify({ prompt }),
          headers: { 'Content-Type': 'application/json' },
          timeout: 8000
        });
        const data3 = await res3.json();
        finalResponse = data3.response;
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        finalResponse = "Connection Timed Out. Target system unresponsive.";
      } else {
        finalResponse = "Connection Error. Check Local Bridge or PC VPN.";
      }
    }

    setConversation(prev => [...prev, { role: 'assistant', content: finalResponse, tier: tier }]);
    setLoading(false);
    setTier('Standby');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.scanline, { transform: [{ translateY: scanlineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 800] }) }] }]} />

      <View style={styles.header}>
        <View>
          <Text style={styles.glitchText}>VON.NEXUS_v4</Text>
          <Text style={styles.statusText}>{tier} | BAT: {Math.round(battery * 100)}%</Text>
        </View>
        <TouchableOpacity onPress={() => setShowConfig(true)}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.chat}>
        {conversation.map((msg, i) => (
          <View key={i} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            <Text style={styles.text}>{msg.content}</Text>
            {msg.tier && <Text style={styles.tierTag}>{msg.tier}</Text>}
          </View>
        ))}
        {loading && <ActivityIndicator color={THEME.accent} style={{ margin: 20 }} />}
      </ScrollView>

      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="ENTER COMMAND..."
          placeholderTextColor="#444"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Text style={styles.sendText}>➤</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showConfig} transparent animationType="fade">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>SYSTEM_CONFIG</Text>
          <Text style={styles.label}>NEXUS_PC_IP (Tailscale)</Text>
          <TextInput
            style={styles.modalInput}
            value={vpnIP}
            onChangeText={saveConfig}
            placeholder="100.x.x.x"
            placeholderTextColor="#333"
          />
          <TouchableOpacity style={styles.closeBtn} onPress={() => setShowConfig(false)}>
            <Text style={{ fontWeight: 'bold' }}>CLOSE_INTERFACE</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  scanline: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: 'rgba(0, 240, 255, 0.1)', zIndex: 10 },
  header: { padding: 20, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: THEME.card, flexDirection: 'row', justifyContent: 'space-between' },
  glitchText: { color: THEME.accent, fontSize: 18, fontWeight: 'bold', letterSpacing: 2 },
  statusText: { color: '#666', fontSize: 10, marginTop: 4 },
  settingsIcon: { fontSize: 24, color: THEME.text },
  chat: { flex: 1, padding: 15 },
  bubble: { padding: 15, borderRadius: 2, marginBottom: 15, maxWidth: '90%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#101025', borderRightWidth: 2, borderRightColor: THEME.magenta },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#0a0a15', borderLeftWidth: 2, borderLeftColor: THEME.accent },
  text: { color: THEME.text, fontSize: 14, lineHeight: 20, fontFamily: 'monospace' },
  tierTag: { color: THEME.green, fontSize: 9, marginTop: 8, textAlign: 'right', opacity: 0.7 },
  inputArea: { flexDirection: 'row', padding: 15, borderTopWidth: 1, borderTopColor: THEME.card },
  input: { flex: 1, color: THEME.accent, fontFamily: 'monospace', fontSize: 14, backgroundColor: '#000', padding: 12 },
  sendBtn: { padding: 12, justifyContent: 'center' },
  sendText: { color: THEME.accent, fontSize: 20 },
  modal: { flex: 1, backgroundColor: 'rgba(5, 5, 16, 0.98)', justifyContent: 'center', padding: 40 },
  modalTitle: { color: THEME.magenta, fontSize: 24, marginBottom: 30, textAlign: 'center', fontWeight: 'bold' },
  label: { color: THEME.accent, fontSize: 12, marginBottom: 10 },
  modalInput: { borderBottomWidth: 1, borderBottomColor: THEME.accent, color: '#fff', padding: 10, marginBottom: 30, fontFamily: 'monospace' },
  closeBtn: { backgroundColor: THEME.accent, padding: 15, alignItems: 'center' }
});
