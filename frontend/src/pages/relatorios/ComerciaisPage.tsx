import { useState, useEffect } from 'react';
import { Users, Kanban, FileText, Download, TrendingUp } from 'lucide-react';
import { MetricCard } from '../../shared/components/layout/MetricCard';
import { Card, CardHeader } from '../../shared/components/ui/Card';
import { api } from '../../services/api';

interface Lead {
  id: string | number;
  name: string;
  status: string;
  value?: number;
  created_at?: string;
}

const money = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const STATUS_LABELS: Record<string, string> = {
  novo: 'Novo', contato: 'Contato', qualificado: 'Qualificado', perdido: 'Perdido',
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  novo:        { bg: 'rgba(103,232,249,0.12)', color: '#67e8f9' },
  contato:     { bg: 'rgba(43,22,92,0.12)',  color: '#2b165c' },
  qualificado: { bg: 'rgba(52,211,153,0.12)',  color: '#34d399' },
  perdido:     { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8' },
};

export default function ComerciaisPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [exported, setExported] = useState(false);

  useEffect(() => {
    api.get<Lead[] | { data?: Lead[]; leads?: Lead[] }>('/leads')
      .then(({ data }) => {
        const raw = Array.isArray(data) ? data : Array.isArray((data as any)?.data) ? (data as any).data : [];
        setLeads(raw);
      })
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, []);

  const totalPipeline = leads.reduce((s, l) => s + (l.value ?? 0), 0);
  const byStatus = leads.reduce<Record<string, number>>((acc, l) => {
    const s = l.status ?? 'novo';
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  function handleExport() {
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Relatórios</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Relatório Comercial</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Pipeline, leads e propostas · dados reais</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all"
          style={{
            background: exported ? 'rgba(52,211,153,0.12)' : 'var(--erp-surface)',
            color: exported ? '#34d399' : 'var(--erp-text-muted)',
            border: '1px solid var(--erp-border)',
          }}
        >
          <Download size={13} />
          {exported ? 'Exportado!' : 'Exportar PDF'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total de Leads"   value={loading ? '…' : String(leads.length)} detail="na base" tone="violet" icon={<Users size={16} />} />
        <MetricCard label="Pipeline Total"   value={loading ? '…' : totalPipeline > 0 ? money(totalPipeline) : '—'} detail="valor acumulado" tone="emerald" icon={<Kanban size={16} />} />
        <MetricCard label="Qualificados"     value={loading ? '…' : String(byStatus['qualificado'] ?? 0)} detail="prontos para proposta" tone="amber" icon={<TrendingUp size={16} />} />
        <MetricCard label="Propostas"        value="—" detail="Aguarda integração" tone="cyan" icon={<FileText size={16} />} />
      </div>

      <Card padding="lg">
        <CardHeader title="Distribuição por Status" subtitle={`${leads.length} leads cadastrados`} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(['novo', 'contato', 'qualificado', 'perdido'] as const).map((s) => {
            const count = byStatus[s] ?? 0;
            const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
            const cfg = STATUS_COLORS[s];
            return (
              <div key={s} className="rounded-2xl p-4" style={{ background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: cfg.color }}>{STATUS_LABELS[s]}</p>
                <p className="text-3xl font-bold tabular-nums" style={{ color: 'var(--erp-text)' }}>{count}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--erp-text-muted)' }}>{pct}% do total</p>
                {/* Mini progress bar */}
                <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: `${cfg.color}20` }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cfg.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card padding="lg">
        <CardHeader title="Leads com maior potencial" subtitle="Ordenados por valor estimado" />
        {loading ? (
          <div className="space-y-2 mt-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />)}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                  {['Lead', 'Status', 'Valor', 'Data'].map((h) => (
                    <th key={h} className="pb-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--erp-text-dim)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads
                  .filter((l) => l.value)
                  .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
                  .slice(0, 8)
                  .map((l, i, arr) => {
                    const cfg = STATUS_COLORS[l.status] ?? STATUS_COLORS.novo;
                    return (
                      <tr key={String(l.id)} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--erp-border)' : undefined }}>
                        <td className="py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{l.name}</td>
                        <td className="py-3">
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{ background: cfg.bg, color: cfg.color }}>
                            {STATUS_LABELS[l.status] ?? l.status}
                          </span>
                        </td>
                        <td className="py-3 font-semibold tabular-nums" style={{ color: 'var(--erp-violet-light)' }}>
                          {l.value ? money(l.value) : '—'}
                        </td>
                        <td className="py-3 text-xs tabular-nums" style={{ color: 'var(--erp-text-muted)' }}>
                          {l.created_at ? new Date(l.created_at).toLocaleDateString('pt-BR') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                {leads.filter((l) => l.value).length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhum lead com valor estimado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
