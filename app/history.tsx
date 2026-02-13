/**
 * NeuroSync — Chat History Screen
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Pressable,
    Text,
    View,
    ViewStyle,
} from 'react-native';
import { AkiraTitle } from '../components/GlitchText';
import { NeonButton } from '../components/NeonButton';
import {
    ChatMeta,
    deleteChat,
    loadChatIndex,
    loadChatMessages,
} from '../lib/storage';
import { COLORS, SHADOWS } from '../lib/theme';

export default function HistoryScreen() {
    const [chats, setChats] = useState<ChatMeta[]>([]);

    const refresh = useCallback(async () => {
        const index = await loadChatIndex();
        setChats(index);
    }, []);

    useEffect(() => {
        refresh();
    }, []);

    const handleDelete = (chat: ChatMeta) => {
        Alert.alert('Delete Chat', `Delete "${chat.title.substring(0, 40)}..."?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await deleteChat(chat.id);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    refresh();
                },
            },
        ]);
    };

    const handleExport = async (chat: ChatMeta) => {
        try {
            const messages = await loadChatMessages(chat.id);
            // For now, show the export data as an alert
            // In the future, this would send to the bridge /export endpoint
            Alert.alert(
                'Export Chat',
                `Chat "${chat.title.substring(0, 30)}..." has ${messages.length} messages.\n\nExport to PC requires the bridge /export endpoint. This feature will send data via the NeuroSync bridge.`
            );
        } catch (error) {
            Alert.alert('Error', 'Failed to load chat for export');
        }
    };

    const formatDate = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const cardStyle: ViewStyle = {
        backgroundColor: COLORS.CARD,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.BORDER,
        padding: 14,
        marginBottom: 10,
        ...(SHADOWS.md as object),
    };

    const renderItem = ({ item }: { item: ChatMeta }) => (
        <View style={cardStyle}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text
                    style={{
                        flex: 1,
                        color: COLORS.TEXT_BRIGHT,
                        fontFamily: 'monospace',
                        fontSize: 13,
                        fontWeight: '600',
                    }}
                    numberOfLines={1}
                >
                    {item.title}
                </Text>
                {item.model && (
                    <Text
                        style={{
                            color: COLORS.BLUE,
                            fontFamily: 'monospace',
                            fontSize: 9,
                            backgroundColor: COLORS.BLUE + '15',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 3,
                        }}
                    >
                        {item.model}
                    </Text>
                )}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ color: COLORS.TEXT_DIM, fontFamily: 'monospace', fontSize: 10 }}>
                    {formatDate(item.date)}
                </Text>
                <Text style={{ color: COLORS.TEXT_MUTED, fontFamily: 'monospace', fontSize: 10 }}>
                    {item.messageCount} msg{item.messageCount !== 1 ? 's' : ''}
                </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                    <NeonButton title="Export" onPress={() => handleExport(item)} variant="teal" size="sm" icon="📤" />
                </View>
                <View style={{ flex: 1 }}>
                    <NeonButton title="Delete" onPress={() => handleDelete(item)} variant="red" size="sm" icon="🗑️" />
                </View>
            </View>
        </View>
    );

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
                    ...(SHADOWS.md as object),
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
                        ...(SHADOWS.sm as object),
                    }}
                >
                    <Text style={{ color: COLORS.BLUE, fontSize: 16, fontWeight: '700' }}>←</Text>
                </Pressable>
                <AkiraTitle text="HISTORY" size="md" />
                <View style={{ flex: 1 }} />
                <Text style={{ color: COLORS.TEXT_DIM, fontFamily: 'monospace', fontSize: 11 }}>
                    {chats.length} chat{chats.length !== 1 ? 's' : ''}
                </Text>
            </View>

            {chats.length === 0 ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                    <Text style={{ fontSize: 48, marginBottom: 16 }}>📋</Text>
                    <Text
                        style={{
                            color: COLORS.TEXT_BRIGHT,
                            fontFamily: 'monospace',
                            fontSize: 14,
                            fontWeight: '700',
                            marginBottom: 8,
                        }}
                    >
                        NO SAVED CHATS
                    </Text>
                    <Text
                        style={{
                            color: COLORS.TEXT_DIM,
                            fontSize: 12,
                            textAlign: 'center',
                            lineHeight: 18,
                        }}
                    >
                        Start a conversation and it will be saved here automatically.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={chats}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: 16 }}
                />
            )}
        </View>
    );
}
