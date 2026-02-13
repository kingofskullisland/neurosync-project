import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

interface CRTScreenProps {
    children: ReactNode;
}

export function CRTScreen({ children }: CRTScreenProps) {
    return (
        <View style={styles.container}>
            {/* Screen Content */}
            <View style={styles.content}>
                {children}
            </View>

            {/* CRT Overlay Effects */}
            <View style={styles.overlay} pointerEvents="none">
                {/* Vignette - Removed to fix NativeViewManagerAdapter crash */}
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.1)' }]} />
                {/* Simulated Scanlines (Using repeating linear gradient in CSS, here just a tint) */}
                <View style={styles.scanlines} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0d0f0d', // mechanicus-dark
        overflow: 'hidden',
    },
    content: {
        flex: 1,
        padding: 4, // Slight inset for bezel effect
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 999,
        pointerEvents: 'none', // Ensure touches pass through
    },
    scanlines: {
        flex: 1,
        // In React Native, complex CSS gradients for scanlines are hard.
        // We rely on the global.css .crt-overlay class applied to a View if using NativeWind,
        // or a simple semi-transparent overlay here.
        backgroundColor: 'rgba(18, 16, 16, 0.1)',
        opacity: 0.3,
    }
});
