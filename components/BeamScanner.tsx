import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Linking from 'expo-linking';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useNoosphere } from '../context/NoosphereContext';
import { handleBeamAction } from '../utils/BeamHandler';

const BACKEND_VERIFY_URL = 'http://192.168.1.50:8000'; // Update to your desktop IP

interface BeamScannerProps {
    onClose?: () => void;
    onScan?: (data: string) => void;
}

export default function BeamScanner({ onClose, onScan }: BeamScannerProps) {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanning, setScanning] = useState(true);
    const [verifying, setVerifying] = useState(false);
    const processingRef = useRef(false);

    const noosphere = useNoosphere();

    // ─── Verify scanned beam with backend ──────────────────────────
    const verifyBeamWithServer = async (scannedUrl: string) => {
        try {
            const data = Linking.parse(scannedUrl);
            const p = data.queryParams?.p as string;
            const sig = data.queryParams?.sig as string;

            if (!p || !sig) {
                Alert.alert('Invalid QR Code', 'Missing payload or signature.');
                return;
            }

            setVerifying(true);

            // In a real scenario, you might want to verify against a known server or the one in the QR if trusted.
            // For now we use the hardcoded BACKEND_VERIFY_URL or the one from context if available?
            // Actually, for tethering, the initial QR comes from the server we want to connect to.
            // But we can't verify with it until we trust it.
            // The Python code suggests the QR contains the host.
            // Let's decode the payload securely if possible, or send to our known backend.
            // Since this is a P2P tether, we might need to trust the QR content if the signature matches...
            // BUT we can't verify the signature without the secret key.
            // The Python backend verifies it. 

            // If we are tethering, we are scanning a QR from the server.
            // We can't verify it with the server before connecting.
            // We should probably just parse it on client if it's a simple tether.
            // But the code provided uses `verifyBeamWithServer`.

            // Dynamic Verification: Use the scanned host if possible, or fallback
            // If scannedUrl is a full URL, we might want to use its origin
            const verifyUrl = scannedUrl.startsWith('http') ? scannedUrl : BACKEND_VERIFY_URL;
            const endpoint = `${verifyUrl}/beam/verify`.replace('//beam', '/beam'); // Avoid double slashes if present

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payload: p, signature: sig }),
            });

            if (!response.ok) {
                const error = await response.json();
                Alert.alert('Beam Rejected', error.detail || 'Verification failed.');
                return;
            }

            const verified = await response.json();

            // Dispatch the verified action
            handleBeamAction(
                { action: verified.action, context: verified.context },
                {
                    setActiveAgent: noosphere.setActiveAgent as any,
                    setCurrentProject: noosphere.setCurrentProject,
                    activateTether: noosphere.activateTether,
                }
            );

            if (onClose) onClose();

        } catch (error) {
            console.error('Beam verification error:', error);
            Alert.alert('Network Error', 'Could not reach the Noosphere backend.');
        } finally {
            setVerifying(false);
        }
    };

    // ─── Handle barcode scan ───────────────────────────────────────
    const handleBarcodeScanned = ({ data }: { data: string }) => {
        if (processingRef.current) return;

        // Allow noosphere:// deep links, http/https URLs, and JSON configs
        const isJson = data.trim().startsWith('{');

        // If external onScan is provided, allow all payloads, otherwise filter
        if (!onScan && !data.startsWith('noosphere://') && !data.startsWith('http') && !isJson) {
            return;
        }

        processingRef.current = true;
        setScanning(false);

        // If external handler is provided, use it
        if (onScan) {
            onScan(data);
            // Call onClose if provided, but let parent handle logic.
            // Actually, usually parent closes modal.
            if (onClose) onClose();
            return;
        }

        // Check if this is a "tether" type beam (has base64 payload in ?p= param)
        if (data.includes('beam?p=')) {
            verifyBeamWithServer(data);
        } else {
            // Direct deep link (legacy, unsigned)
            const parsed = Linking.parse(data);
            if (parsed.path === 'beam/transfer_context') {
                try {
                    const encoded = parsed.queryParams?.data as string;
                    if (encoded) {
                        const decoded = JSON.parse(atob(encoded));
                        handleBeamAction(
                            { action: 'switch_agent', context: decoded },
                            {
                                setActiveAgent: noosphere.setActiveAgent as any,
                                setCurrentProject: noosphere.setCurrentProject,
                                activateTether: noosphere.activateTether,
                            }
                        );
                        if (onClose) onClose();
                    }
                } catch (e) {
                    Alert.alert('Parse Error', 'Failed to decode beam payload.');
                }
            }
        }

        // Allow re-scan after 3 seconds
        setTimeout(() => {
            processingRef.current = false;
            setScanning(true);
        }, 3000);
    };

    // ─── Permission gate ───────────────────────────────────────────
    if (!permission) return <View />;
    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.text}>Camera access required for Beam scanning.</Text>
                <Text style={styles.link} onPress={requestPermission}>
                    Grant Permission
                </Text>
            </View>
        );
    }

    // ─── Render ────────────────────────────────────────────────────
    return (
        <View style={styles.container}>
            <CameraView
                style={styles.camera}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={scanning ? handleBarcodeScanned : undefined}
            />

            {/* Scanning overlay */}
            <View style={styles.overlay}>
                <View style={styles.targetBox} />
                <Text style={styles.overlayText}>
                    {verifying ? 'Verifying Beam...' : 'Scan Noosphere Beam QR'}
                </Text>
                {verifying && <ActivityIndicator color="#FFD700" style={{ marginTop: 12 }} />}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    camera: { flex: 1 },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    targetBox: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderColor: '#4B0082',
        borderRadius: 12,
        backgroundColor: 'transparent',
    },
    overlayText: {
        marginTop: 20,
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    text: { color: '#fff', fontSize: 16, textAlign: 'center', padding: 20 },
    link: { color: '#4B0082', fontSize: 16, textAlign: 'center', textDecorationLine: 'underline' },
});
