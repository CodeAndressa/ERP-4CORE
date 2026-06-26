import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size    = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060517] disabled:opacity-50 disabled:pointer-events-none select-none';

const variants: Record<Variant, string> = {
  primary:   'bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-glow-sm hover:brightness-110 active:brightness-95',
  secondary: 'bg-white/8 border border-white/10 text-slate-200 hover:bg-white/12 hover:border-white/20 active:bg-white/6',
  ghost:     'text-slate-400 hover:text-white hover:bg-white/6 active:bg-white/4',
  danger:    'bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 hover:border-rose-500/50',
  outline:   'border border-violet-500/40 text-violet-300 hover:bg-violet-500/10 hover:border-violet-500/70',
};

const sizes: Record<Size, string> = {
  xs: 'px-2.5 py-1.5 text-xs',
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  children,
  className = '',
  disabled,
  ...rest
}, ref) => (
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
));

Button.displayName = 'Button';
