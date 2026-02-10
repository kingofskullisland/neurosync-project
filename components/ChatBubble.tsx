/**
 * Chat Bubble Component with Route Badge
 */
import React from 'react';
import { Text, View } from 'react-native';
import { RouteTarget } from '../lib/router';

interface ChatBubbleProps {
    role: 'user' | 'assistant';
    content: string;
    route?: RouteTarget;
    timestamp?: number;
}

function RouteBadge({ route }: { route: RouteTarget }) {
    const colors = {
        LOCAL: 'bg-neon-green/20 border-neon-green text-neon-green',
        PC: 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan',
        CLOUD: 'bg-neon-magenta/20 border-neon-magenta text-neon-magenta',
    };

    return (
        <View className={`px-2 py-0.5 rounded border ${colors[route]}`}>
            <Text className={`text-xs font-mono ${colors[route].split(' ')[2]}`}>
                {route}
            </Text>
        </View>
    );
}

export function ChatBubble({ role, content, route, timestamp }: ChatBubbleProps) {
    const isUser = role === 'user';

    return (
        <View className={`mb-4 ${isUser ? 'items-end' : 'items-start'}`}>
            <View
                className={`max-w-[85%] p-4 rounded-lg border ${isUser
                        ? 'bg-cyber-card border-neon-magenta/40'
                        : 'bg-cyber-panel border-neon-cyan/40'
                    }`}
            >
                {/* Header */}
                <View className="flex-row items-center justify-between mb-2">
                    <Text className={`text-xs font-mono uppercase tracking-wide ${isUser ? 'text-neon-magenta' : 'text-neon-cyan'
                        }`}>
                        {isUser ? 'USER' : 'VON'}
                    </Text>
                    {route && !isUser && <RouteBadge route={route} />}
                </View>

                {/* Content */}
                <Text className="text-slate-200 text-sm leading-relaxed font-mono">
                    {content}
                </Text>

                {/* Timestamp */}
                {timestamp && (
                    <Text className="text-slate-500 text-xs mt-2 font-mono">
                        {new Date(timestamp).toLocaleTimeString()}
                    </Text>
                )}
            </View>
        </View>
    );
}
