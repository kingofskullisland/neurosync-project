/**
 * StatusPill — Compact status indicator with shadow depth
 */
import React from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { COLORS, SHADOWS } from '../lib/theme';

interface StatusPillProps {
    label: string;
    status: 'online' | 'offline' | 'connecting' | 'warning';
    value?: string;
}

const STATUS_STYLES: Record<string, { bg: string; border: string; dot: string }> = {
    online: { bg: '#22c55e15', border: COLORS.GREEN, dot: COLORS.GREEN },
    offline: { bg: '#64748b15', border: COLORS.TEXT_DIM, dot: COLORS.TEXT_DIM },
    connecting: { bg: '#f59e0b15', border: COLORS.AMBER, dot: COLORS.AMBER },
    warning: { bg: '#f59e0b15', border: COLORS.AMBER, dot: COLORS.AMBER },
};

export function StatusPill({ label, status, value }: StatusPillProps) {
    const style = STATUS_STYLES[status] || STATUS_STYLES.offline;

    const containerStyle: ViewStyle = {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: style.border + '60',
        backgroundColor: style.bg,
<<<<<<< HEAD
        ...SHADOWS.sm,
=======
        ...(SHADOWS.sm as object),
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
    };

    return (
        <View style={containerStyle}>
            <View
                style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: style.dot,
                    marginRight: 6,
                }}
            />
            <Text
                style={{
                    color: COLORS.TEXT_MED,
                    fontSize: 10,
                    fontFamily: 'monospace',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                }}
            >
                {label}
            </Text>
            {value && (
                <Text
                    style={{
                        color: COLORS.BLUE,
                        fontSize: 10,
                        fontFamily: 'monospace',
                        marginLeft: 6,
                    }}
                >
                    {value}
                </Text>
            )}
        </View>
    );
}
