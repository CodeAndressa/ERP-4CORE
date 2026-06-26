import type { ReactNode } from 'react';

type Tone = 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'slate' | 'blue';

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}

const tones: Record<Tone, string> = {
  violet:  'bg-violet-500/15 text-violet-200 border-violet-500/25',
  emerald: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/25',
  amber:   'bg-amber-400/15 text-amber-200 border-amber-400/25',
  rose:    'bg-rose-500/15 text-rose-200 border-rose-500/25',
  cyan:    'bg-cyan-500/15 text-cyan-200 border-cyan-500/25',
  slate:   'bg-slate-500/15 text-slate-300 border-slate-500/25',
  blue:    'bg-blue-500/15 text-blue-200 border-blue-500/25',
};

const dots: Record<Tone, string> = {
  violet: 'bg-violet-400', emerald: 'bg-emerald-400', amber: 'bg-amber-400',
  rose: 'bg-rose-400', cyan: 'bg-cyan-400', slate: 'bg-slate-400', blue: 'bg-blue-400',
};

export function Badge({ children, tone = 'violet', dot = false, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dots[tone]}`} />}
      {children}
    </span>
  );
}

export function NotifBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}
