import { useEffect, useState } from 'react';
import { TrendingUp, ArrowDown, Users, Target } from 'lucide-react';
import { api } from '../../services/api';
import { Card } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';

interface Lead {
  id: number;
  name: string;
  email?: string;
  status?: string;
  potential_value?: number;
  source?: string;
}

type Stage = { label: string; statuses: string[]; color: string; bg: string; };

const STAGES: Stage[] = [
  { label: 'Lead',        statuses: ['lead', 'novo', 'new'],                     color: '#a78bfa', bg: 'rgba(167,139,250,0.1)'  },
  { label: 'Em contato',  statuses: ['contato', 'em contato', 'contact'],         color: '#7c3aed', bg: 'rgba(124,58,237,0.1)'   },
  { label: 'Qualificado', statuses: ['qualificado', 'qualified'],                  color: '#6d28d9', bg: 'rgba(109,40,217,0.1)'   },
  { label: 'Proposta',    statuses: ['proposta', 'negociacao', 'proposal'],        color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'   },
  { label: 'Fechado',     statuses: ['fechado', 'ganho', 'won', 'closed', 'won'], color: '#34d399', bg: 'rgba(52,211,153,0.1)'   },
];

const money = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

function normalizeStatus(s?: string): string {
  return (s ?? 'lead').toLowerCase().trim();
}

function getStageIndex(s?: string): number {
  const norm = normalizeStatus(s);
  const idx = STAGES.findIndex((st) => st.statuses.some((x) => norm.includes(x)));
  return idx >= 0 ? idx : 0;
}

export default function FunilPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Lead[] | { data: Lead[] }>('/leads')
      .then(({ data }) => setLeads(Array.isArray(data) ? data : (data as any).data ?? []))
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, []);

  const stageCounts = STAGES.map((_, i) => leads.filter((l) => getStageIndex(l.status) === i).length);
  const stageValues = STAGES.map((_, i) =>
    leads.filter((l) => getStageIndex(l.status) === i).reduce((s, l) => s + (l.potential_value ?? 0), 0)
  );

  const total = leads.length;
  const closedCount = stageCounts[4];
  const convRate = total > 0 ? ((closedCount / total) * 100).toFixed(1) : '0';
  const totalPipeline = stageValues.reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Comercial</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Funil de Conversão</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Jornada do lead da entrada ao fechamento</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total pipeline"  value={loading ? '…' : money(totalPipeline)} detail={`${total} leads`}                tone="violet"  icon={<TrendingUp size={16} />} />
        <MetricCard label="Taxa conversão"  value={loading ? '…' : `${convRate}%`}       detail="lead → fechado"                 tone="emerald" icon={<Target size={16} />}    />
        <MetricCard label="Fechamentos"     value={loading ? '…' : String(closedCount)}  detail={`de ${total} leads totais`}    tone="amber"   icon={<Users size={16} />}     />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Visual funnel */}
        <Card padding="lg">
          <p className="text-sm font-semibold mb-5" style={{ color: 'var(--erp-text)' }}>Funil visual</p>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />)}
            </div>
          ) : (
            <div className="space-y-1.5">
              {STAGES.map((stage, i) => {
                const count = stageCounts[i];
                const pct = total > 0 ? Math.max(8, Math.round((count / total) * 100)) : 8;
                const conversion = i > 0 && stageCounts[i - 1] > 0
                  ? Math.round((count / stageCounts[i - 1]) * 100)
                  : null;
                return (
                  <div key={stage.label}>
                    {i > 0 && conversion !== null && (
                      <div className="flex items-center justify-center py-1 gap-1">
                        <ArrowDown size={10} style={{ color: 'var(--erp-text-dim)' }} />
                        <span className="text-[10px]" style={{ color: 'var(--erp-text-dim)' }}>{conversion}% passaram</span>
                      </div>
                    )}
                    <div
                      className="flex items-center justify-between rounded-xl px-4 py-3 mx-auto transition-all"
                      style={{
                        background: stage.bg,
                        border: `1px solid ${stage.color}33`,
                        width: `${pct}%`,
                        minWidth: '60%',
                      }}
                    >
                      <span className="text-sm font-medium" style={{ color: stage.color }}>{stage.label}</span>
                      <span className="text-sm font-bold tabular-nums" style={{ color: stage.color }}>{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Stage breakdown */}
        <Card padding="lg">
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--erp-text)' }}>Detalhamento por etapa</p>
          <div className="space-y-3">
            {STAGES.map((stage, i) => {
              const count = stageCounts[i];
              const val = stageValues[i];
              return (
                <div key={stage.label} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)' }}>
                  <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--erp-text)' }}>{stage.label}</p>
                    {val > 0 && <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>{money(val)} potencial</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: stage.color }}>{count}</p>
                    <p className="text-xs" style={{ color: 'var(--erp-text-dim)' }}>leads</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Lead list by stage */}
      <Card padding="sm">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--erp-border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Leads por etapa</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                {['Nome', 'Etapa', 'Potencial', 'Origem'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4}><div className="p-4 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />)}</div></td></tr>
              ) : leads.slice(0, 15).map((l, i) => {
                const stageIdx = getStageIndex(l.status);
                const stage = STAGES[stageIdx];
                return (
                  <tr key={l.id}
                    style={{ borderBottom: i < Math.min(leads.length, 15) - 1 ? '1px solid var(--erp-border)' : undefined }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--erp-surface-2)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{l.name}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ background: stage.bg, color: stage.color }}>{stage.label}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: 'var(--erp-violet-light)' }}>
                      {l.potential_value ? money(l.potential_value) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs capitalize" style={{ color: 'var(--erp-text-muted)' }}>{l.source ?? '—'}</td>
                  </tr>
                );
              })}
              {!loading && leads.length === 0 && (
                <tr><td colSpan={4} className="py-10 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>
                  Nenhum lead cadastrado
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
