import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

// `active:translate-y-px` é o que dá resposta tátil ao clique. Sem isso o botão
// muda de cor e nada mais acontece, que é o acabamento que separa interface
// montada de interface construída.
const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--erp-violet)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none';

// A hierarquia é o ponto. Antes `secondary` e `outline` eram quase iguais, as
// duas com borda e texto violeta, e por isso uma fileira de quatro botões saía
// com todos pedindo a mesma atenção. Agora só o primário tem peso: os outros
// descem em degraus claros até o fantasma, que é só texto.
const variants: Record<Variant, string> = {
  primary:
    'bg-[color:var(--erp-violet)] text-white hover:bg-[#211047] active:bg-[#1a0d38]',
  // Preenchido, sem borda: pesa menos que o primário e mais que o contorno.
  secondary:
    'bg-[color:var(--erp-surface-2)] text-[color:var(--erp-text)] hover:bg-[color:var(--erp-surface-3)]',
  // Borda neutra e texto de tinta, não violeta: contorno colorido competia com
  // a ação principal em toda tela onde os dois apareciam juntos.
  outline:
    'border border-[color:var(--erp-border)] bg-[color:var(--erp-surface)] text-[color:var(--erp-text)] hover:border-[color:var(--erp-border-strong)] hover:bg-[color:var(--erp-surface-2)]',
  ghost:
    'text-[color:var(--erp-text-muted)] hover:bg-[color:var(--erp-surface-2)] hover:text-[color:var(--erp-text)]',
  danger:
    'border border-[color:var(--erp-rose-border)] bg-[color:var(--erp-rose-soft)] text-[color:var(--erp-rose)] hover:bg-[color:var(--erp-rose)] hover:text-white hover:border-transparent',
};

// A altura mínima sai do token de alvo de toque, para o botão nunca ficar abaixo
// do mínimo tocável sem que alguém precise lembrar disso em cada tela.
const sizes: Record<Size, string> = {
  xs: 'min-h-8 px-2.5 py-1.5 text-xs',
  sm: 'min-h-9 px-3.5 py-2 text-sm',
  md: 'min-h-tap px-[18px] py-2.5 text-sm',
  lg: 'min-h-tap px-5 py-3 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading = false, icon, iconRight, children, className = '', disabled, ...rest },
    ref,
  ) => (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  ),
);

Button.displayName = 'Button';
