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

  function handleExport() {
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  }

  const received = data?.payments?.filter((payment) => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(payment.status)).slice(0, 8) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-violet-100 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
          <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600">Relatórios</p>
          <h1 className="shrink-0 text-xl font-bold tracking-tight text-slate-950">Relatório Financeiro</h1>
          <p className="min-w-0 truncate text-sm text-slate-600">Consolidado 365 dias · ASAAS</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => load(true)} className="flex h-8 items-center gap-1.5 rounded-full border border-violet-100 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-violet-200 hover:text-violet-700">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <button onClick={handleExport} className={`flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-all ${exported ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-violet-100 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'}`}>
            <Download size={13} />
            {exported ? 'Exportado!' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
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
              <tr className="border-b border-violet-100">
                {['Cliente', 'Descrição', 'Valor', 'Data', 'Status'].map((heading) => (
                  <th key={heading} className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-violet-50">
              {received.map((payment) => (
                <tr key={payment.id}>
                  <td className="py-3 font-medium text-slate-950">{payment.customer}</td>
                  <td className="max-w-xs truncate py-3 text-xs text-slate-500">{payment.description ?? '-'}</td>
                  <td className="py-3 font-semibold tabular-nums text-emerald-600">{money(payment.value)}</td>
                  <td className="py-3 text-xs text-slate-500">{payment.due_date ?? '-'}</td>
                  <td className="py-3"><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Recebido</span></td>
                </tr>
              ))}
              {!loading && received.length === 0 && (
                <tr><td colSpan={5} className="py-10 text-center text-sm text-slate-500">Nenhum pagamento confirmado no período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
