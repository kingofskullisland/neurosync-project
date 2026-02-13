import React from 'react';
import { Text, View } from 'react-native';

const ASCII_SKULL = `
         ___
     _.-'___'-._
    / __/   \\__ \\
   | (  / _ \\  ) |
   |  \\ \\___/ /  |
    \\_ '-----' _/
  ____'-------'____
 /    \\       /    \\
`.trim();

export function ServoSkull({ status = "VIGILANT" }: { status?: string }) {
    return (
        <View className="flex-row items-center justify-center p-4 border border-mechanicus-plate bg-mechanicus-dark mb-4">
            <Text className="text-mechanicus-green font-mono text-xs leading-none">
                {ASCII_SKULL}
            </Text>
            <View className="ml-4 flex-1">
                <Text className="text-mechanicus-green font-mono text-xs font-bold">[SKULL_ID: 31d-ALPHA]</Text>
                <Text className="text-mechanicus-green font-mono text-xs">[STATUS: {status}]</Text>
                <Text className="text-mechanicus-green font-mono text-xs">[NOOSPHERIC: ONLINE]</Text>
            </View>
        </View>
    );
}
