import type { ReactNode } from 'react';

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 border-b border-violet-100 pb-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
        <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600">{eyebrow}</p>
        <h1 className="shrink-0 text-xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="min-w-0 truncate text-sm text-slate-600">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function MetricCard({ label, value, detail, tone = 'violet' }: { label: string; value: string; detail: string; tone?: 'violet' | 'emerald' | 'amber' | 'rose' }) {
  const tones = {
    violet: 'text-violet-700',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
  };
  return (
    <article className="rounded-[22px] border border-violet-100 bg-white px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className={`mt-1 text-xs ${tones[tone]}`}>{detail}</p>
    </article>
  );
}

export function SectionCard({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[22px] border border-violet-100 bg-white p-6 ${className}`}>
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function StatusBadge({ children, tone = 'violet' }: { children: ReactNode; tone?: 'violet' | 'emerald' | 'amber' | 'rose' | 'slate' }) {
  const tones = {
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${tones[tone]}`}>{children}</span>;
}

export const primaryButton = 'inline-flex items-center justify-center rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 active:bg-violet-800';
