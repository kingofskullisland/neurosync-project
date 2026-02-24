import { useEffect } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

export function PuritySeal({ label = "VERIFIED", type = "secure" }: { label?: string, type?: "secure" | "purge" }) {
    const sway = new Animated.Value(0);

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(sway, { toValue: 1, duration: 2000, useNativeDriver: true }),
                Animated.timing(sway, { toValue: -1, duration: 2000, useNativeDriver: true }),
                Animated.timing(sway, { toValue: 0, duration: 2000, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const rotate = sway.interpolate({
        inputRange: [-1, 1],
        outputRange: ['-2deg', '2deg']
    });

    const color = type === 'secure' ? '#8B0000' : '#000000'; // Dark Red or Black Wax
    const text = type === 'secure' ? 'PURITAS' : 'EXCOMMUNICATE';

    return (
        <View style={styles.container}>
            {/* Wax Seal */}
            <View style={[styles.wax, { backgroundColor: color }]}>
                <View style={styles.waxInner} />
                <Text style={styles.skull}>💀</Text>
            </View>

            {/* Parchment */}
            <Animated.View style={[styles.parchment, { transform: [{ rotate }] }]}>
                <Text style={styles.parchmentText}>
                    {label.toUpperCase()}
                </Text>
                <Text style={styles.parchmentSub}>
                    {text} :: 010101
                </Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: -10,
        right: 20,
        alignItems: 'center',
        zIndex: 50,
    },
    wax: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#4E0000',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 2,
    },
    waxInner: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        margin: 4,
    },
    skull: {
        fontSize: 20,
        color: '#D4C4A8', // Bone
        opacity: 0.9,
    },
    parchment: {
        marginTop: -20, // Tuck under wax
        paddingTop: 24, // Clear wax area
        paddingBottom: 8,
        paddingHorizontal: 8,
        backgroundColor: '#E6D690', // Parchment
        width: 60,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#8B7D6B',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 2,
        zIndex: 1,
    },
    parchmentText: {
        fontFamily: 'Courier',
        fontWeight: 'bold',
        fontSize: 10,
        color: '#4E342E',
        textAlign: 'center',
        lineHeight: 12,
    },
    parchmentSub: {
        fontFamily: 'Courier',
        fontSize: 6,
        color: '#8B0000',
        marginTop: 4,
        textAlign: 'center',
    }
});
