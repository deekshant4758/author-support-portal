/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#f8f9ff',
        'surface-dim': '#cbdbf5',
        'surface-lowest': '#ffffff',
        'surface-low': '#eff4ff',
        'surface-container': '#e5eeff',
        'surface-high': '#dce9ff',
        'surface-highest': '#d3e4fe',
        ink: '#0b1c30',
        muted: '#3d4a42',
        outline: '#bccac0',
        primary: {
          DEFAULT: '#006948',
          container: '#00855d',
          fixed: '#85f8c4',
          ink: '#002114',
        },
        leaf: '#059669',
        ai: {
          DEFAULT: '#4648d4',
          soft: '#eef2ff',
          border: '#c7d2fe',
          deep: '#4338ca',
        },
        danger: {
          DEFAULT: '#ba1a1a',
          soft: '#fef2f2',
          border: '#fecaca',
          deep: '#b91c1c',
        },
        warning: {
          DEFAULT: '#b45309',
          soft: '#fffbeb',
          border: '#fde68a',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        display: ['2.25rem', { lineHeight: '2.6rem', letterSpacing: '-0.03em', fontWeight: '700' }],
        'headline-lg': ['1.75rem', { lineHeight: '2.1rem', letterSpacing: '-0.025em', fontWeight: '600' }],
        'headline-md': ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.015em', fontWeight: '600' }],
        'headline-sm': ['1.0625rem', { lineHeight: '1.5rem', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-lg': ['1rem', { lineHeight: '1.625rem', letterSpacing: '-0.005em', fontWeight: '400' }],
        'body-md': ['0.875rem', { lineHeight: '1.45rem', fontWeight: '400' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.35rem', fontWeight: '400' }],
        'label-md': ['0.8125rem', { lineHeight: '1.125rem', letterSpacing: '0.01em', fontWeight: '500' }],
        'label-sm': ['0.6875rem', { lineHeight: '0.875rem', letterSpacing: '0.04em', fontWeight: '600' }],
        metric: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '-0.01em', fontWeight: '600' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11, 28, 48, 0.04)',
        lift: '0 4px 16px -2px rgba(15, 23, 42, 0.06), 0 2px 4px -1px rgba(15, 23, 42, 0.03)',
        drawer: '-8px 0 32px -4px rgba(15, 23, 42, 0.08)',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'loading-bar': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(250%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.28s ease-out both',
        'slide-in': 'slide-in 0.25s ease-out both',
        'pulse-soft': 'pulseSoft 2.2s ease-in-out infinite',
        // Delayed so fast/cached requests never flash the overlay.
        'fade-in': 'fade-in 0.2s ease-out 0.18s both',
        'loading-bar': 'loading-bar 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
};
