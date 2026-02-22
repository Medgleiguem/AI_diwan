/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        arabic: ['Scheherazade New', 'Noto Naskh Arabic', 'serif'],
        display: ['Playfair Display', 'serif'],
        sans: ['IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
      },
      colors: {
        parchment: {
          50: '#fdf8f0',
          100: '#f9edd8',
          200: '#f2d9ac',
          300: '#e8bf7a',
          400: '#dca04a',
          500: '#c8862d',
          600: '#a86b22',
          700: '#8a531d',
          800: '#70421d',
          900: '#5c371a',
        },
        ink: {
          50: '#f3f0ea',
          100: '#e5dfd1',
          200: '#cbbfa6',
          300: '#ae9b78',
          400: '#957d54',
          500: '#7a6540',
          600: '#5e4d30',
          700: '#453825',
          800: '#2e261a',
          900: '#1a1510',
          950: '#0e0c08',
        },
        gold: {
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        }
      },
      backgroundImage: {
        'paper-texture': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")",
      },
      animation: {
        'shimmer': 'shimmer 2s linear infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'verse-appear': 'verseAppear 0.6s ease-out both',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        verseAppear: {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        }
      },
    },
  },
  plugins: [],
}
