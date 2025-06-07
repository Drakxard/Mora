/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#121212',
          secondary: '#1E1E1E',
          tertiary: '#2A2A2A'
        },
        primary: {
          DEFAULT: '#7C3AED',
          light: '#8B5CF6',
          dark: '#4C1D95'
        },
        text: {
          primary: '#F9FAFB',
          secondary: '#D1D5DB',
          tertiary: '#9CA3AF'
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
};