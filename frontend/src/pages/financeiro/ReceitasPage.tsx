import { useCallback, useEffect, useState } from 'react';
import { Calendar, CheckCircle, DollarSign, Link2, RefreshCw, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';
import { Card, CardHeader } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';
import { currency, formatDate, type ManualFinancial } from './manualFinance';

interface Payment {
  id: string;
  customer?: string;
  description?: string;
  value: number;
  due_date?: string;
  status?: string;
}
interface Overview {
  summary?: { total_received?: number; total_pending?: number; mrr?: number };
  payments?: Payment[];
  manual_financial?: ManualFinancial;
}

const RECEIVED_STATUSES = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'received', 'confirmed', 'received_in_cash']);

export default function ReceitasPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((forceRefresh = false) => {
    setLoading(true);
    api.get<Overview>(`/financial/overview?days=180${forceRefresh ? '&refresh=true' : ''}`)
      .then(({ data: d }) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(false); }, [load]);

  const received = (data?.payments ?? []).filter((p) => RECEIVED_STATUSES.has(p.status ?? ''));
  const directSales = data?.manual_financial?.direct_sales ?? [];
  const totalReceived = received.reduce((sum, item) => sum + item.value, 0);
  const totalDirectSales = directSales.reduce((sum, item) => sum + item.value, 0);
  const unmatchedDirectSales = directSales.filter((item) => !item.matched).reduce((sum, item) => sum + item.value, 0);
  const avgTicket = received.length > 0 ? totalReceived / received.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-violet-100 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
          <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--erp-violet-light)' }}>Financeiro ASAAS</p>
          <h1 className="shrink-0 text-xl font-bold" style={{ color: 'var(--erp-text)' }}>Receita</h1>
          <p className="min-w-0 truncate text-sm" style={{ color: 'var(--erp-text-muted)' }}>Pagamentos confirmados, pendências e vendas diretas conciliáveis</p>
        </div>
        <button onClick={() => load(true)} className="flex h-8 items-center gap-1.5 rounded-full border border-violet-100 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-violet-200 hover:text-violet-700">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Recebido ASAAS" value={loading ? '...' : currency(totalReceived, 2)} detail={`${received.length} pagamentos`} tone="emerald" icon={<CheckCircle size={16} />} />
        <MetricCard label="Ticket médio" value={loading ? '...' : currency(avgTicket, 2)} detail="por pagamento recebido" tone="violet" icon={<DollarSign size={16} />} />
        <MetricCard label="MRR" value={loading ? '...' : currency(data?.summary?.mrr ?? 0, 2)} detail="receita mensal recorrente" tone="amber" icon={<TrendingUp size={16} />} />
        <MetricCard label="Venda direta" value={loading ? '...' : currency(totalDirectSales, 2)} detail={`${currency(unmatchedDirectSales, 2)} sem match`} tone="cyan" icon={<Link2 size={16} />} />
      </div>

      <Card padding="sm">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--erp-border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Vendas diretas  reposição de caixa</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                {['Competência', 'Cliente', 'Descrição', 'Parcela', 'Total contrato', 'ASAAS'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {directSales.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: i < directSales.length - 1 ? '1px solid var(--erp-border)' : undefined }}>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--erp-text-muted)' }}>{item.month}</td>
                  <td className="px-4 py-3 font-medium max-w-xs" style={{ color: 'var(--erp-text)' }}>{item.customer}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{item.description}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums" style={{ color: '#34d399' }}>{currency(item.value, 2)}</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--erp-text-muted)' }}>{currency(item.contract_total, 2)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: item.matched ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.12)', color: item.matched ? '#34d399' : '#fbbf24' }}>
                      {item.matched ? 'Conciliado' : 'Reposição caixa'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padding="sm">
        <CardHeader title="Pagamentos recebidos" subtitle="ASAAS" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                {['Cliente', 'Descrição', 'Valor', 'Data', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {received.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: i < received.length - 1 ? '1px solid var(--erp-border)' : undefined }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{p.customer ?? '-'}</td>
                  <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: 'var(--erp-text-muted)' }}>{p.description ?? '-'}</td>
                  <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: '#34d399' }}>{currency(p.value, 2)}</td>
                  <td className="px-4 py-3"><span className="flex items-center gap-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}><Calendar size={10} />{formatDate(p.due_date)}</span></td>
                  <td className="px-4 py-3"><span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>Recebido</span></td>
                </tr>
              ))}
              {!loading && received.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhum pagamento recebido no período</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
