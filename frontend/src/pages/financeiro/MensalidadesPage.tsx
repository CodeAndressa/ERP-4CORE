import { useEffect, useState } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import { api } from '../../services/api';
import { Card, CardHeader } from '../../shared/components/ui/Card';
import { money, type AsaasData } from './FinanceiroPage';

type Sub = NonNullable<AsaasData['subscriptions']>[0];

export default function MensalidadesPage() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [totalMrr, setTotalMrr] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<AsaasData>('/financial/overview')
      .then(({ data: d }) => {
        const list = d.subscriptions ?? [];
        setSubs(list);
        setTotalMrr(d.recurring_value);
      })
      .catch(() => setSubs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--erp-text)' }}>Mensalidades</h1>
          <p className="text-sm" style={{ color: 'var(--erp-text-muted)' }}>Assinaturas ativas · ASAAS</p>
        </div>
        <div className="rounded-2xl px-4 py-3 text-right" style={{ background: 'var(--erp-violet-dim)', border: '1px solid var(--erp-border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--erp-violet-light)' }}>MRR Total</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>{loading ? '…' : money(totalMrr)}</p>
          <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>{subs.length} assinaturas ativas</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl p-4" style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <RefreshCw size={13} style={{ color: 'var(--erp-violet-light)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--erp-text-muted)' }}>Recorrência Mensal</span>
          </div>
          <p className="text-xl font-bold" style={{ color: 'var(--erp-text)' }}>{loading ? '…' : money(totalMrr)}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Users size={13} style={{ color: 'var(--erp-violet-light)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--erp-text-muted)' }}>Clientes Recorrentes</span>
          </div>
          <p className="text-xl font-bold" style={{ color: 'var(--erp-text)' }}>{loading ? '…' : subs.length}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold" style={{ color: 'var(--erp-text-muted)' }}>Ticket Médio</span>
          </div>
          <p className="text-xl font-bold" style={{ color: 'var(--erp-text)' }}>
            {loading ? '…' : subs.length > 0 ? money(totalMrr / subs.length) : '—'}
          </p>
        </div>
      </div>

      {/* Subscriptions table */}
      <Card padding="lg">
        <CardHeader title="Assinaturas Ativas" subtitle="Fonte: ASAAS · endpoint /subscriptions" />
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />
            ))}
          </div>
        ) : subs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <RefreshCw size={20} style={{ color: 'var(--erp-text-dim)' }} />
            <p className="text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhuma assinatura ativa encontrada</p>
            <p className="text-xs" style={{ color: 'var(--erp-text-dim)' }}>Verifique se a chave ASAAS tem acesso ao endpoint /subscriptions</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                  {['Cliente', 'Descrição', 'Valor/mês', 'Próx. Vencimento', 'Status'].map((h) => (
                    <th key={h} className="pb-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--erp-text-dim)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--erp-border)' }}>
                {subs.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{s.customer}</td>
                    <td className="py-3 max-w-[200px] truncate text-xs" style={{ color: 'var(--erp-text-muted)' }}>{s.description}</td>
                    <td className="py-3 font-semibold tabular-nums" style={{ color: 'var(--erp-violet-light)' }}>{money(s.value)}</td>
                    <td className="py-3 tabular-nums text-xs" style={{ color: 'var(--erp-text-muted)' }}>{s.nextDueDate}</td>
                    <td className="py-3">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                        Ativa
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
