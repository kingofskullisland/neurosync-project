import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNoosphere } from '../context/NoosphereContext';

export default function TetherStatus() {
    const { inferenceMode, upstreamUrl, activeAgent, disconnectTether } = useNoosphere();

    // If we are local, we can return null if we don't want to show anything, 
    // or a subtle indicator.
    if (inferenceMode === 'local') {
        return (
            <View style={[styles.container, styles.local]}>
                <Ionicons name="hardware-chip-outline" size={16} color="#666" />
                <Text style={styles.textLocal}>On-Device Intelligence ({activeAgent})</Text>
            </View>
        );
    }

    // If tethered, show the "High Power" indicator with Disconnect button
    return (
        <View style={[styles.container, styles.tethered]}>
            <View style={styles.infoRow}>
                <Ionicons name="flash" size={16} color="#FFD700" />
                <View style={styles.textColumn}>
                    <Text style={styles.textTethered}>TETHERED TO DESKTOP</Text>
                    <Text style={styles.subText}>{upstreamUrl?.replace('http://', '')}</Text>
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
        width: '100%',
    },
    local: {
        backgroundColor: '#111',
        borderBottomColor: '#222',
        justifyContent: 'center',
        gap: 8,
    },
    tethered: {
        backgroundColor: '#4B0082', // Indigo background for Tether mode
        borderBottomColor: '#6A0DAD',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    textColumn: {
        flexDirection: 'column',
    },
    textLocal: {
        color: '#666',
        fontSize: 12,
        fontWeight: '600',
    },
    textTethered: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    subText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 10,
    },
    disconnectBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 12,
    },
    disconnectText: {
        color: 'white',
        fontSize: 11,
        fontWeight: '600',
    }
});
