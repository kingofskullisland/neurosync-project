import React, { useEffect, useRef, useState } from 'react';
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
import { API_URL } from '../config';

const { width } = Dimensions.get('window');

export default function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [currentTier, setCurrentTier] = useState('');
  const scrollViewRef = useRef();

  // Test connection on mount
  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.ok) {
        const data = await response.json();
        setStatus('Connected ✓');
        console.log('Health check:', data);
      } else {
        setStatus('Server offline ✗');
      }
    } catch (error) {
      setStatus('Connection failed ✗');
      console.error('Connection error:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    setStatus('Processing...');

    try {
      const response = await fetch(`${API_URL}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: userMessage.content,
          temperature: 0.7,
          max_tokens: 2048
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.response,
        tier: data.tier_used,
        model: data.model,
        processingTime: data.processing_time,
        timestamp: new Date().toLocaleTimeString()
      };

      setMessages(prev => [...prev, aiMessage]);
      setCurrentTier(data.tier_used);
      setStatus(`${data.tier_used} (${data.processing_time.toFixed(2)}s)`);

    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        role: 'error',
        content: `Error: ${error.message}`,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, errorMessage]);
      setStatus('Error ✗');
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setStatus('Cleared');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>VON AGENT</Text>
          <Text style={styles.status}>{status}</Text>
        </View>
        <TouchableOpacity onPress={clearChat} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🤖</Text>
            <Text style={styles.emptyText}>Start a conversation</Text>
            <Text style={styles.emptyHint}>3-Tier AI routing active</Text>
          </View>
        )}

        {messages.map((msg) => (
          <View 
            key={msg.id} 
            style={[
              styles.messageBubble,
              msg.role === 'user' && styles.userBubble,
              msg.role === 'assistant' && styles.aiBubble,
              msg.role === 'error' && styles.errorBubble
            ]}
          >
            <Text style={styles.messageText}>{msg.content}</Text>
            
            {msg.tier && (
              <View style={styles.metaInfo}>
                <Text style={styles.tierBadge}>{msg.tier}</Text>
                <Text style={styles.timestamp}>{msg.timestamp}</Text>
              </View>
            )}

            {msg.role === 'user' && (
              <Text style={styles.timestamp}>{msg.timestamp}</Text>
            )}
          </View>
        ))}

        {isLoading && (
          <View style={styles.loadingBubble}>
            <ActivityIndicator color="#00f0ff" />
            <Text style={styles.loadingText}>Thinking...</Text>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type your message..."
          placeholderTextColor="#666"
          multiline
          maxLength={2000}
          editable={!isLoading}
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
        />
        <TouchableOpacity 
          style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!inputText.trim() || isLoading}
        >
          <Text style={styles.sendButtonText}>→</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a12',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#0d0d1a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a3e',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00f0ff',
    letterSpacing: 2,
  },
  status: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  clearButton: {
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ff00aa',
  },
  clearButtonText: {
    color: '#ff00aa',
    fontSize: 12,
    fontWeight: 'bold',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#00f0ff',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 12,
    color: '#666',
  },
  messageBubble: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    maxWidth: width * 0.8,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#00f0ff22',
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: '#00f0ff44',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#111128',
    borderBottomLeftRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#39ff14',
  },
  errorBubble: {
    alignSelf: 'center',
    backgroundColor: '#ff00aa11',
    borderWidth: 1,
    borderColor: '#ff00aa44',
  },
  messageText: {
    color: '#dde',
    fontSize: 14,
    lineHeight: 20,
  },
  metaInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1a1a3e',
  },
  tierBadge: {
    fontSize: 10,
    color: '#39ff14',
    fontWeight: 'bold',
    backgroundColor: '#39ff1422',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  timestamp: {
    fontSize: 9,
    color: '#666',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#111128',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  loadingText: {
    color: '#00f0ff',
    marginLeft: 8,
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#0d0d1a',
    borderTopWidth: 1,
    borderTopColor: '#1a1a3e',
  },
  input: {
    flex: 1,
    backgroundColor: '#111128',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#dde',
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#1a1a3e',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#666',
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#0a0a12',
    fontSize: 24,
    fontWeight: 'bold',
  },
});