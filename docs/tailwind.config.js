/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // canonical PotenFYR docs tokens (SPEC v1, section 2.1)
        surface: '#0b0d14',
        bg2: '#101320',
        panel: '#151828',
        elevated: '#1a1e32',
        ink: '#e8eaf2',
        ink2: '#b9bfd4',
        muted: '#9aa0b4',
        faint: '#6a7089',
        link: '#c4b5fd',
        linkh: '#f9a8d4',
        accent: {
          DEFAULT: '#8b5cf6',
          2: '#ec4899',
          3: '#f97316',
        },
      },
      maxWidth: {
      },
      animation: {
        shimmer: 'shimmer 2.5s linear infinite',
        marquee: 'marquee 30s linear infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          from: { backgroundPosition: '0 0' },
          to: { backgroundPosition: '-200% 0' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
