/**
 * NeuroSync — Akira Theme Constants
 * Inspired by Akira (1988) anime aesthetic
 */
import { Platform } from 'react-native';

export const COLORS = {
    // Grimdark / Industrial Palette
    BG: '#0F0F0F', // Deep industrial black
    PANEL: '#1A1A1A', // Darker panel
    CARD: '#2C2C2C', // Iron grey
    SURFACE: '#333333', // Lighter iron
    BORDER: '#6E4D25', // Aged Brass (Dark)
    BORDER_LIGHT: '#A87B43', // Polished Brass (Light)

    // Accents
    RED: '#8B0000', // Dried Blood Red
    RED_DARK: '#4E0000', // Deep crimson
    AMBER: '#D35400', // Burning Ember
    TEAL: '#2ECC71', // Cathode Green (Replacing Teal)
    BLUE: '#3CB371', // Industrial Green (Replacing Blue)
    GREEN: '#3CB371', // Industrial Green
    GOLD: '#FFD700', // Mechanicus Gold

    // Text
    TEXT_BRIGHT: '#E0E0E0', // Parchment / Etched Metal
    TEXT_MED: '#A0A0A0', // Worn Metal
    TEXT_DIM: '#606060', // Rusted Metal
    TEXT_MUTED: '#404040', // Dark Rust

    // Status
    SUCCESS: '#2ECC71', // Cathode Green
    WARNING: '#D35400', // Ember
    ERROR: '#8B0000', // Blood Red
    OFFLINE: '#4E342E', // Rust
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
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.5,
            shadowRadius: 3,
        },
        android: {
            elevation: 3,
        },
        default: {},
    }),
    md: Platform.select({
        ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.6,
            shadowRadius: 8,
        },
        android: {
            elevation: 6,
        },
        default: {},
    }),
    lg: Platform.select({
        ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.7,
            shadowRadius: 16,
        },
        android: {
            elevation: 12,
        },
        default: {},
    }),
    glow: (color: string) =>
        Platform.select({
            ios: {
                shadowColor: color,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 10,
            },
            android: {
                elevation: 8,
            },
            default: {},
        }),
    cathodeGlow: Platform.select({
        ios: {
            shadowColor: COLORS.TEAL, // Cathode Green
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.7,
            shadowRadius: 12,
        },
        android: {
            elevation: 10,
            shadowColor: COLORS.TEAL,
        },
        default: {},
    }),
};
