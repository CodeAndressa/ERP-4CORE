import { useEffect, useState } from 'react';
import { Globe, TrendingUp, Users, MousePointerClick, Smartphone, Monitor, Tablet, RefreshCw } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../services/api';
import { Card } from '../shared/components/ui/Card';
import { MetricCard } from '../shared/components/layout/MetricCard';

interface DailyPoint { date: string; visitors: number; pageviews: number; }
interface TopPage { path: string; views: number; unique_visitors: number; }
interface Source { source: string; visitors: number; percentage: number; }
interface Device { device: string; visitors: number; percentage: number; }
interface SiteData {
  configured?: boolean;
  message?: string;
  synced_at?: string;
  summary: { visitors: number; pageviews: number; conversions: number; leads: number; conversion_rate?: number; bounce_rate?: number; };
  daily?: DailyPoint[];
  top_pages?: TopPage[];
  sources?: Source[];
  devices?: Device[];
}

const DEVICE_ICON = (d: string) => {
  if (d.toLowerCase().includes('mobile'))  return <Smartphone size={12} />;
  if (d.toLowerCase().includes('tablet'))  return <Tablet size={12} />;
  return <Monitor size={12} />;
};

const PERIOD_OPTIONS = [
  { label: '7d',  value: 7  },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

const SOURCE_COLORS = ['#7c3aed', '#a78bfa', '#c4b5fd', '#6d28d9', '#e5e7eb'];

export default function SiteMetricsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<SiteData>(`/site/dashboard?days=${days}`)
      .then(({ data: d }) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days]);

  const s = data?.summary;
  const daily = data?.daily ?? [];
  const chartData = daily.map((d) => ({ ...d, date: d.date.slice(5) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Analytics · Supabase</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Métricas do Site</h1>
          {data?.synced_at && (
            <p className="text-xs mt-1" style={{ color: 'var(--erp-text-dim)' }}>
              Atualizado: {new Date(data.synced_at).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {loading && <RefreshCw size={13} className="animate-spin mr-2" style={{ color: 'var(--erp-text-dim)' }} />}
          {PERIOD_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setDays(opt.value)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: days === opt.value ? 'var(--erp-violet-dim)' : 'transparent',
                color: days === opt.value ? 'var(--erp-violet-light)' : 'var(--erp-text-muted)',
                border: days === opt.value ? '1px solid var(--erp-violet)44' : '1px solid transparent',
              }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {data && !data.configured && data.message && (
        <div className="rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
          {data.message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Visitantes"    value={loading ? '…' : String(s?.visitors ?? 0)}    detail={`últimos ${days} dias`}                                                            tone="violet"  icon={<Users size={16} />}             />
        <MetricCard label="Pageviews"     value={loading ? '…' : String(s?.pageviews ?? 0)}   detail="páginas vistas"                                                                    tone="emerald" icon={<Globe size={16} />}             />
        <MetricCard label="Conversões"    value={loading ? '…' : String(s?.conversions ?? 0)} detail={s?.conversion_rate != null ? `${s.conversion_rate.toFixed(1)}% taxa` : 'formulários'} tone="amber" icon={<MousePointerClick size={16} />} />
        <MetricCard label="Leads gerados" value={loading ? '…' : String(s?.leads ?? 0)}       detail="via site"                                                                          tone="violet"  icon={<TrendingUp size={16} />}        />
      </div>

      {chartData.length > 0 && (
        <Card padding="lg">
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--erp-text)' }}>Tráfego diário</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gVisitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gPageviews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--erp-border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--erp-text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--erp-text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', borderRadius: 8, color: 'var(--erp-text)', fontSize: 12 }} />
              <Area type="monotone" dataKey="pageviews" stroke="#a78bfa" strokeWidth={1.5} fill="url(#gPageviews)" name="Pageviews" />
              <Area type="monotone" dataKey="visitors"  stroke="#7c3aed" strokeWidth={2}   fill="url(#gVisitors)"  name="Visitantes" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card padding="lg">
            <p className="text-sm font-semibold mb-4" style={{ color: 'var(--erp-text)' }}>Páginas mais vistas</p>
            {(data?.top_pages?.length ?? 0) > 0 ? (
              <div className="space-y-2">
                {data!.top_pages!.slice(0, 8).map((pg, i) => {
                  const max = data!.top_pages![0].views;
                  const pct = Math.round((pg.views / max) * 100);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono truncate" style={{ color: 'var(--erp-text-muted)' }}>{pg.path}</span>
                          <span className="text-xs font-semibold tabular-nums ml-3 flex-shrink-0" style={{ color: 'var(--erp-text)' }}>{pg.views}</span>
                        </div>
                        <div className="h-1.5 rounded-full" style={{ background: 'var(--erp-surface-2)' }}>
                          <div className="h-1.5 rounded-full" style={{ background: 'var(--erp-violet)', width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--erp-text-dim)' }}>Sem dados disponíveis</p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card padding="lg">
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--erp-text)' }}>Origens</p>
            {(data?.sources?.length ?? 0) > 0 ? (
              <div className="space-y-2">
                {data!.sources!.slice(0, 5).map((src, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                      <span className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>{src.source}</span>
                    </div>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--erp-text)' }}>
                      {src.percentage.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--erp-text-dim)' }}>Sem dados</p>
            )}
          </Card>

          <Card padding="lg">
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--erp-text)' }}>Dispositivos</p>
            {(data?.devices?.length ?? 0) > 0 ? (
              <div className="space-y-2">
                {data!.devices!.map((dv, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2" style={{ color: 'var(--erp-text-muted)' }}>
                      {DEVICE_ICON(dv.device)}
                      <span className="text-xs">{dv.device}</span>
                    </div>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--erp-text)' }}>
                      {dv.percentage.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--erp-text-dim)' }}>Sem dados</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
