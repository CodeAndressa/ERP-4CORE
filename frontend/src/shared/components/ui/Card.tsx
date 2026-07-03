import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  glass?: boolean;
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

const paddings = { sm: 'p-3 sm:p-4', md: 'p-4 sm:p-5', lg: 'p-4 sm:p-6' };

export function Card({ children, glass = false, hover = false, padding = 'md', className = '', style, ...rest }: CardProps) {
  return (
    <div
      className={[
        'rounded-2xl border border-violet-100 bg-white',
        hover ? 'cursor-pointer transition-colors duration-200 hover:border-violet-200 hover:bg-[var(--erp-surface-2)]' : '',
        paddings[padding],
        className,
      ].join(' ')}
      style={{
        background: glass ? 'rgba(255,255,255,0.88)' : 'var(--erp-surface)',
        backdropFilter: glass ? 'blur(16px)' : undefined,
        ...style,
      }}
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
        <h3 className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
