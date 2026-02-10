import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

/**
 * ChatBubble Component
 * Displays messages with persona-based styling:
 * - SPARK (Mobile): Neon green with glow effect
 * - CORE (Heavy): Deep purple with glow effect
 * - User: Dark gray
 */

interface ChatMessage {
    text: string;
    sender: 'user' | 'ai';
    persona?: 'SPARK' | 'CORE';
    reasoning?: string;
}

interface Props {
    message: ChatMessage;
}

export const ChatBubble = ({ message }: Props) => {
    const isAi = message.sender === 'ai';
    const isSpark = message.persona === 'SPARK';
    const isCore = message.persona === 'CORE';

    // Persona-based styling
    const borderColor = isSpark ? '#00ff41' : (isCore ? '#bd00ff' : '#333');
    const glowColor = isSpark
        ? 'rgba(0, 255, 65, 0.15)'
        : (isCore ? 'rgba(189, 0, 255, 0.15)' : 'transparent');

    return (
        <Animated.View
            entering={FadeIn.duration(300)}
            style={[
                styles.bubble,
                isAi && {
                    borderColor: borderColor,
                    borderWidth: 1,
                    backgroundColor: glowColor,
                    shadowColor: borderColor,
                    shadowRadius: 10,
                    shadowOpacity: 0.8,
                    elevation: 5,
                },
                !isAi && styles.userBubble
            ]}
        >
            {/* Optional: Debug/Reasoning Display */}
            {message.reasoning && (
                <Text style={styles.debugText}>
                    [{message.persona} :: {message.reasoning}]
                </Text>
            )}

            <Text style={styles.text}>{message.text}</Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    bubble: {
        padding: 12,
        borderRadius: 12,
        marginVertical: 4,
        maxWidth: '85%',
        alignSelf: 'flex-start',
    },
    userBubble: {
        backgroundColor: '#333',
        alignSelf: 'flex-end',
        borderBottomRightRadius: 2,
    },
    text: {
        color: '#fff',
        fontFamily: 'Courier',
        fontSize: 16,
    },
    debugText: {
        fontSize: 10,
        color: '#aaa',
        marginBottom: 6,
        fontStyle: 'italic',
    }
});
