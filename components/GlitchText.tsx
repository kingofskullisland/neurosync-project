/**
 * AkiraTitle — Clean industrial title component
 * Replaces GlitchText with Akira-inspired styling
 */
import React from 'react';
import { Text, View } from 'react-native';
import { COLORS } from '../lib/theme';

interface AkiraTitleProps {
    text: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    accent?: string;
}

export function AkiraTitle({ text, size = 'lg', accent }: AkiraTitleProps) {
    const sizeStyles = {
        sm: { fontSize: 12, letterSpacing: 2, underlineWidth: 20 },
        md: { fontSize: 16, letterSpacing: 3, underlineWidth: 30 },
        lg: { fontSize: 22, letterSpacing: 4, underlineWidth: 40 },
        xl: { fontSize: 32, letterSpacing: 5, underlineWidth: 60 },
    };

    const s = sizeStyles[size];
    const accentColor = accent || COLORS.RED;

    return (
        <View>
            <Text
                style={{
                    fontSize: s.fontSize,
                    fontWeight: '800',
                    color: COLORS.TEXT_BRIGHT,
                    letterSpacing: s.letterSpacing,
                    textTransform: 'uppercase',
                    fontFamily: 'monospace',
                }}
            >
                {text}
            </Text>
            <View
                style={{
                    width: s.underlineWidth,
                    height: 2,
                    backgroundColor: accentColor,
                    marginTop: 4,
                    borderRadius: 1,
                }}
            />
        </View>
    );
}

// Keep backward compat
export const GlitchText = AkiraTitle;
