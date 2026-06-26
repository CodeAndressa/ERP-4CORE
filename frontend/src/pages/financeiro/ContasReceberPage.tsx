import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';
import { Card, CardHeader } from '../../shared/components/ui/Card';
import { money, type AsaasData } from './FinanceiroPage';

type Payment = AsaasData['payments'][0];

export default function ContasReceberPage() {
  const [data, setData] = useState<AsaasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'overdue' | 'pending' | 'paid'>('all');

  useEffect(() => {
    api.get<AsaasData>('/financial/overview?days=365')
      .then(({ data: d }) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const payments: Payment[] = data?.payments ?? [];

  const filtered = payments.filter((p) => {
    if (filter === 'overdue') return p.status === 'OVERDUE';
    if (filter === 'pending') return ['PENDING', 'AWAITING_RISK_ANALYSIS'].includes(p.status);
    if (filter === 'paid')    return ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status);
    return true;
  });

  const overdueTotal = payments.filter((p) => p.status === 'OVERDUE').reduce((s, p) => s + p.value, 0);
  const pendingTotal = payments.filter((p) => ['PENDING', 'AWAITING_RISK_ANALYSIS'].includes(p.status)).reduce((s, p) => s + p.value, 0);

  const tabs = [
    { key: 'all',     label: 'Todas',    count: payments.length },
    { key: 'overdue', label: 'Vencidas', count: payments.filter((p) => p.status === 'OVERDUE').length },
    { key: 'pending', label: 'Pendentes',count: payments.filter((p) => ['PENDING','AWAITING_RISK_ANALYSIS'].includes(p.status)).length },
    { key: 'paid',    label: 'Pagas',    count: payments.filter((p) => ['RECEIVED','CONFIRMED','RECEIVED_IN_CASH'].includes(p.status)).length },
  ] as const;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold" style={{ color: 'var(--erp-text)' }}>Contas a Receber</h1>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl p-4" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)' }}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} style={{ color: '#f87171' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#f87171' }}>Em Atraso</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>{loading ? '…' : money(overdueTotal)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--erp-text-muted)' }}>{data?.overdue_count ?? 0} cobranças vencidas</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.18)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} style={{ color: '#fbbf24' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#fbbf24' }}>Pendentes</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>{loading ? '…' : money(pendingTotal)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--erp-text-muted)' }}>{data?.pending_count ?? 0} aguardando pagamento</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.18)' }}>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={14} style={{ color: '#34d399' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#34d399' }}>Recebido</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>{loading ? '…' : money(data?.received_value ?? 0)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--erp-text-muted)' }}>{data?.received_count ?? 0} compensadas</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: filter === t.key ? 'var(--erp-violet)' : 'var(--erp-surface)',
              color: filter === t.key ? '#fff' : 'var(--erp-text-muted)',
              border: '1px solid var(--erp-border)',
            }}
          >
            {t.label}
            <span className="rounded-full px-1.5 py-0.5 text-[10px]"
              style={{ background: filter === t.key ? 'rgba(255,255,255,0.2)' : 'var(--erp-surface-2)' }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <Card padding="lg">
        <CardHeader title={`${filtered.length} cobrança${filtered.length !== 1 ? 's' : ''}`} subtitle="ASAAS · dados reais" />
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhuma cobrança neste filtro</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                  {['Cliente', 'Descrição', 'Vencimento', 'Valor', 'Status'].map((h) => (
                    <th key={h} className="pb-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--erp-text-dim)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--erp-border)' }}>
                {filtered.map((p) => {
                  const isPaid = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status);
                  const isOverdue = p.status === 'OVERDUE';
                  return (
                    <tr key={p.id}>
                      <td className="py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{p.customer}</td>
                      <td className="py-3 max-w-[200px] truncate text-xs" style={{ color: 'var(--erp-text-muted)' }}>{p.description}</td>
                      <td className="py-3 tabular-nums text-xs" style={{ color: 'var(--erp-text-muted)' }}>{p.due_date}</td>
                      <td className="py-3 font-semibold tabular-nums" style={{ color: 'var(--erp-text)' }}>{money(p.value)}</td>
                      <td className="py-3">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            background: isPaid ? 'rgba(52,211,153,0.12)' : isOverdue ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)',
                            color: isPaid ? '#34d399' : isOverdue ? '#f87171' : '#fbbf24',
                          }}>
                          {isPaid ? 'Pago' : isOverdue ? 'Vencido' : 'Pendente'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
