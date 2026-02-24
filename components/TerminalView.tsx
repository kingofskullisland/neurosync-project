import { useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNoosphere } from '../context/NoosphereContext';

// Utility to generate the current Mechanicus timestamp
const getTimestamp = () => new Date().toLocaleTimeString('en-GB', { hour12: false });

export const TerminalView = () => {
    const { logs, sendIntent, connected } = useNoosphere();
    const [input, setInput] = useState('');
    const flatListRef = useRef<FlatList>(null);

    const handleTransmit = () => {
        if (!input.trim()) return;
        sendIntent(input);
        setInput('');
    };

    const renderMessage = ({ item }: { item: any }) => {
        const isOperator = item.sender === 'OPERATOR';

        return (
            <View style={[styles.messageContainer, isOperator ? styles.alignRight : styles.alignLeft]}>
                <View style={[styles.messageBox, isOperator ? styles.boxOperator : styles.boxSpirit]}>
                    <View style={styles.messageHeader}>
                        <Text style={[styles.headerText, isOperator ? styles.textOperator : styles.textSpirit]}>
                            {isOperator ? 'OPERATOR' : 'HADRON OMEGA-7-7 [ULTIMA ADAPTOR]'}
                        </Text>
                        {!isOperator && <Text style={styles.badgeLocal}>LOCAL</Text>}
                    </View>

                    <Text style={styles.bodyText}>
                        {item.text || JSON.stringify(item.result || item, null, 2)}
                    </Text>

                    <View style={styles.footerInfo}>
                        <Text style={styles.timestamp}>{item.timestamp || getTimestamp()}</Text>
                        <Text style={styles.modelTag}>{isOperator ? '' : 'llama3.2:latest'}</Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Top Status Bar */}
            <View style={styles.topBar}>
                <Text style={styles.titleText}>COGITATOR LINK</Text>
                <Text style={styles.statusText}>
                    {connected ? '// NOOSPHERIC: ONLINE' : '// STATUS: AWAITING RITES'}
                </Text>
            </View>

            {/* ASCII Header */}
            <View style={styles.asciiContainer}>
                <Text style={styles.asciiText}>
                    {`  ___ \n / _ \\ \n| | | |\n| |_| |\n \\___/ `}
                </Text>
                <View style={styles.asciiData}>
                    <Text style={styles.systemText}>[SKULL_ID: 31d-ALPHA]</Text>
                    <Text style={styles.systemText}>[STATUS: AWAITING RITES]</Text>
                </View>
            </View>

            {/* Log Feed */}
            <FlatList
                ref={flatListRef}
                data={logs}
                keyExtractor={(item, index) => index.toString()}
                renderItem={renderMessage}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                style={styles.feed}
            />

            {/* Input Directive Box */}
            <View style={styles.inputContainer}>
                <Text style={styles.inputPrompt}>{`>>> INPUT DIRECTIVE...`}</Text>
                <TextInput
                    style={styles.inputField}
                    value={input}
                    onChangeText={setInput}
                    onSubmitEditing={handleTransmit}
                    placeholderTextColor="#004444"
                    cursorColor="#00ffd0"
                />
                <TouchableOpacity style={styles.transmitButton} onPress={handleTransmit}>
                    <Text style={styles.transmitText}>[TX]</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050505', padding: 10 },
    topBar: { borderBottomWidth: 1, borderColor: '#333', paddingBottom: 10, marginBottom: 10 },
    titleText: { color: '#00ffd0', fontFamily: 'monospace', fontSize: 18, fontWeight: 'bold', letterSpacing: 2 },
    statusText: { color: '#555', fontFamily: 'monospace', fontSize: 12, marginTop: 4 },

    asciiContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    asciiText: { color: '#00ffd0', fontFamily: 'monospace', fontSize: 10 },
    asciiData: { marginLeft: 20 },
    systemText: { color: '#00ffd0', fontFamily: 'monospace', fontSize: 12 },

    feed: { flex: 1 },
    messageContainer: { marginBottom: 15, width: '100%' },
    alignLeft: { alignItems: 'flex-start' },
    alignRight: { alignItems: 'flex-end' },

    messageBox: {
        maxWidth: '85%',
        borderWidth: 1,
        padding: 10,
        backgroundColor: '#0a0a0a'
    },
    boxSpirit: { borderColor: '#00ffd0', borderLeftWidth: 3 },
    boxOperator: { borderColor: '#ff3333', borderRightWidth: 3 },

    messageHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    headerText: { fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold' },
    textSpirit: { color: '#00ffd0' },
    textOperator: { color: '#ff3333' },

    badgeLocal: { backgroundColor: '#004422', color: '#00ffd0', fontFamily: 'monospace', fontSize: 10, paddingHorizontal: 4 },

    bodyText: { color: '#cccccc', fontFamily: 'monospace', fontSize: 14, lineHeight: 20 },

    footerInfo: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, borderTopWidth: 1, borderColor: '#222', paddingTop: 5 },
    timestamp: { color: '#555', fontFamily: 'monospace', fontSize: 10 },
    modelTag: { color: '#555', fontFamily: 'monospace', fontSize: 10 },

    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#00ffd0',
        padding: 10,
        marginTop: 10
    },
    inputPrompt: { color: '#004444', fontFamily: 'monospace', fontSize: 14, marginRight: 10 },
    inputField: { flex: 1, color: '#00ffd0', fontFamily: 'monospace', fontSize: 14, padding: 0 },
    transmitButton: { marginLeft: 10 },
    transmitText: { color: '#00ffd0', fontFamily: 'monospace', fontSize: 14 }
});
