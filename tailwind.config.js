/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Akira-inspired palette
        'akira-bg': '#060b18',
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
        'neo-green': '#22c55e',
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
    },
  },
  plugins: [],
};