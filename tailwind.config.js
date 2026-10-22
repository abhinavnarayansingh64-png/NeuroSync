/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // NeuroSync — black signal field.
        // Black is the dominant surface; cream is reserved for readable type,
        // borders, and deliberate interaction highlights.
        base: '#090909',
        surface: '#0d0d0c',
        card: '#121211',
        'card-hover': '#191816',
        border: '#2c2a27',
        'border-strong': '#4b4741',
        // primary signal — restrained cream
        accent: {
          DEFAULT: '#f7f0e5',
          hover: '#fffdf7',
          edge: '#ffffff',
          soft: 'rgba(247, 240, 229, 0.08)',
          border: 'rgba(247, 240, 229, 0.24)',
          wash: 'rgba(247, 240, 229, 0.12)',
        },
        content: {
          primary: '#f7f0e5',
          secondary: '#c8c2b9',
          muted: '#8f887e',
        },
        // Functional statuses retain restrained signal color while all structural surfaces stay black.
        status: {
          success: '#4ade80',
          'success-soft': 'rgba(74, 222, 128, 0.11)',
          'success-border': 'rgba(74, 222, 128, 0.34)',
          running: '#7dd3fc',
          'running-soft': 'rgba(125, 211, 252, 0.11)',
          'running-border': 'rgba(125, 211, 252, 0.30)',
          warning: '#facc15',
          'warning-soft': 'rgba(250, 204, 21, 0.11)',
          'warning-border': 'rgba(250, 204, 21, 0.34)',
          danger: '#fb7185',
          'danger-soft': 'rgba(251, 113, 133, 0.11)',
          'danger-border': 'rgba(251, 113, 133, 0.34)',
          'danger-strong': '#f43f5e',
          idle: '#8f887e',
        },
      },
      fontFamily: {
        // Inter for body/UI; Space Grotesk for display (headlines, logo).
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      letterSpacing: {
        display: '-0.021em', // Seline display tracking
        heading: '-0.017em',
      },
      borderRadius: {
        // Seline shape language: inputs 6px, cards 10px, feature/modal 16px,
        // pills/buttons fully rounded, icons 4px.
        md: '6px',
        lg: '8px',
        xl: '10px', // content cards
        '2xl': '16px', // modals, feature cards, hero preview
        full: '9999px',
      },
      boxShadow: {
        subtle: 'rgba(40, 31, 22, 0.08) 0px 1px 2px 0px',
        card: 'rgba(40, 31, 22, 0.10) 0px 10px 28px 0px',
        float: 'rgba(40, 31, 22, 0.15) 0px 18px 55px 0px',
      },
      transitionTimingFunction: {
        // Signal & Structure easing — see src/motion-tokens.md
        'motion-ease-out': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'motion-ease-in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        // — Signal & Structure structural motion primitives —
        'ns-rise': {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'ns-rise-slow': {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'ns-settle': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'ns-pop': {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'ns-slide-left': {
          '0%': { opacity: '0', transform: 'translateX(-14px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'ns-slide-right': {
          '0%': { opacity: '0', transform: 'translateX(14px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'ns-scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'ns-line-draw': {
          '0%': { strokeDashoffset: '100%' },
          '100%': { strokeDashoffset: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'slide-in': 'slide-in 0.2s ease-out',
        'pulse-dot': 'pulse-dot 1.4s ease-in-out infinite',
        // — Signal & Structure structural motion —
        'ns-rise': 'ns-rise 0.36s motion-ease-out both',
        'ns-rise-slow': 'ns-rise-slow 0.7s motion-ease-out both',
        'ns-settle': 'ns-settle 0.28s motion-ease-out both',
        'ns-pop': 'ns-pop 0.24s motion-ease-out both',
        'ns-slide-left': 'ns-slide-left 0.3s motion-ease-out both',
        'ns-slide-right': 'ns-slide-right 0.3s motion-ease-out both',
        'ns-scale-in': 'ns-scale-in 0.24s motion-ease-out both',
        'ns-line-draw': 'ns-line-draw 1.1s motion-ease-in-out both',
      },
    },
  },
  plugins: [],
}
