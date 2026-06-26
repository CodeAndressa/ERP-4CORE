import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label, error, hint, icon, iconRight, className = '', ...rest
}, ref) => (
  <div className="flex flex-col gap-1.5">
    {label && (
      <label className="text-xs font-medium text-slate-300 tracking-wide">
        {label}
      </label>
    )}
    <div className="relative flex items-center">
      {icon && (
        <span className="pointer-events-none absolute left-3 text-slate-500">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        className={[
          'w-full rounded-xl border bg-white/5 px-3 py-2.5 text-sm text-slate-100 outline-none transition',
          'placeholder:text-slate-600',
          'focus:border-violet-500/60 focus:bg-white/8 focus:ring-2 focus:ring-violet-500/20',
          error ? 'border-rose-500/50' : 'border-white/10',
          icon ? 'pl-9' : '',
          iconRight ? 'pr-9' : '',
          className,
        ].join(' ')}
        {...rest}
      />
      {iconRight && (
        <span className="absolute right-3 text-slate-500">
          {iconRight}
        </span>
      )}
    </div>
    {error && <p className="text-xs text-rose-400">{error}</p>}
    {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
  </div>
));

Input.displayName = 'Input';
