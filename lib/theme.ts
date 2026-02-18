/**
 * NeuroSync — Adeptus Mechanicus Theme Constants
 * Inspired by the Forge Worlds of the Omnissiah
 * "The Machine God watches over all."
 */
import { Platform, ViewStyle } from 'react-native';

export const COLORS = {
    // Grimdark / Industrial Palette (Updated for v6.0 ULTIMA)
    BG: '#050404', // Void Black (Warm undertone)
    PANEL: '#0F0E0D', // Oiled Iron
    CARD: '#1A1614', // Deep Rust Shadow
    SURFACE: '#241F1C', // Weathered Plasteel
    BORDER: '#5C3A2E', // Oxidized Iron
    BORDER_LIGHT: '#8B652E', // Worn Brass
    BRASS: '#B8860B', // Polished Brass
    GOLD_DULL: '#8B652E', // Aged Gold

    // Accents (Grimdark Contrast)
    RED: '#8B0000', // Crimson / Blood
    RED_DARK: '#4A0404', // Dried Blood
    AMBER: '#D45500', // Forge Fire
    TEAL: '#20B2AA', // Oxidized Copper (Verdigris)
    BLUE: '#191970', // Midnight / Void Blue
    GREEN: '#006400', // Dark Gothic Green
    GOLD: '#FFD700', // Holy Gold (Purity)

    // Text (Parchment & Terminal)
    TEXT_BRIGHT: '#E6DCC3', // Parchment (Clean)
    TEXT_MED: '#C4B99A', // Parchment (Aged)
    TEXT_DIM: '#8C7E6A', // Faded Ink
    TEXT_MUTED: '#594D3F', // Ancient Stain

    // Status
    SUCCESS: '#228B22', // Forest Green (Muted)
    WARNING: '#D4AF37', // Warning Gold
    ERROR: '#8B0000', // Critical Failure
    OFFLINE: '#1A120B', // Dead Machine Spirit
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

/** Adeptus Mechanicus — Forge World Extended Palette */
export const MECHANICUS = {
    // Structural
    WORN_METAL: '#4A4A42',      // Weathered adamantium
    RIVET_STEEL: '#5C5C52',     // Forged rivets
    RUST: '#6B3A2A',            // Oxidized iron
    PARCHMENT: '#C4B99A',       // Tech-priest scrollwork
    HOLY_OIL: '#1A120B',        // Sacred machine oil
    DARK_IRON: '#141414',       // Void-black iron

    // Glow effects
    INCENSE_GLOW: '#D4A017',    // Burning incense
    FORGE_EMBER: '#E25822',     // Forge furnace
    PHOSPHOR_GREEN: '#00FF41',  // Cathode / data streams
    WARP_RED: '#8B0000',        // Warning / sanctified error

    // Accent borders
    BRASS_TRIM: '#8B652E',      // Mechanicus brass inlay
    COPPER_TRACE: '#B87333',    // Circuit trace copper
    AQUILA_GOLD: '#D4AF37',     // Imperial double-headed eagle
};

/** Elevation/shadow helpers for Android depth */
export const SHADOWS: {
    sm: ViewStyle;
    md: ViewStyle;
    lg: ViewStyle;
    glow: (color: string) => ViewStyle;
    cathodeGlow: ViewStyle;
    industrialDepth: ViewStyle;
} = {
    sm: Platform.select<ViewStyle>({
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
    })!,
    md: Platform.select<ViewStyle>({
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
    })!,
    lg: Platform.select<ViewStyle>({
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
    })!,
    glow: (color: string): ViewStyle =>
        Platform.select<ViewStyle>({
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
};
