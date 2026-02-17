/**
 * NeuroSync — Akira Theme Constants
 * Inspired by Akira (1988) anime aesthetic
 */
<<<<<<< HEAD
import { Platform, ViewStyle } from 'react-native';

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
=======
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
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
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
<<<<<<< HEAD
export const SHADOWS: {
    sm: ViewStyle;
    md: ViewStyle;
    lg: ViewStyle;
    glow: (color: string) => ViewStyle;
    cathodeGlow: ViewStyle;
    industrialDepth: ViewStyle;
} = {
    sm: Platform.select<ViewStyle>({
=======
export const SHADOWS = {
    sm: Platform.select({
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
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
<<<<<<< HEAD
    })!,
    md: Platform.select<ViewStyle>({
=======
    }),
    md: Platform.select({
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
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
<<<<<<< HEAD
    })!,
    lg: Platform.select<ViewStyle>({
=======
    }),
    lg: Platform.select({
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
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
<<<<<<< HEAD
    })!,
    glow: (color: string): ViewStyle =>
        Platform.select<ViewStyle>({
=======
    }),
    glow: (color: string) =>
        Platform.select({
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
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
<<<<<<< HEAD
        })!,
    cathodeGlow: Platform.select<ViewStyle>({
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
    })!,
    industrialDepth: Platform.select<ViewStyle>({
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
    })!,
=======
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
>>>>>>> 5c9349c79ed57672c551b354ee7bdc16bdb15bbd
};
