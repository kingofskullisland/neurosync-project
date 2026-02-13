/**
 * NeuroSync — Akira Theme Constants
 * Inspired by Akira (1988) anime aesthetic
 */
import { Platform } from 'react-native';

export const COLORS = {
    // Background layers (deep navy)
    BG: '#060b18',
    PANEL: '#0c1428',
    CARD: '#101d35',
    SURFACE: '#162040',
    BORDER: '#1e2d52',
    BORDER_LIGHT: '#2a3d6e',

    // Accent colors (Neo-Tokyo)
    RED: '#e63946',
    RED_DARK: '#c0392b',
    AMBER: '#f59e0b',
    TEAL: '#2dd4bf',
    BLUE: '#38bdf8',
    GREEN: '#22c55e',

    // Text
    TEXT_BRIGHT: '#e2e8f0',
    TEXT_MED: '#94a3b8',
    TEXT_DIM: '#64748b',
    TEXT_MUTED: '#475569',

    // Status
    SUCCESS: '#22c55e',
    WARNING: '#f59e0b',
    ERROR: '#e63946',
    OFFLINE: '#64748b',
};

export const ROUTE_COLORS = {
    LOCAL: COLORS.GREEN,
    PC: COLORS.BLUE,
    CLOUD: COLORS.RED,
};

export const STATUS = {
    ONLINE: 'online',
    OFFLINE: 'offline',
    CONNECTING: 'connecting',
    ERROR: 'error',
};

/** Elevation/shadow helpers for Android depth */
export const SHADOWS = {
    sm: Platform.select({
        ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.3,
            shadowRadius: 2,
        },
        android: {
            elevation: 2,
        },
        default: {},
    }),
    md: Platform.select({
        ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.4,
            shadowRadius: 6,
        },
        android: {
            elevation: 5,
        },
        default: {},
    }),
    lg: Platform.select({
        ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.5,
            shadowRadius: 12,
        },
        android: {
            elevation: 10,
        },
        default: {},
    }),
    glow: (color: string) =>
        Platform.select({
            ios: {
                shadowColor: color,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 8,
            },
            android: {
                elevation: 6,
            },
            default: {},
        }),
};
