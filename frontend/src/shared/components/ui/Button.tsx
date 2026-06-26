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

const base = 'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50 select-none';

const variants: Record<Variant, string> = {
  primary: 'bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800',
  secondary: 'border border-violet-100 bg-white text-slate-700 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 active:bg-violet-100',
  ghost: 'text-slate-600 hover:bg-violet-50 hover:text-violet-700 active:bg-violet-100',
  danger: 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300',
  outline: 'border border-violet-200 bg-white text-violet-700 hover:bg-violet-50 hover:border-violet-300',
};

const sizes: Record<Size, string> = {
  xs: 'px-2.5 py-1.5 text-xs',
  sm: 'px-3.5 py-2 text-sm',
  md: 'px-[18px] py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ variant = 'primary', size = 'md', loading = false, icon, iconRight, children, className = '', disabled, ...rest }, ref) => (
  <button ref={ref} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} disabled={disabled || loading} {...rest}>
    {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
    {children}
    {!loading && iconRight}
  </button>
));

Button.displayName = 'Button';
