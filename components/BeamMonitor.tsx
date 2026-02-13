/**
 * BeamMonitor Component
 * Akira-styled signal strength visualizer for NeuroBeam connection
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View, ViewStyle } from 'react-native';
import { BeamState, BeamStats } from '../lib/neurobeam';
import { COLORS } from '../lib/theme';

interface BeamMonitorProps {
    stats: BeamStats;
    compact?: boolean;
}

export function BeamMonitor({ stats, compact = false }: BeamMonitorProps) {
    const pulseAnim = useRef(new Animated.Value(0.5)).current;
    const [bars, setBars] = useState([0, 0, 0, 0, 0]);

    // Pulse animation for active states
    useEffect(() => {
        if (stats.state === BeamState.LOCKED || stats.state === BeamState.HANDSHAKING) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(0.5);
        }
    }, [stats.state]);

    // Update signal bars based on latency
    useEffect(() => {
        if (stats.state === BeamState.LOCKED) {
            const strength = Math.max(0, Math.min(5, 5 - Math.floor(stats.latency / 50)));
            setBars(Array.from({ length: 5 }, (_, i) => (i < strength ? 1 : 0)));
        } else if (stats.state === BeamState.HANDSHAKING) {
            setBars([1, 1, 0, 0, 0]);
        } else if (stats.state === BeamState.INTERRUPTED) {
            // Flickering effect
            setBars(Array.from({ length: 5 }, () => Math.random() > 0.5 ? 1 : 0));
        } else {
            setBars([0, 0, 0, 0, 0]);
        }
    }, [stats.state, stats.latency]);

    const getStateColor = (): string => {
        switch (stats.state) {
            case BeamState.LOCKED:
                return COLORS.RED;
            case BeamState.HANDSHAKING:
                return COLORS.BLUE;
            case BeamState.SCANNING:
                return COLORS.AMBER;
            case BeamState.INTERRUPTED:
                return COLORS.AMBER;
            case BeamState.ERROR:
                return COLORS.RED;
            default:
                return COLORS.TEXT_DIM;
        }
    };

    const getStateText = (): string => {
        switch (stats.state) {
            case BeamState.LOCKED:
                return 'BEAM LOCKED';
            case BeamState.HANDSHAKING:
                return 'HANDSHAKING';
            case BeamState.SCANNING:
                return 'SCANNING';
            case BeamState.INTERRUPTED:
                return 'INTERRUPTED';
            case BeamState.ERROR:
                return 'ERROR';
            default:
                return 'IDLE';
        }
    };

    if (compact) {
        return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {/* Signal bars */}
                <View style={{ flexDirection: 'row', gap: 2, alignItems: 'flex-end' }}>
                    {bars.map((active, i) => (
                        <Animated.View
                            key={i}
                            style={{
                                width: 3,
                                height: 6 + i * 2,
                                backgroundColor: active ? getStateColor() : COLORS.BORDER,
                                opacity: active ? pulseAnim : 0.3,
                                borderRadius: 1,
                            }}
                        />
                    ))}
                </View>
                {/* Status text */}
                <Text
                    style={{
                        color: getStateColor(),
                        fontFamily: 'monospace',
                        fontSize: 9,
                        fontWeight: '700',
                        letterSpacing: 0.5,
                    }}
                >
                    {getStateText()}
                </Text>
                {/* Latency */}
                {stats.state === BeamState.LOCKED && (
                    <Text
                        style={{
                            color: COLORS.TEXT_DIM,
                            fontFamily: 'monospace',
                            fontSize: 8,
                        }}
                    >
                        {stats.latency}ms
                    </Text>
                )}
            </View>
        );
    }

    // Full mode
    const cardStyle: ViewStyle = {
        backgroundColor: COLORS.CARD,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: stats.state === BeamState.LOCKED ? getStateColor() + '40' : COLORS.BORDER,
        padding: 16,
    };

    return (
        <View style={cardStyle}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text
                    style={{
                        color: COLORS.TEXT_BRIGHT,
                        fontFamily: 'monospace',
                        fontSize: 11,
                        fontWeight: '700',
                        letterSpacing: 1.5,
                    }}
                >
                    NEUROBEAM STATUS
                </Text>
                <View
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: getStateColor(),
                    }}
                />
            </View>

            {/* Signal bars */}
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-end', marginBottom: 16 }}>
                {bars.map((active, i) => (
                    <Animated.View
                        key={i}
                        style={{
                            flex: 1,
                            height: 20 + i * 8,
                            backgroundColor: active ? getStateColor() : COLORS.SURFACE,
                            opacity: active ? pulseAnim : 0.3,
                            borderRadius: 3,
                            borderWidth: 1,
                            borderColor: active ? getStateColor() : COLORS.BORDER,
                        }}
                    />
                ))}
            </View>

            {/* State text */}
            <Text
                style={{
                    color: getStateColor(),
                    fontFamily: 'monospace',
                    fontSize: 13,
                    fontWeight: '700',
                    letterSpacing: 2,
                    marginBottom: 12,
                }}
            >
                {getStateText()}
            </Text>

            {/* Stats grid */}
            <View style={{ gap: 6 }}>
                <StatRow label="Latency" value={stats.state === BeamState.LOCKED ? `${stats.latency}ms` : '—'} />
                <StatRow
                    label="Connected"
                    value={
                        stats.connectedSince
                            ? new Date(stats.connectedSince).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '—'
                    }
                />
                <StatRow label="Messages" value={`${stats.messagesSent} ↑ / ${stats.messagesReceived} ↓`} />
            </View>

            {/* Error message */}
            {stats.lastError && (
                <View
                    style={{
                        marginTop: 12,
                        padding: 8,
                        backgroundColor: COLORS.RED + '15',
                        borderRadius: 4,
                        borderWidth: 1,
                        borderColor: COLORS.RED + '40',
                    }}
                >
                    <Text
                        style={{
                            color: COLORS.RED,
                            fontFamily: 'monospace',
                            fontSize: 10,
                        }}
                    >
                        {stats.lastError}
                    </Text>
                </View>
            )}
        </View>
    );
}

function StatRow({ label, value }: { label: string; value: string }) {
    return (
        <View
            style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 4,
                borderBottomWidth: 1,
                borderBottomColor: COLORS.BORDER + '30',
            }}
        >
            <Text
                style={{
                    color: COLORS.TEXT_DIM,
                    fontFamily: 'monospace',
                    fontSize: 10,
                }}
            >
                {label}
            </Text>
            <Text
                style={{
                    color: COLORS.TEXT_BRIGHT,
                    fontFamily: 'monospace',
                    fontSize: 10,
                    fontWeight: '600',
                }}
            >
                {value}
            </Text>
        </View>
    );
}
