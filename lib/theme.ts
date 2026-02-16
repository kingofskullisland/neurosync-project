/**
 * NeuroSync — Akira Theme Constants
 * Inspired by Akira (1988) anime aesthetic
 */
import { Platform } from 'react-native';

export const COLORS = {
    // Grimdark / Industrial Palette
    BG: '#080908', // Darker, depth-filled industrial black
    PANEL: '#121412', // Slightly lighter than BG but still very dark
    CARD: '#1E231E', // Dark iron grey
    SURFACE: '#2D382D', // Gunmetal / Iron Plate
    BORDER: '#435043', // Weathered Steel (Dark)
    BORDER_LIGHT: '#8BA38B', // Brushed Steel (Light)
    BRASS: '#8B652E', // Aged Brass
    GOLD_DULL: '#A88B34', // Worn Mechanicus Gold

    // Accents (Enhanced Contrast)
    RED: '#C41E3A', // Cardinal / Blood (Brighter for UI contrast)
    RED_DARK: '#660000', // Deep Dried Blood
    AMBER: '#E67E22', // Industrial Orange
    TEAL: '#00FF41', // Cathode Green (Full Phosphor)
    BLUE: '#1F75FE', // Data Blue (Rich contrast)
    GREEN: '#00FF41', // Cathode Green
    GOLD: '#FFB900', // Polished Gold

    // Text (Tactical Readability)
    TEXT_BRIGHT: '#F0F0F0', // Clean data
    TEXT_MED: '#B0C4B0', // Etched Metal
    TEXT_DIM: '#6E7A6E', // Rusted Surface
    TEXT_MUTED: '#3D473D', // Deep Rust / Carbon

    // Status
    SUCCESS: '#00FF41', // Phosphor Green
    WARNING: '#FFB900', // Amber Bolt
    ERROR: '#C41E3A', // Failure Red
    OFFLINE: '#2C1A1A', // Dead Logic
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
            shadowColor: '#00FF41', // Full Cathode
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 15,
        },
        android: {
            elevation: 12,
            shadowColor: '#00FF41',
        },
        default: {},
    }),
    industrialDepth: Platform.select({
        ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.8,
            shadowRadius: 10,
        },
        android: {
            elevation: 10,
        },
        default: {},
    }),
};
