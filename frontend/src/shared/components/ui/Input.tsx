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
      <label className="text-xs font-medium tracking-wide text-slate-600">
        {label}
      </label>
    )}
    <div className="relative flex items-center">
      {icon && (
        <span className="pointer-events-none absolute left-3 text-slate-400">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        className={[
          'w-full rounded-full border bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition',
          'placeholder:text-slate-400',
          'focus:border-violet-400 focus:ring-4 focus:ring-violet-100',
          error ? 'border-rose-300' : 'border-violet-100',
          icon ? 'pl-9' : '',
          iconRight ? 'pr-9' : '',
          className,
        ].join(' ')}
        {...rest}
      />
      {iconRight && (
        <span className="absolute right-3 text-slate-400">
          {iconRight}
        </span>
      )}
    </div>
    {error && <p className="text-xs text-rose-600">{error}</p>}
    {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
  </div>
));

Input.displayName = 'Input';
