/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        'cyber-bg': '#0a0a12',
        'cyber-panel': '#0d0d1a',
        'cyber-card': '#111128',
        'cyber-border': '#1a1a3e',
        'neon-cyan': '#00f0ff',
        'neon-magenta': '#ff00aa',
        'neon-green': '#39ff14',
        'neon-amber': '#ffaa00',
      },
    },
  },
  plugins: [],
};