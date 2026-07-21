import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, DollarSign, Download, RefreshCw, TrendingUp } from 'lucide-react';
import { MetricCard } from '../../shared/components/layout/MetricCard';
import { Card, CardHeader } from '../../shared/components/ui/Card';
import { api } from '../../services/api';

interface AsaasData {
  received_value: number;
  pending_value: number;
  overdue_value: number;
  recurring_value: number;
  received_count: number;
  pending_count: number;
  overdue_count: number;
  payments?: { id: string; customer: string; description?: string; value: number; status: string; due_date?: string }[];
}

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

function downloadCsv(rows: NonNullable<AsaasData['payments']>, filename: string) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = ['Cliente', 'Descrição', 'Valor', 'Data', 'Status'];
  const lines = [
    header.join(';'),
    ...rows.map((payment) => [
      escape(payment.customer),
      escape(payment.description ?? ''),
      payment.value.toFixed(2).replace('.', ','),
      escape(payment.due_date ?? ''),
      'Recebido',
    ].join(';')),
  ];
  const blob = new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function FinanceirosPage() {
  const [data, setData] = useState<AsaasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState(false);

  const load = useCallback((forceRefresh = false) => {
    setLoading(true);
    setError(null);
    api.get<AsaasData>(`/financial/overview?days=365${forceRefresh ? '&refresh=true' : ''}`)
      .then(({ data: response }) => setData(response))
      .catch((err) => setError(err?.response?.data?.detail || 'Falha ao carregar dados'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(false); }, [load]);

  const received = data?.payments?.filter((payment) => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(payment.status)).slice(0, 8) ?? [];

  function handleExport() {
    if (received.length === 0) return;
    downloadCsv(received, `relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.csv`);
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b pb-3 lg:flex-row lg:items-center lg:justify-between" style={{ borderColor: 'var(--erp-border)' }}>
        <div className="flex min-w-0 flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
          <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--erp-violet-light)' }}>Relatórios</p>
          <h1 className="shrink-0 text-xl font-bold tracking-tight" style={{ color: 'var(--erp-text)' }}>Relatório Financeiro</h1>
          <p className="min-w-0 truncate text-sm" style={{ color: 'var(--erp-text-muted)' }}>Consolidado 365 dias · ASAAS</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => load(true)} className="flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-medium transition-colors" style={{ border: '1px solid var(--erp-border)', color: 'var(--erp-text-muted)' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <button
            onClick={handleExport}
            disabled={received.length === 0}
            className="flex h-8 items-center gap-2 rounded-xl px-3 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={exported ? { border: '1px solid rgba(4,120,87,0.35)', background: 'rgba(4,120,87,0.08)', color: 'var(--erp-emerald)' } : { border: '1px solid var(--erp-border)', background: 'var(--erp-surface)', color: 'var(--erp-text-muted)' }}
          >
            <Download size={13} />
            {exported ? 'Exportado!' : 'Exportar CSV'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-[24px] border px-4 py-3 text-sm" style={{ borderColor: 'rgba(190,18,60,0.3)', background: 'rgba(190,18,60,0.08)', color: 'var(--erp-rose)' }}>
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Recebido no ano" value={loading ? '...' : data ? money(data.received_value) : '-'} detail={data ? `${data.received_count} cobranças` : undefined} tone="emerald" icon={<TrendingUp size={16} />} />
        <MetricCard label="A receber" value={loading ? '...' : data ? money(data.pending_value) : '-'} detail={data ? `${data.pending_count} pendentes` : undefined} tone="violet" icon={<DollarSign size={16} />} />
        <MetricCard label="Em atraso" value={loading ? '...' : data ? money(data.overdue_value) : '-'} detail={data ? `${data.overdue_count} vencidas` : undefined} tone="rose" icon={<AlertTriangle size={16} />} />
        <MetricCard label="MRR" value={loading ? '...' : data ? money(data.recurring_value) : '-'} detail="recorrente mensal" tone="amber" icon={<RefreshCw size={16} />} />
      </div>

      <Card padding="lg">
        <CardHeader title="Recebimentos recentes" subtitle="Pagamentos confirmados no ASAAS" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--erp-border)' }}>
                {['Cliente', 'Descrição', 'Valor', 'Data', 'Status'].map((heading) => (
                  <th key={heading} className="pb-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--erp-text-muted)' }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--erp-border)' }}>
              {received.map((payment) => (
                <tr key={payment.id}>
                  <td className="py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{payment.customer}</td>
                  <td className="max-w-xs truncate py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{payment.description ?? '-'}</td>
                  <td className="py-3 font-semibold tabular-nums" style={{ color: 'var(--erp-emerald)' }}>{money(payment.value)}</td>
                  <td className="py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{payment.due_date ?? '-'}</td>
                  <td className="py-3"><span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'rgba(4,120,87,0.12)', color: 'var(--erp-emerald)' }}>Recebido</span></td>
                </tr>
              ))}
              {!loading && received.length === 0 && (
                <tr><td colSpan={5} className="py-10 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhum pagamento confirmado no período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
