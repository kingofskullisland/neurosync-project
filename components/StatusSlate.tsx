import React from 'react';
import { Text, View } from 'react-native';

export function StatusSlate() {
    return (
        <View className="border-t-2 border-mechanicus-plate bg-mechanicus-dark p-2">
            <View className="flex-row justify-between mb-1">
                <Text className="text-mechanicus-green font-mono text-[10px]">LOGIC ENGINE</Text>
                <Text className="text-mechanicus-green font-mono text-[10px]">SANCTIFIED</Text>
            </View>
            <View className="flex-row justify-between mb-1">
                <Text className="text-mechanicus-green font-mono text-[10px]">TEMP</Text>
                <Text className="text-mechanicus-green font-mono text-[10px]">312.15K</Text>
            </View>
            <View className="flex-row justify-between">
                <Text className="text-mechanicus-red font-mono text-[10px]">WARP SIG</Text>
                <Text className="text-mechanicus-green font-mono text-[10px]">NEG</Text>
            </View>
            <Text className="text-mechanicus-plate font-mono text-[8px] text-center mt-1">
                Prop. of Mars Forge World // 31d-Alpha
            </Text>
        </View>
    );
}
