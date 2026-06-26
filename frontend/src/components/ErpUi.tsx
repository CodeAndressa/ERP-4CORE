import type { ReactNode } from 'react';

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <header className="flex flex-col gap-5 rounded-[28px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_80px_rgba(15,10,40,0.2)] backdrop-blur-xl lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">{eyebrow}</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{description}</p></div>{action}</header>;
}

export function MetricCard({ label, value, detail, tone = 'violet' }: { label: string; value: string; detail: string; tone?: 'violet' | 'emerald' | 'amber' | 'rose' }) {
  const tones = { violet: 'from-violet-500/18 to-fuchsia-500/5', emerald: 'from-emerald-500/18 to-emerald-500/5', amber: 'from-amber-400/18 to-amber-500/5', rose: 'from-rose-500/18 to-rose-500/5' };
  return <article className={`rounded-[22px] border border-white/10 bg-gradient-to-br ${tones[tone]} p-5 shadow-[0_18px_45px_rgba(15,10,40,0.16)]`}><p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-300">{label}</p><p className="mt-3 text-2xl font-semibold text-white">{value}</p><p className="mt-2 text-xs text-slate-300">{detail}</p></article>;
}

export function SectionCard({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return <section className={`rounded-[24px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_18px_50px_rgba(15,10,40,0.14)] ${className}`}><div className="mb-5"><h2 className="text-lg font-semibold text-white">{title}</h2>{subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}</div>{children}</section>;
}

export function StatusBadge({ children, tone = 'violet' }: { children: ReactNode; tone?: 'violet' | 'emerald' | 'amber' | 'rose' | 'slate' }) {
  const tones = { violet: 'bg-violet-400/15 text-violet-100', emerald: 'bg-emerald-400/15 text-emerald-100', amber: 'bg-amber-300/15 text-amber-100', rose: 'bg-rose-400/15 text-rose-100', slate: 'bg-slate-400/15 text-slate-200' };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export const primaryButton = 'inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(124,77,255,0.25)] transition hover:brightness-110';
