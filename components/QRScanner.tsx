/**
 * QR Scanner Modal for NeuroBeam
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useState } from 'react';
import {
    Alert,
    Modal,
    Pressable,
    Text,
    View,
} from 'react-native';
import { BeamConfig } from '../lib/neurobeam';
import { COLORS, SHADOWS } from '../lib/theme';
import { NeonButton } from './NeonButton';

interface QRScannerProps {
    visible: boolean;
    onClose: () => void;
    onScan: (config: BeamConfig) => void;
}

export function QRScanner({ visible, onClose, onScan }: QRScannerProps) {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

    const handleBarCodeScanned = ({ data }: { data: string }) => {
        if (scanned) return;
        setScanned(true);

        try {
            const config: BeamConfig = JSON.parse(data);

            // Validate config
            if (!config.host || !config.port || !config.key || !config.sid) {
                throw new Error('Invalid QR code format');
            }

            if (config.v !== 1) {
                throw new Error('Unsupported protocol version');
            }

            // Security: Validate Host IP (Private Networks Only)
            if (!isPrivateIP(config.host)) {
                throw new Error(`Security Risk: Host ${config.host} is not a private IP.`);
            }

            onScan(config);
            onClose();
        } catch (error: any) {
            Alert.alert('Invalid QR Code', error.message);
            setScanned(false);
        }
    };



    if (!permission) {
        return null;
    }

    if (!permission.granted) {
        return (
            <Modal visible={visible} animationType="slide" transparent>
                <View
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.9)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: 20,
                    }}
                >
                    <View
                        style={{
                            backgroundColor: COLORS.CARD,
                            borderRadius: 12,
                            padding: 24,
                            width: '100%',
                            maxWidth: 400,
                            borderWidth: 1,
                            borderColor: COLORS.BORDER,
                            ...(SHADOWS.lg as object),
                        }}
                    >
                        <Text
                            style={{
                                color: COLORS.TEXT_BRIGHT,
                                fontFamily: 'monospace',
                                fontSize: 16,
                                fontWeight: '700',
                                marginBottom: 16,
                                textAlign: 'center',
                            }}
                        >
                            CAMERA PERMISSION
                        </Text>
                        <Text
                            style={{
                                color: COLORS.TEXT_MED,
                                fontSize: 13,
                                lineHeight: 20,
                                marginBottom: 24,
                                textAlign: 'center',
                            }}
                        >
                            NeuroBeam requires camera access to scan the QR code from your desktop bridge.
                        </Text>
                        <View style={{ gap: 10 }}>
                            <NeonButton title="Grant Permission" onPress={requestPermission} variant="blue" />
                            <NeonButton title="Cancel" onPress={onClose} variant="ghost" />
                        </View>
                    </View>
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible={visible} animationType="slide">
            <View style={{ flex: 1, backgroundColor: COLORS.BG }}>
                {/* Header */}
                <View
                    style={{
                        paddingTop: 48,
                        paddingBottom: 16,
                        paddingHorizontal: 16,
                        backgroundColor: COLORS.PANEL,
                        borderBottomWidth: 1,
                        borderBottomColor: COLORS.BORDER,
                        ...(SHADOWS.md as object),
                    }}
                >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text
                            style={{
                                color: COLORS.TEXT_BRIGHT,
                                fontFamily: 'monospace',
                                fontSize: 14,
                                fontWeight: '700',
                                letterSpacing: 1.5,
                            }}
                        >
                            SCAN QR CODE
                        </Text>
                        <Pressable
                            onPress={() => {
                                setScanned(false);
                                onClose();
                            }}
                            style={{
                                padding: 8,
                                borderRadius: 6,
                                backgroundColor: COLORS.CARD,
                                borderWidth: 1,
                                borderColor: COLORS.BORDER,
                            }}
                        >
                            <Text style={{ color: COLORS.RED, fontSize: 16, fontWeight: '700' }}>✕</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Camera view */}
                <View style={{ flex: 1, position: 'relative' }}>
                    <CameraView
                        style={{ flex: 1 }}
                        facing="back"
                        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                        barcodeScannerSettings={{
                            barcodeTypes: ['qr'],
                        }}
                    />

                    {/* Scan frame overlay */}
                    <View
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                        pointerEvents="none"
                    >
                        <View
                            style={{
                                width: 250,
                                height: 250,
                                borderWidth: 2,
                                borderColor: COLORS.RED,
                                borderRadius: 12,
                                backgroundColor: 'transparent',
                            }}
                        >
                            {/* Corner brackets */}
                            {[
                                { top: -2, left: -2 },
                                { top: -2, right: -2 },
                                { bottom: -2, left: -2 },
                                { bottom: -2, right: -2 },
                            ].map((pos, i) => (
                                <View
                                    key={i}
                                    style={{
                                        position: 'absolute',
                                        width: 20,
                                        height: 20,
                                        borderColor: COLORS.RED,
                                        borderWidth: 3,
                                        ...(pos.top !== undefined && pos.left !== undefined
                                            ? { borderRightWidth: 0, borderBottomWidth: 0 }
                                            : pos.top !== undefined && pos.right !== undefined
                                                ? { borderLeftWidth: 0, borderBottomWidth: 0 }
                                                : pos.bottom !== undefined && pos.left !== undefined
                                                    ? { borderRightWidth: 0, borderTopWidth: 0 }
                                                    : { borderLeftWidth: 0, borderTopWidth: 0 }),
                                        ...pos,
                                    }}
                                />
                            ))}
                        </View>
                        <Text
                            style={{
                                color: COLORS.TEXT_BRIGHT,
                                fontFamily: 'monospace',
                                fontSize: 12,
                                marginTop: 24,
                                textAlign: 'center',
                            }}
                        >
                            Align QR code within frame
                        </Text>
                    </View>
                </View>

                {/* Instructions */}
                <View
                    style={{
                        padding: 20,
                        backgroundColor: COLORS.PANEL,
                        borderTopWidth: 1,
                        borderTopColor: COLORS.BORDER,
                    }}
                >
                    <Text
                        style={{
                            color: COLORS.TEXT_DIM,
                            fontSize: 11,
                            lineHeight: 18,
                            textAlign: 'center',
                        }}
                    >
                        Run <Text style={{ color: COLORS.BLUE, fontFamily: 'monospace' }}>python host-bridge.py</Text> on your
                        desktop and scan the QR code displayed in the terminal.
                    </Text>
                </View>
            </View>
        </Modal>
    );
}

// Helper to validate private IP ranges (RFC 1918 + Localhost)
function isPrivateIP(host: string): boolean {
    // Localhost
    if (host === 'localhost' || host === '127.0.0.1') return true;

    // IPv4 Private Ranges
    // 10.x.x.x
    // 172.16.x.x - 172.31.x.x
    // 192.168.x.x
    const parts = host.split('.');
    if (parts.length !== 4) return false; // Basic check, not a full IP regex

    const first = parseInt(parts[0], 10);
    const second = parseInt(parts[1], 10);

    if (first === 10) return true;
    if (first === 172 && second >= 16 && second <= 31) return true;
    if (first === 192 && second === 168) return true;

    return false;
}
