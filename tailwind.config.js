/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        mel: {
          bg: '#0a0b0f',
          surface: '#12131a',
          card: '#16171f',
          border: '#2a2b35',
          accent: '#4ecdc4',
          purple: '#a78bfa',
          orange: '#f59e0b',
          pink: '#f472b6',
          blue: '#60a5fa',
          green: '#34d399',
        }
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
