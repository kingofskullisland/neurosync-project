/**
 * NeonButton — Pressable button with depth, shadows, and haptic feedback
 * Akira-inspired industrial design
 */
import * as Haptics from 'expo-haptics';
import React, { useRef } from 'react';
import {
    ActivityIndicator,
    Animated,
    Pressable,
    Text,
    ViewStyle,
} from 'react-native';
import { COLORS, SHADOWS } from '../lib/theme';

interface NeonButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'red' | 'amber' | 'teal' | 'blue' | 'green' | 'ghost';
    disabled?: boolean;
    loading?: boolean;
    size?: 'sm' | 'md' | 'lg';
    icon?: string;
}

const VARIANT_CONFIG = {
    red: { bg: '#e6394620', border: COLORS.RED, text: COLORS.RED },
    amber: { bg: '#f59e0b20', border: COLORS.AMBER, text: COLORS.AMBER },
    teal: { bg: '#2dd4bf20', border: COLORS.TEAL, text: COLORS.TEAL },
    blue: { bg: '#38bdf820', border: COLORS.BLUE, text: COLORS.BLUE },
    green: { bg: '#22c55e20', border: COLORS.GREEN, text: COLORS.GREEN },
    ghost: { bg: 'transparent', border: COLORS.BORDER_LIGHT, text: COLORS.TEXT_MED },
};

const SIZE_CONFIG = {
    sm: { paddingH: 12, paddingV: 8, fontSize: 11 },
    md: { paddingH: 20, paddingV: 12, fontSize: 13 },
    lg: { paddingH: 28, paddingV: 16, fontSize: 15 },
};

export function NeonButton({
    title,
    onPress,
    variant = 'blue',
    disabled = false,
    loading = false,
    size = 'md',
    icon,
}: NeonButtonProps) {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const config = VARIANT_CONFIG[variant];
    const sizeConfig = SIZE_CONFIG[size];

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.95,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
    };

    const buttonStyle: ViewStyle = {
        paddingHorizontal: sizeConfig.paddingH,
        paddingVertical: sizeConfig.paddingV,
        borderRadius: 2, // Sharp industrial corners
        borderWidth: 1,
        borderBottomWidth: 3, // Heavy bottom for tactile feel
        borderColor: disabled ? COLORS.BORDER : config.border,
        backgroundColor: disabled ? COLORS.OFFLINE : config.bg,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        ...SHADOWS.sm,
    };

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Pressable
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={disabled || loading}
                style={buttonStyle}
            >
                {loading ? (
                    <ActivityIndicator color={config.text} size="small" />
                ) : (
                    <>
                        {icon && (
                            <Text style={{ fontSize: sizeConfig.fontSize + 2 }}>{icon}</Text>
                        )}
                        <Text
                            style={{
                                color: disabled ? COLORS.TEXT_DIM : config.text,
                                fontFamily: 'monospace',
                                fontWeight: '700',
                                fontSize: sizeConfig.fontSize,
                                textAlign: 'center',
                                textTransform: 'uppercase',
                                letterSpacing: 1.5,
                            }}
                        >
                            {title}
                        </Text>
                    </>
                )}
            </Pressable>
        </Animated.View>
    );
}
