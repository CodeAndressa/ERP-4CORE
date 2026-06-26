import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  glass?: boolean;
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

const paddings = { sm: 'p-4', md: 'p-5', lg: 'p-6' };

export function Card({ children, glass = false, hover = false, padding = 'md', className = '', ...rest }: CardProps) {
  return (
    <div
      className={[
        'rounded-2xl border border-white/8 shadow-card',
        glass ? 'bg-white/[0.04] backdrop-blur-xl' : 'bg-[#0d0a2a]',
        hover ? 'transition-all duration-200 hover:border-violet-500/30 hover:shadow-glow-sm cursor-pointer' : '',
        paddings[padding],
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
