import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  glass?: boolean;
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

const paddings = { sm: 'p-3 sm:p-4', md: 'p-4 sm:p-5', lg: 'p-4 sm:p-6' };

/** O cartão usa `.surface` de styles.css: superfície, borda fina e a sombra em
 *  duas camadas com um brilho `inset` no topo. É esse brilho que faz o cartão
 *  parecer apoiado na página em vez de desenhado sobre ela; sem ele, branco
 *  sobre quase-branco vira um retângulo de borda cinza, que é a aparência de
 *  interface montada sem referência. */
export function Card({ children, glass = false, hover = false, padding = 'md', className = '', style, ...rest }: CardProps) {
  return (
    <div
      className={[
        'surface',
        hover ? 'surface-interactive cursor-pointer' : '',
        paddings[padding],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        ...(glass
          ? { background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(16px)' }
          : null),
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
