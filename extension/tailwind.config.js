/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './*.html',
    './src/**/*.{ts,tsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bcd9ff',
          300: '#8ec0ff',
          400: '#599dff',
          500: '#2f7bff',
          600: '#1a5cf0',
          700: '#1647c2',
          800: '#173b97',
          900: '#173575',
        },
        state: {
          new: '#facc15',
          learning: '#fb923c',
          reviewing: '#60a5fa',
          known: '#22c55e',
          ignored: '#9ca3af',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
