import { ReactNode } from 'react';
import { View } from 'react-native';

interface CRTScreenProps {
    children: ReactNode;
}

export function CRTScreen({ children }: CRTScreenProps) {
    return (
        <View className="flex-1 bg-mechanicus-dark overflow-hidden relative">
            {/* Screen Content */}
            <View className="flex-1 p-[4px]">
                {children}
            </View>

            {/* CRT Overlay Effects */}
            <View className="absolute inset-0 z-[999] pointer-events-none">
                {/* Vignette */}
                <View className="absolute inset-0 bg-black/10" />
                {/* Scanlines using global.css utility */}
                <View className="flex-1 opacity-30 crt-overlay" />
            </View>
        </View>
    );
}
