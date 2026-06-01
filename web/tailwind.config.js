/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#fafafa',
          100: '#ededee',
          200: '#d6d6d8',
          300: '#a8a8ad',
          400: '#7d7d83',
          500: '#5a5a60',
          600: '#42424a',
          700: '#2d2d33',
          800: '#1d1d22',
          900: '#141418',
          950: '#0b0b0e',
        },
        indigo: {
          50: '#eef3fa',
          100: '#d2def0',
          200: '#a6bedf',
          300: '#7896c7',
          400: '#4f7bb0',
          500: '#3a679d',
          600: '#1e4d8a',
          700: '#173a6c',
          800: '#102a51',
          900: '#0a1d3a',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
