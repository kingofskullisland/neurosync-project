/**
 * ChatBubble — Message bubble with route badge, shadow depth & entrance animation
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, ViewStyle } from 'react-native';
import { RouteTarget } from '../lib/router';
import { COLORS, SHADOWS } from '../lib/theme';

interface ChatBubbleProps {
    role: 'user' | 'assistant';
    content: string;
    route?: RouteTarget;
    timestamp?: number;
    model?: string;
}

function RouteBadge({ route }: { route: RouteTarget }) {
    const config: Record<RouteTarget, { bg: string; border: string; text: string }> = {
        LOCAL: { bg: '#00ff4118', border: COLORS.GREEN, text: COLORS.GREEN }, // Mechanicus Green
        PC: { bg: '#ffd70018', border: COLORS.GOLD, text: COLORS.GOLD },       // Mechanicus Gold
        CLOUD: { bg: '#ff450018', border: COLORS.RED, text: COLORS.RED },      // Mechanicus Red
    };
    const c = config[route];

    return (
        <View
            style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 3,
                borderWidth: 1,
                borderColor: c.border + '80',
                backgroundColor: c.bg,
            }}
        >
            <Text
                style={{
                    fontSize: 9,
                    fontFamily: 'monospace',
                    fontWeight: '700',
                    color: c.text,
                    letterSpacing: 0.5,
                }}
            >
                {route}
            </Text>
        </View>
    );
}

export function ChatBubble({ role, content, route, timestamp, model }: ChatBubbleProps) {
    const isUser = role === 'user';
    const slideAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const bubbleStyle: ViewStyle = {
        maxWidth: '85%',
        padding: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderLeftWidth: isUser ? 1 : 3,
        borderRightWidth: isUser ? 3 : 1,
        borderColor: isUser ? COLORS.RED + '50' : COLORS.GREEN + '50',
        borderLeftColor: isUser ? (COLORS.RED + '50') : COLORS.GREEN,
        borderRightColor: isUser ? COLORS.RED : (COLORS.GREEN + '50'),
        backgroundColor: isUser ? COLORS.CARD : COLORS.PANEL,
        ...(isUser ? (SHADOWS.md as object) : (SHADOWS.cathodeGlow as object)),
    };

    return (
        <Animated.View
            style={{
                marginBottom: 14,
                alignItems: isUser ? 'flex-end' : 'flex-start',
                opacity: fadeAnim,
                transform: [
                    {
                        translateY: slideAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [12, 0],
                        }),
                    },
                ],
            }}
        >
            <View style={bubbleStyle}>
                {/* Header */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 6,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 10,
                            fontFamily: 'monospace',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: 1.5,
                            color: isUser ? COLORS.RED : COLORS.GREEN,
                        }}
                    >
                        {isUser ? 'OPERATOR' : 'SERVITOR-PRIME [COGITATOR]'}
                    </Text>
                    {route && !isUser && <RouteBadge route={route} />}
                </View>

                {/* Content */}
                <Text
                    style={{
                        color: COLORS.TEXT_BRIGHT,
                        fontSize: 13,
                        lineHeight: 20,
                        fontFamily: 'monospace',
                    }}
                >
                    {content}
                </Text>

                {/* Footer */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    {timestamp && (
                        <Text
                            style={{
                                color: COLORS.TEXT_DIM,
                                fontSize: 9,
                                fontFamily: 'monospace',
                            }}
                        >
                            {new Date(timestamp).toLocaleTimeString()}
                        </Text>
                    )}
                    {model && !isUser && (
                        <Text
                            style={{
                                color: COLORS.TEXT_MUTED,
                                fontSize: 9,
                                fontFamily: 'monospace',
                            }}
                        >
                            {model}
                        </Text>
                    )}
                </View>
            </View>
        </Animated.View>
    );
}
