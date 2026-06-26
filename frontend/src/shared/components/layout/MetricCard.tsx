import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Tone = 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan';

interface MetricCardProps {
  label: string;
  value: string;
  detail?: ReactNode;
  trend?: number;
  tone?: Tone;
  icon?: ReactNode;
  sparkline?: number[];
}

const tones: Record<Tone, { bg: string; icon: string; bar: string }> = {
  violet:  { bg: 'from-violet-500/12 to-violet-500/4',  icon: 'bg-violet-500/15 text-violet-300', bar: '#7c4dff' },
  emerald: { bg: 'from-emerald-500/12 to-emerald-500/4', icon: 'bg-emerald-500/15 text-emerald-300', bar: '#34d399' },
  amber:   { bg: 'from-amber-400/12 to-amber-400/4',    icon: 'bg-amber-400/15 text-amber-300',   bar: '#fbbf24' },
  rose:    { bg: 'from-rose-500/12 to-rose-500/4',      icon: 'bg-rose-500/15 text-rose-300',     bar: '#f87171' },
  cyan:    { bg: 'from-cyan-500/12 to-cyan-500/4',      icon: 'bg-cyan-500/15 text-cyan-300',     bar: '#67e8f9' },
};

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex h-8 items-end gap-0.5">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm opacity-70"
          style={{
            height: `${Math.max((v / max) * 100, 8)}%`,
            backgroundColor: color,
          }}
        />
      ))}
    </div>
  );
}

export function MetricCard({ label, value, detail, trend, tone = 'violet', icon, sparkline }: MetricCardProps) {
  const t = tones[tone];
  const TrendIcon = trend == null ? Minus : trend > 0 ? TrendingUp : TrendingDown;
  const trendColor = trend == null ? 'text-slate-500' : trend > 0 ? 'text-emerald-400' : 'text-rose-400';

  return (
    <div
      className={`rounded-2xl bg-gradient-to-br ${t.bg} p-5 shadow-card`}
      style={{ border: '1px solid var(--erp-border)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-widest truncate" style={{ color: 'var(--erp-text-muted)' }}>{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tighter" style={{ color: 'var(--erp-text)', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
          {detail && <div className="mt-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{detail}</div>}
        </div>
        {icon && (
          <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${t.icon}`}>
            {icon}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        {trend != null && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon size={12} />
            <span>{trend > 0 ? '+' : ''}{trend.toFixed(1)}%</span>
          </div>
        )}
        {sparkline && <MiniSparkline data={sparkline} color={t.bar} />}
      </div>
    </div>
  );
}
