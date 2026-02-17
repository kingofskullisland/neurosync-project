/**
 * ModelMonitor — Compact model activity card
 */
import React, { useEffect, useState } from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { loadModelStats, ModelStats } from '../lib/storage';
import { COLORS, SHADOWS } from '../lib/theme';

interface ModelMonitorProps {
    modelName: string;
    compact?: boolean;
}

export function ModelMonitor({ modelName, compact = false }: ModelMonitorProps) {
    const [stats, setStats] = useState<ModelStats | null>(null);

    useEffect(() => {
        loadModelStats().then((all) => {
            if (all[modelName]) setStats(all[modelName]);
        });
    }, [modelName]);

    if (!stats && compact) return null;

    const cardStyle: ViewStyle = {
        backgroundColor: COLORS.CARD,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: COLORS.BORDER,
        padding: compact ? 10 : 14,
        ...SHADOWS.sm,
    };

    const formatTime = (ms: number) => {
        if (ms < 1000) return `${Math.round(ms)}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    const timeSince = (ts: number) => {
        if (!ts) return 'Never';
        const diff = Date.now() - ts;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
        return `${Math.round(diff / 3600000)}h ago`;
    };

    const errorRate = stats
        ? stats.totalRequests > 0
            ? ((stats.totalErrors / stats.totalRequests) * 100).toFixed(0)
            : '0'
        : '—';

    if (compact) {
        return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                    style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor:
                            stats && stats.totalErrors === 0 ? COLORS.GREEN : COLORS.AMBER,
                    }}
                />
                <Text
                    style={{
                        color: COLORS.TEXT_MED,
                        fontFamily: 'monospace',
                        fontSize: 10,
                    }}
                >
                    {modelName}
                </Text>
                {stats && (
                    <Text
                        style={{
                            color: COLORS.TEXT_DIM,
                            fontFamily: 'monospace',
                            fontSize: 9,
                        }}
                    >
                        {formatTime(stats.avgResponseTime)} avg
                    </Text>
                )}
            </View>
        );
    }

    return (
        <View style={cardStyle}>
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 10,
                }}
            >
                <View
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor:
                            stats && stats.totalErrors === 0 ? COLORS.GREEN : COLORS.AMBER,
                        marginRight: 8,
                    }}
                />
                <Text
                    style={{
                        color: COLORS.TEXT_BRIGHT,
                        fontFamily: 'monospace',
                        fontSize: 13,
                        fontWeight: '700',
                        flex: 1,
                    }}
                >
                    {modelName}
                </Text>
                {stats && (
                    <Text
                        style={{
                            color: COLORS.TEXT_DIM,
                            fontFamily: 'monospace',
                            fontSize: 9,
                        }}
                    >
                        {timeSince(stats.lastUsed)}
                    </Text>
                )}
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
                <StatBox
                    label="AVG TIME"
                    value={stats ? formatTime(stats.avgResponseTime) : '—'}
                    color={COLORS.BLUE}
                />
                <StatBox
                    label="REQUESTS"
                    value={stats ? String(stats.totalRequests) : '0'}
                    color={COLORS.TEAL}
                />
                <StatBox
                    label="ERRORS"
                    value={stats ? String(stats.totalErrors) : '0'}
                    color={Number(errorRate) > 10 ? COLORS.RED : COLORS.TEXT_DIM}
                />
                <StatBox label="ERR %" value={`${errorRate}%`} color={COLORS.TEXT_MED} />
            </View>
        </View>
    );
}

function StatBox({
    label,
    value,
    color,
}: {
    label: string;
    value: string;
    color: string;
}) {
    return (
        <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
                style={{
                    color,
                    fontFamily: 'monospace',
                    fontSize: 14,
                    fontWeight: '700',
                }}
            >
                {value}
            </Text>
            <Text
                style={{
                    color: COLORS.TEXT_MUTED,
                    fontFamily: 'monospace',
                    fontSize: 8,
                    marginTop: 2,
                    letterSpacing: 0.5,
                }}
            >
                {label}
            </Text>
        </View>
    );
}
