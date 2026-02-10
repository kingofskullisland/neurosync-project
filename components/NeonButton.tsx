/**
 * Neon Button Component
 */
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';

interface NeonButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'cyan' | 'magenta' | 'green' | 'amber';
    disabled?: boolean;
    loading?: boolean;
}

export function NeonButton({
    title,
    onPress,
    variant = 'cyan',
    disabled = false,
    loading = false,
}: NeonButtonProps) {
    const variants = {
        cyan: 'border-neon-cyan bg-neon-cyan/10',
        magenta: 'border-neon-magenta bg-neon-magenta/10',
        green: 'border-neon-green bg-neon-green/10',
        amber: 'border-neon-amber bg-neon-amber/10',
    };

    const textVariants = {
        cyan: 'text-neon-cyan',
        magenta: 'text-neon-magenta',
        green: 'text-neon-green',
        amber: 'text-neon-amber',
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            className={`px-6 py-3 rounded border ${variants[variant]} ${disabled ? 'opacity-40' : ''}`}
            activeOpacity={0.7}
        >
            {loading ? (
                <ActivityIndicator color="#00f0ff" size="small" />
            ) : (
                <Text className={`${textVariants[variant]} font-mono font-bold text-center uppercase tracking-wider`}>
                    {title}
                </Text>
            )}
        </TouchableOpacity>
    );
}
