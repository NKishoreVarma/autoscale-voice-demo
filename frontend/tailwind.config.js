/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Deep navy/slate foundation + restrained indigo/violet accent.
        ink: {
          950: '#0a0f1e',
          900: '#0f162b',
          850: '#141c35',
          800: '#1b2440',
          700: '#273152',
          600: '#3a4568',
        },
        accent: {
          DEFAULT: '#6366f1', // indigo-500
          soft: '#818cf8',
          strong: '#4f46e5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.3), 0 8px 24px -12px rgba(0,0,0,0.5)',
        pop: '0 12px 40px -12px rgba(0,0,0,0.6)',
      },
      keyframes: {
        rise: { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        rise: 'rise 0.25s ease-out both',
      },
    },
  },
  plugins: [],
};
