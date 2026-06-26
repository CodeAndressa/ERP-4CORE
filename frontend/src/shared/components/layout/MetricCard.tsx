import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus, Info, ChevronDown } from 'lucide-react';

type Tone = 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan';

interface MetricCardProps {
  label: string;
  value: string;
  detail?: ReactNode;
  trend?: number;
  tone?: Tone;
  icon?: ReactNode;
  sparkline?: number[];
  tooltip?: string;
  expandable?: boolean;
  onExpand?: () => void;
  expanded?: boolean;
}

const tones: Record<Tone, { bg: string; icon: string; bar: string; accent: string }> = {
  violet:  { bg: 'bg-white', icon: 'bg-[var(--erp-violet-soft)] text-[var(--erp-violet)]', bar: '#2b165c', accent: 'var(--erp-violet)' },
  emerald: { bg: 'bg-white', icon: 'bg-emerald-50 text-emerald-700', bar: '#047857', accent: '#047857' },
  amber:   { bg: 'bg-white', icon: 'bg-amber-50 text-amber-700', bar: '#b45309', accent: '#b45309' },
  rose:    { bg: 'bg-white', icon: 'bg-rose-50 text-rose-700', bar: '#be123c', accent: '#be123c' },
  cyan:    { bg: 'bg-white', icon: 'bg-cyan-50 text-cyan-700', bar: '#0891b2', accent: '#0891b2' },
};

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex h-8 items-end gap-0.5">
      {data.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm opacity-70" style={{ height: `${Math.max((v / max) * 100, 8)}%`, backgroundColor: color }} />
      ))}
    </div>
  );
}

function Tooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setVisible(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative inline-flex" style={{ verticalAlign: 'middle' }}>
      <button type="button" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)} onClick={() => setVisible((v) => !v)} className="flex items-center justify-center rounded-full opacity-60 transition-opacity hover:opacity-100" style={{ color: 'var(--erp-text-muted)' }}>
        <Info size={13} />
      </button>
      {visible && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed" style={{ background: 'var(--erp-surface)', borderColor: 'var(--erp-border-strong)', color: 'var(--erp-text)' }}>
          {text}
        </div>
      )}
    </div>
  );
}

export function MetricCard({ label, value, detail, trend, tone = 'violet', icon, sparkline, tooltip, expandable, onExpand, expanded }: MetricCardProps) {
  const t = tones[tone];
  const TrendIcon = trend == null ? Minus : trend > 0 ? TrendingUp : TrendingDown;
  const trendColor = trend == null ? 'text-slate-500' : trend > 0 ? 'text-emerald-700' : 'text-rose-700';

  return (
    <div className={`rounded-[22px] border bg-white px-5 py-4 transition-colors ${t.bg}`} style={{ borderColor: expanded ? 'var(--erp-border-strong)' : 'var(--erp-border)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--erp-text-muted)' }}>{label}</p>
            {tooltip && <Tooltip text={tooltip} />}
          </div>
          <p className="mt-1.5 text-2xl font-bold tracking-tight" style={{ color: 'var(--erp-text)', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
          {detail && <div className="mt-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{detail}</div>}
        </div>
        {icon && <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${t.icon}`}>{icon}</div>}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="flex items-center gap-2">
          {trend != null && <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}><TrendIcon size={12} /><span>{trend > 0 ? '+' : ''}{trend.toFixed(1)}%</span></div>}
          {expandable && (
            <button type="button" onClick={onExpand} className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors" style={{ background: expanded ? 'var(--erp-violet-soft)' : 'var(--erp-surface)', color: expanded ? 'var(--erp-violet)' : 'var(--erp-text-muted)', borderColor: 'var(--erp-border)' }}>
              {expanded ? 'Ocultar' : 'Ver detalhes'}
              <ChevronDown size={11} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
          )}
        </div>
        {sparkline && <MiniSparkline data={sparkline} color={t.bar} />}
      </div>
    </div>
  );
}
