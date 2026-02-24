/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Adeptus Mechanicus Palette (Grimdark v6.0)
        'mechanicus-green': '#20B2AA', // Verdigris / Oxidized Copper
        'mechanicus-red': '#8B0000',   // Crimson / Dried Blood
        'mechanicus-dark': '#050404',  // Void Black
        'mechanicus-plate': '#0F0E0D', // Oiled Iron
        'mechanicus-iron': '#1A1614',  // Deep Rust Shadow
        'mechanicus-gold': '#B8860B',  // Polished Brass
        'mechanicus-brass': '#8B652E', // Worn Brass

        // Akira-inspired palette
        'akira-bg': '#0d0f0d',
        'akira-panel': '#0c1428',
        'akira-card': '#101d35',
        'akira-surface': '#162040',
        'akira-border': '#1e2d52',
        'akira-border-light': '#2a3d6e',

        // Neo-Tokyo accent colors
        'neo-red': '#e63946',
        'neo-red-dark': '#c0392b',
        'neo-amber': '#f59e0b',
        'neo-teal': '#2dd4bf',
        'neo-blue': '#38bdf8',
        'neo-white': '#e2e8f0',
        'neo-ghost': '#94a3b8',
        'neo-green': '#00ff41',

        // Legacy aliases for compatibility during migration
        'cyber-bg': '#060b18',
        'cyber-panel': '#0c1428',
        'cyber-card': '#101d35',
        'cyber-border': '#1e2d52',
        'neon-cyan': '#38bdf8',
        'neon-magenta': '#e63946',
        'neon-green': '#22c55e',
        'neon-amber': '#f59e0b',
      },
      fontFamily: {
        mono: ['SpaceMono', 'Courier', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flicker': 'flicker 0.15s infinite',
      },
      keyframes: {
        flicker: {
          '0%': { opacity: '0.97' },
          '5%': { opacity: '0.95' },
          '10%': { opacity: '0.97' },
          '100%': { opacity: '1' },
        }
      }
    },
  },
  plugins: [],
};