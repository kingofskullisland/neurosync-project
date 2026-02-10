/**
 * Glitch Text Component
 */
import React from 'react';
import { Text, View } from 'react-native';

interface GlitchTextProps {
    text: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function GlitchText({ text, size = 'lg' }: GlitchTextProps) {
    const sizeClasses = {
        sm: 'text-sm',
        md: 'text-lg',
        lg: 'text-2xl',
        xl: 'text-4xl',
    };

    return (
        <View className="relative">
            <Text
                className={`${sizeClasses[size]} font-bold text-neon-cyan tracking-widest uppercase font-mono`}
            >
                {text}
            </Text>
        </View>
    );
}
