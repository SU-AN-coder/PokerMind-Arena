/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0e1a',
        felt: '#0d3320',
        gold: '#c9a84c',
        danger: '#e63946',
        neon: '#4cc9f0',
        paper: '#f0e6d3'
      },
      fontFamily: {
        display: ['Cinzel', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 4px 15px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
};

