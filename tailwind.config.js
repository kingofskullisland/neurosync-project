/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Adeptus Mechanicus Palette
        'mechanicus-green': '#00ff41',
        'mechanicus-red': '#ff4500',
        'mechanicus-dark': '#0d0f0d',
        'mechanicus-plate': '#2d382d',
        'mechanicus-gold': '#ffd700', // For ornamental details

        // Legacy/Akira support (mapping to new theme where appropriate or keeping for compat)
        'akira-bg': '#0d0f0d', // Mapped to dark
        'akira-panel': '#0c1428',
        'neo-red': '#ff4500',
        'neo-green': '#00ff41',
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