/** @type {import('tailwindcss').Config} */

// As cores apontam para os tokens de styles.css em vez de repetir os valores.
// Antes elas eram hex fixos que duplicavam os tokens, e os tons que as telas mais
// precisavam (texto secundário, borda, superfície recuada) não existiam como
// utilitário nenhum. Era por isso que o código tinha 1.140 `style={{}}`, dos quais
// ~95% só carregavam cor: não havia `text-ink-muted` para escrever no lugar.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--erp-bg)',
        surface: {
          DEFAULT: 'var(--erp-surface)',
          2: 'var(--erp-surface-2)',
          3: 'var(--erp-surface-3)',
        },
        ink: {
          DEFAULT: 'var(--erp-text)',
          muted: 'var(--erp-text-muted)',
          dim: 'var(--erp-text-dim)',
        },
        erp: {
          border: 'var(--erp-border)',
          'border-strong': 'var(--erp-border-strong)',
        },
        // O acento único do sistema. `violet.450` fica porque já é usado.
        accent: {
          DEFAULT: 'var(--erp-violet)',
          light: 'var(--erp-violet-light)',
          soft: 'var(--erp-violet-soft)',
          dim: 'var(--erp-violet-dim)',
        },
        violet: {
          450: '#3f2479',
        },
        // Semânticas com os três níveis que o DESIGN.md pede: base é o texto,
        // -soft é o fundo, -border é a borda.
        success: {
          DEFAULT: 'var(--erp-emerald)',
          soft: 'var(--erp-emerald-soft)',
          border: 'var(--erp-emerald-border)',
        },
        warning: {
          DEFAULT: 'var(--erp-amber)',
          soft: 'var(--erp-amber-soft)',
          border: 'var(--erp-amber-border)',
        },
        danger: {
          DEFAULT: 'var(--erp-rose)',
          soft: 'var(--erp-rose-soft)',
          border: 'var(--erp-rose-border)',
        },
        info: {
          DEFAULT: 'var(--erp-cyan)',
          deep: 'var(--erp-cyan-deep)',
          soft: 'var(--erp-cyan-soft)',
          border: 'var(--erp-cyan-border)',
        },
      },
      fontFamily: {
        sans: ['Geist Variable', 'Geist', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        tightest: '0',
        tighter: '0',
        tight: '0',
        widest: '0.18em',
      },
      // A escala do DESIGN.md: sm 8 / md 12 / lg 16 / full. `xl` continua 12px
      // porque é o raio mais usado no código (258 ocorrências) e corresponde ao md.
      borderRadius: {
        lg: 'var(--erp-radius-sm)',
        xl: 'var(--erp-radius-md)',
        '2xl': 'var(--erp-radius-lg)',
        '3xl': '1.25rem',
        '4xl': '1.75rem',
      },
      boxShadow: {
        float: 'var(--erp-shadow-float)',
      },
      minHeight: {
        tap: 'var(--erp-tap)',
      },
      minWidth: {
        tap: 'var(--erp-tap)',
      },
      zIndex: {
        header: 'var(--erp-z-header)',
        overlay: 'var(--erp-z-overlay)',
        floating: 'var(--erp-z-floating)',
        popover: 'var(--erp-z-popover)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'slide-right': 'slideRight 0.3s cubic-bezier(0.16,1,0.3,1)',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        shimmer: 'shimmer 1.8s linear infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideRight: { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        pulseSoft: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
      backgroundImage: {
        'shimmer-gradient': 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(43,22,92,0.05) 50%, rgba(255,255,255,0) 100%)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
