import { useEffect, useState } from 'react';
import { TrendingUp, ArrowDown, Users, Target } from 'lucide-react';
import { api } from '../../services/api';
import { Card } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';

type LeadStage = 'novo' | 'contato' | 'qualificado' | 'proposta' | 'negociacao' | 'fechado' | 'perdido';

interface Lead {
  id: number;
  name: string;
  company?: string | null;
  email?: string | null;
  stage?: LeadStage | string | null;
  status?: string | null;
  value_potential?: number | null;
  origin?: string | null;
}

type Stage = { id: LeadStage; label: string; color: string; bg: string; border: string };

const STAGES: Stage[] = [
  { id: 'novo', label: 'Novo lead', color: 'var(--erp-text-muted)', bg: 'var(--erp-violet-dim)', border: 'rgba(43,22,92,0.20)' },
  { id: 'contato', label: 'Em contato', color: 'var(--erp-violet)', bg: 'var(--erp-violet-dim)', border: 'rgba(43,22,92,0.20)' },
  { id: 'qualificado', label: 'Qualificado', color: 'var(--erp-emerald)', bg: 'rgba(4,120,87,0.10)', border: 'rgba(4,120,87,0.20)' },
  { id: 'proposta', label: 'Proposta enviada', color: 'var(--erp-amber)', bg: 'rgba(180,83,9,0.12)', border: 'rgba(180,83,9,0.20)' },
  { id: 'negociacao', label: 'Em negociação', color: 'var(--erp-cyan)', bg: 'rgba(8,145,178,0.12)', border: 'rgba(8,145,178,0.20)' },
  { id: 'fechado', label: 'Fechado', color: 'var(--erp-emerald)', bg: 'rgba(4,120,87,0.12)', border: 'rgba(4,120,87,0.20)' },
  { id: 'perdido', label: 'Perdido', color: 'var(--erp-rose)', bg: 'rgba(190,18,60,0.12)', border: 'rgba(190,18,60,0.20)' },
];

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

function normalizeStage(stage?: string | null, status?: string | null): LeadStage {
  const value = (stage || status || 'novo').toLowerCase().trim();
  if (value === 'contato' || value === 'em contato') return 'contato';
  if (value === 'qualificado') return 'qualificado';
  if (value === 'proposta') return 'proposta';
  if (value === 'negociacao' || value === 'negociação') return 'negociacao';
  if (value === 'fechado') return 'fechado';
  if (value === 'perdido') return 'perdido';
  return 'novo';
}

export default function FunilPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Lead[]>('/leads')
      .then(({ data }) => setLeads(Array.isArray(data) ? data : []))
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, []);

  const stageLeads = STAGES.map((stage) => leads.filter((lead) => normalizeStage(lead.stage, lead.status) === stage.id));
  const stageCounts = stageLeads.map((items) => items.length);
  const stageValues = stageLeads.map((items) => items.reduce((sum, lead) => sum + Number(lead.value_potential ?? 0), 0));
  const total = leads.length;
  const closedCount = stageCounts[STAGES.findIndex((stage) => stage.id === 'fechado')];
  const convRate = total > 0 ? ((closedCount / total) * 100).toFixed(1) : '0.0';
  const totalPipeline = stageValues.reduce((sum, value) => sum + value, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Comercial</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Funil de Conversão</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Jornada do lead da entrada ao fechamento</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard label="Total pipeline" value={loading ? '...' : money(totalPipeline)} detail={`${total} leads`} tone="violet" icon={<TrendingUp size={16} />} />
        <MetricCard label="Taxa conversão" value={loading ? '...' : `${convRate}%`} detail="lead → fechado" tone="emerald" icon={<Target size={16} />} />
        <MetricCard label="Fechamentos" value={loading ? '...' : String(closedCount)} detail={`de ${total} leads totais`} tone="amber" icon={<Users size={16} />} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card padding="lg">
          <p className="text-sm font-semibold mb-5" style={{ color: 'var(--erp-text)' }}>Funil visual</p>
          {loading ? (
            <div className="space-y-2">{STAGES.map((stage) => <div key={stage.id} className="h-12 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />)}</div>
          ) : (
            <div className="space-y-1.5">
              {STAGES.map((stage, index) => {
                const count = stageCounts[index];
                const pct = total > 0 ? Math.max(8, Math.round((count / total) * 100)) : 8;
                const conversion = index > 0 && stageCounts[index - 1] > 0 ? Math.round((count / stageCounts[index - 1]) * 100) : null;
                return (
                  <div key={stage.id}>
                    {index > 0 && conversion !== null && (
                      <div className="flex items-center justify-center py-1 gap-1">
                        <ArrowDown size={10} style={{ color: 'var(--erp-text-dim)' }} />
                        <span className="text-[10px]" style={{ color: 'var(--erp-text-dim)' }}>{conversion}% passaram</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between rounded-xl px-4 py-3 mx-auto transition-all" style={{ background: stage.bg, border: `1px solid ${stage.border}`, width: `${pct}%`, minWidth: '60%' }}>
                      <span className="text-sm font-medium" style={{ color: stage.color }}>{stage.label}</span>
                      <span className="text-sm font-bold tabular-nums" style={{ color: stage.color }}>{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card padding="lg">
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--erp-text)' }}>Detalhamento por etapa</p>
          <div className="space-y-3">
            {STAGES.map((stage, index) => {
              const count = stageCounts[index];
              const value = stageValues[index];
              return (
                <div key={stage.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)' }}>
                  <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--erp-text)' }}>{stage.label}</p>
                    {value > 0 && <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>{money(value)} potencial</p>}
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

      <Card padding="sm">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--erp-border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Leads por etapa</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                {['Nome', 'Etapa', 'Potencial', 'Origem'].map((header) => <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-muted)' }}>{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4}><div className="p-4 space-y-2">{[1, 2, 3].map((item) => <div key={item} className="h-10 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />)}</div></td></tr>
              ) : leads.slice(0, 15).map((lead, index) => {
                const stage = STAGES.find((item) => item.id === normalizeStage(lead.stage, lead.status)) ?? STAGES[0];
                const value = Number(lead.value_potential ?? 0);
                return (
                  <tr key={lead.id} style={{ borderBottom: index < Math.min(leads.length, 15) - 1 ? '1px solid var(--erp-border)' : undefined }} onMouseEnter={(event) => { event.currentTarget.style.background = 'var(--erp-surface-2)'; }} onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent'; }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{lead.company || lead.name}</td>
                    <td className="px-4 py-3"><span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: stage.bg, color: stage.color }}>{stage.label}</span></td>
                    <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: 'var(--erp-violet-light)' }}>{value ? money(value) : '-'}</td>
                    <td className="px-4 py-3 text-xs capitalize" style={{ color: 'var(--erp-text-muted)' }}>{lead.origin ?? '-'}</td>
                  </tr>
                );
              })}
              {!loading && leads.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhum lead cadastrado</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
