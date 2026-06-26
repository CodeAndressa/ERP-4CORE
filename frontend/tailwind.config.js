/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg:       '#060517',
        surface:  '#0d0a2a',
        surface2: '#131035',
        border:   'rgba(124,77,255,0.18)',
        violet: {
          450: '#9061f9',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter:  '-0.03em',
        tight:    '-0.02em',
        widest:   '0.18em',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.75rem',
      },
      boxShadow: {
        'glow-violet': '0 0 24px rgba(124,77,255,0.35)',
        'glow-sm':     '0 0 12px rgba(124,77,255,0.2)',
        'card':        '0 18px 50px rgba(6,5,23,0.4)',
        'drawer':      '-8px 0 60px rgba(6,5,23,0.6)',
      },
      animation: {
        'fade-in':      'fadeIn 0.2s ease-out',
        'slide-up':     'slideUp 0.25s ease-out',
        'slide-right':  'slideRight 0.3s cubic-bezier(0.16,1,0.3,1)',
        'pulse-soft':   'pulseSoft 2s ease-in-out infinite',
        'shimmer':      'shimmer 1.8s linear infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0' },                          to: { opacity: '1' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideRight:{ from: { transform: 'translateX(100%)' },         to: { transform: 'translateX(0)' } },
        pulseSoft: { '0%,100%': { opacity: '1' },                    '50%': { opacity: '0.5' } },
        shimmer:   { from: { backgroundPosition: '-200% 0' },        to: { backgroundPosition: '200% 0' } },
      },
      backgroundImage: {
        'shimmer-gradient': 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0) 100%)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
