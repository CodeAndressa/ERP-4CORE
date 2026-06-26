import { useEffect, useState } from 'react';
import { CalendarDays, Layers, ReceiptText, TrendingDown } from 'lucide-react';
import { Card, CardHeader } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';
import { api } from '../../services/api';
import { currency, formatDate, monthLabel, type ManualFinancial } from './manualFinance';

export default function DespesasPage() {
  const [data, setData] = useState<ManualFinancial | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ManualFinancial>('/financial/manual')
      .then(({ data: d }) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const expenses = data?.expenses ?? [];
  const summary = data?.summary;
  const byCategory = expenses.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + item.value;
    return acc;
  }, {});
  const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const monthly = data?.monthly ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Financeiro</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Despesas</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Custos mensais lançados manualmente</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total despesas" value={loading ? '...' : currency(summary?.expenses_total ?? 0, 2)} detail={`${expenses.length} lançamentos`} tone="rose" icon={<TrendingDown size={16} />} />
        <MetricCard label="Fixas" value={loading ? '...' : currency(summary?.fixed_expenses_total ?? 0, 2)} detail="custos recorrentes" tone="violet" icon={<Layers size={16} />} />
        <MetricCard label="Variáveis" value={loading ? '...' : currency(summary?.variable_expenses_total ?? 0, 2)} detail="sem lançamentos no mês" tone="amber" icon={<ReceiptText size={16} />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="lg">
          <CardHeader title="Categorias" subtitle="Distribuição dos custos lançados" />
          <div className="space-y-3">
            {categories.map(([category, value]) => {
              const pct = summary?.expenses_total ? (value / summary.expenses_total) * 100 : 0;
              return (
                <div key={category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm" style={{ color: 'var(--erp-text)' }}>{category}</span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--erp-text-muted)' }}>{currency(value, 2)} · {pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'var(--erp-surface-2)' }}>
                    <div className="h-1.5 rounded-full transition-all" style={{ background: 'var(--erp-violet)', width: `${pct}%`, opacity: 0.6 }} />
                  </div>
                </div>
              );
            })}
            {!loading && categories.length === 0 && <p className="py-8 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhuma despesa lançada</p>}
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader title="Resumo mensal" subtitle="Saídas por competência" />
          <div className="space-y-2">
            {monthly.filter((row) => row.expenses > 0).map((row) => (
              <div key={row.month} className="flex items-center justify-between rounded-xl px-3 py-3" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)' }}>
                <div className="flex items-center gap-2">
                  <CalendarDays size={14} style={{ color: 'var(--erp-violet-light)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--erp-text)' }}>{monthLabel(row.month)}</span>
                </div>
                <span className="text-sm font-semibold tabular-nums" style={{ color: '#f87171' }}>{currency(row.expenses, 2)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card padding="sm">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--erp-border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Lançamentos</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                {['Data', 'Descrição', 'Categoria', 'Fornecedor', 'Valor', 'Obs.'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: i < expenses.length - 1 ? '1px solid var(--erp-border)' : undefined }}>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--erp-text-muted)' }}>{formatDate(item.date)}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{item.description}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{item.category}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{item.vendor}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums" style={{ color: '#f87171' }}>{currency(item.value, 2)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-dim)' }}>{item.notes ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}