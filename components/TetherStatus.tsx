import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNoosphere } from '../context/NoosphereContext';

export default function TetherStatus() {
    const { inferenceMode, upstreamUrl, activeAgent, disconnectTether } = useNoosphere();

    // ─── Local Mode: subtle indicator ──────────────────────────────
    if (inferenceMode === 'local') {
        return (
            <View style={[styles.container, styles.local]}>
                <Ionicons name="phone-portrait-outline" size={16} color="#888" />
                <Text style={styles.textLocal}>
                    On-Device Intelligence ({activeAgent})
                </Text>
            </View>
        );
    }

    // ─── Tethered Mode: high-power indicator + disconnect button ───
    return (
        <View style={[styles.container, styles.tethered]}>
            <View style={styles.infoRow}>
                <Ionicons name="flash" size={16} color="#FFD700" />
                <View style={styles.textColumn}>
                    <Text style={styles.textTethered}>TETHERED TO DESKTOP</Text>
                    <Text style={styles.subText}>
                        {upstreamUrl?.replace('http://', '')}
                    </Text>
                </View>
            </View>

            <TouchableOpacity onPress={disconnectTether} style={styles.disconnectBtn}>
                <Text style={styles.disconnectText}>Disconnect</Text>
                <Ionicons name="close-circle" size={18} color="white" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    local: {
        backgroundColor: '#1A120B', // Holy Oil
        borderBottomColor: '#332211',
        justifyContent: 'center',
        gap: 8,
    },
    tethered: {
        backgroundColor: '#1A1614', // Deep Rust
        borderBottomColor: '#8B652E', // Brass
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    textColumn: {
        flexDirection: 'column',
    },
    textLocal: {
        color: '#888',
        fontSize: 12,
        fontFamily: 'monospace',
    },
    textTethered: {
        color: '#FFD700',
        fontSize: 13,
        fontWeight: 'bold',
        fontFamily: 'monospace',
        letterSpacing: 1,
    },
    subText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 10,
        fontFamily: 'monospace',
    },
    disconnectBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    disconnectText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
});
