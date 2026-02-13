import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';

const MESSAGES = [
    "[PULSE] HIVE-SPIRE GAMMA REPORTS 12% INCREASE IN ORE OUTPUT...",
    "[PULSE] INQUISITORIAL MANDATE 442.1 ACTIVE...",
    "[PULSE] PRAISE BE TO THE OMNISSIAH...",
    "[ALERT] WARP STORM DETECTED IN SECTOR 7...",
    "[UPDATE] SERVO-SKULL 9 HAS RETURNED...",
];

export function NoosphericStream() {
    const translateX = useSharedValue(100);

    useEffect(() => {
        translateX.value = withRepeat(
            withTiming(-100, {
                duration: 20000,
                easing: Easing.linear,
            }),
            -1, // Infinite
            false
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: `${translateX.value}%` }],
        };
    });

    return (
        <View className="h-6 bg-mechanicus-dark border-t border-mechanicus-plate overflow-hidden justify-center">
            <Animated.View style={[animatedStyle, { flexDirection: 'row', width: '200%' }]}>
                <Text className="text-mechanicus-green font-mono text-[10px] whitespace-nowrap">
                    {MESSAGES.join("   ///   ")}
                </Text>
            </Animated.View>
        </View>
    );
}
