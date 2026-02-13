/**
 * ModelPicker — Dropdown model selector with status indicators
 */
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
    ViewStyle,
} from 'react-native';
import { getModels, ModelInfo } from '../lib/api';
import { COLORS, SHADOWS } from '../lib/theme';

interface ModelPickerProps {
    serverIp: string;
    selectedModel: string;
    onSelectModel: (model: string) => void;
}

export function ModelPicker({ serverIp, selectedModel, onSelectModel }: ModelPickerProps) {
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [expanded, setExpanded] = useState(false);

    const fetchModels = async () => {
        if (!serverIp) {
            setError('No server IP configured');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const data = await getModels(serverIp);
            setModels(data.models || []);
        } catch (err: any) {
            setError(err.message || 'Failed to load models');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (serverIp) fetchModels();
    }, [serverIp]);

    const formatSize = (bytes: number) => {
        if (!bytes) return '';
        const gb = bytes / (1024 * 1024 * 1024);
        return gb >= 1 ? `${gb.toFixed(1)}GB` : `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
    };

    const containerStyle: ViewStyle = {
        backgroundColor: COLORS.CARD,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.BORDER,
        overflow: 'hidden',
        ...(SHADOWS.md as object),
    };

    return (
        <View style={containerStyle}>
            {/* Selected model header */}
            <Pressable
                onPress={() => setExpanded(!expanded)}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 14,
                    backgroundColor: COLORS.SURFACE,
                }}
            >
                <View style={{ flex: 1 }}>
                    <Text
                        style={{
                            color: COLORS.TEXT_BRIGHT,
                            fontFamily: 'monospace',
                            fontSize: 13,
                            fontWeight: '600',
                        }}
                    >
                        {selectedModel || 'No model selected'}
                    </Text>
                    <Text
                        style={{
                            color: COLORS.TEXT_DIM,
                            fontFamily: 'monospace',
                            fontSize: 10,
                            marginTop: 2,
                        }}
                    >
                        {models.length > 0
                            ? `${models.length} model${models.length !== 1 ? 's' : ''} available`
                            : 'Tap to load models'}
                    </Text>
                </View>
                <Text style={{ color: COLORS.TEXT_MED, fontSize: 14 }}>
                    {expanded ? '▲' : '▼'}
                </Text>
            </Pressable>

            {/* Expanded model list */}
            {expanded && (
                <View style={{ borderTopWidth: 1, borderTopColor: COLORS.BORDER }}>
                    {loading ? (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <ActivityIndicator color={COLORS.BLUE} />
                            <Text
                                style={{
                                    color: COLORS.TEXT_DIM,
                                    fontFamily: 'monospace',
                                    fontSize: 11,
                                    marginTop: 8,
                                }}
                            >
                                Loading models...
                            </Text>
                        </View>
                    ) : error ? (
                        <View style={{ padding: 14 }}>
                            <Text
                                style={{
                                    color: COLORS.ERROR,
                                    fontFamily: 'monospace',
                                    fontSize: 11,
                                    textAlign: 'center',
                                }}
                            >
                                {error}
                            </Text>
                            <Pressable
                                onPress={fetchModels}
                                style={{
                                    marginTop: 8,
                                    padding: 8,
                                    borderRadius: 4,
                                    borderWidth: 1,
                                    borderColor: COLORS.BLUE + '60',
                                    alignItems: 'center',
                                }}
                            >
                                <Text
                                    style={{
                                        color: COLORS.BLUE,
                                        fontFamily: 'monospace',
                                        fontSize: 11,
                                    }}
                                >
                                    RETRY
                                </Text>
                            </Pressable>
                        </View>
                    ) : (
                        <ScrollView style={{ maxHeight: 250 }}>
                            {models.map((model) => {
                                const isSelected = model.name === selectedModel;
                                return (
                                    <Pressable
                                        key={model.name}
                                        onPress={() => {
                                            onSelectModel(model.name);
                                            setExpanded(false);
                                        }}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            padding: 12,
                                            paddingHorizontal: 14,
                                            borderBottomWidth: 1,
                                            borderBottomColor: COLORS.BORDER + '40',
                                            backgroundColor: isSelected ? COLORS.BLUE + '12' : 'transparent',
                                        }}
                                    >
                                        <View
                                            style={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: 4,
                                                backgroundColor: isSelected ? COLORS.BLUE : COLORS.BORDER_LIGHT,
                                                marginRight: 10,
                                            }}
                                        />
                                        <View style={{ flex: 1 }}>
                                            <Text
                                                style={{
                                                    color: isSelected ? COLORS.BLUE : COLORS.TEXT_BRIGHT,
                                                    fontFamily: 'monospace',
                                                    fontSize: 12,
                                                    fontWeight: isSelected ? '700' : '400',
                                                }}
                                            >
                                                {model.name}
                                            </Text>
                                            {model.details && (
                                                <Text
                                                    style={{
                                                        color: COLORS.TEXT_DIM,
                                                        fontFamily: 'monospace',
                                                        fontSize: 9,
                                                        marginTop: 2,
                                                    }}
                                                >
                                                    {model.details.parameter_size} · {model.details.quantization_level}
                                                </Text>
                                            )}
                                        </View>
                                        <Text
                                            style={{
                                                color: COLORS.TEXT_MUTED,
                                                fontFamily: 'monospace',
                                                fontSize: 10,
                                            }}
                                        >
                                            {formatSize(model.size)}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    )}
                </View>
            )}
        </View>
    );
}
