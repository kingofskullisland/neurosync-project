/**
 * Status Pill Component
 */
import React from 'react';
import { Text, View } from 'react-native';

interface StatusPillProps {
    label: string;
    status: 'online' | 'offline' | 'connecting' | 'warning';
    value?: string;
}

export function StatusPill({ label, status, value }: StatusPillProps) {
    const statusColors = {
        online: 'bg-neon-green/20 border-neon-green',
        offline: 'bg-slate-700/50 border-slate-600',
        connecting: 'bg-neon-amber/20 border-neon-amber',
        warning: 'bg-neon-amber/20 border-neon-amber',
    };

    const dotColors = {
        online: 'bg-neon-green',
        offline: 'bg-slate-500',
        connecting: 'bg-neon-amber',
        warning: 'bg-neon-amber',
    };

    return (
        <View className={`flex-row items-center px-3 py-2 rounded border ${statusColors[status]}`}>
            <View className={`w-2 h-2 rounded-full mr-2 ${dotColors[status]}`} />
            <Text className="text-slate-300 text-xs font-mono uppercase">{label}</Text>
            {value && (
                <Text className="text-neon-cyan text-xs font-mono ml-2">{value}</Text>
            )}
        </View>
    );
}
