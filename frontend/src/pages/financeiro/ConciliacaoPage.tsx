import { useEffect, useState } from 'react';
import { RefreshCw, CheckSquare, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import { Card } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';

interface Payment {
  id: string;
  customer?: string;
  value: number;
  due_date?: string;
  status?: string;
}
interface Overview { payments?: Payment[]; }

const RECEIVED = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);
const money = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

export default function ConciliacaoPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Overview>('/financial/overview?days=90')
      .then(({ data }) => setPayments(data.payments ?? []))
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, []);

  const received = payments.filter((p) => RECEIVED.has(p.status ?? ''));
  const unmatched = payments.filter((p) => !RECEIVED.has(p.status ?? ''));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Financeiro</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Conciliação</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>ASAAS vs extrato bancário</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Conciliados"   value={loading ? '…' : String(received.length)}  detail="pagamentos ASAAS confirmados" tone="emerald" icon={<CheckSquare size={16} />}  />
        <MetricCard label="A conciliar"   value={loading ? '…' : String(unmatched.length)} detail="aguardam confirmação"          tone="amber"   icon={<AlertTriangle size={16} />} />
        <MetricCard label="Extrato banco" value="—"                                         detail="Extrato não conectado"        tone="violet"  icon={<RefreshCw size={16} />}     />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="sm">
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--erp-border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>ASAAS — Confirmados</p>
          </div>
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                    {['Cliente', 'Valor', 'Data'].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {received.slice(0, 10).map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: i < Math.min(received.length, 10) - 1 ? '1px solid var(--erp-border)' : undefined }}>
                      <td className="px-4 py-2 text-xs" style={{ color: 'var(--erp-text)' }}>{p.customer ?? '—'}</td>
                      <td className="px-4 py-2 text-xs font-semibold tabular-nums" style={{ color: '#34d399' }}>{money(p.value)}</td>
                      <td className="px-4 py-2 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{p.due_date ?? '—'}</td>
                    </tr>
                  ))}
                  {received.length === 0 && (
                    <tr><td colSpan={3} className="py-8 text-center text-xs" style={{ color: 'var(--erp-text-dim)' }}>Sem registros</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card padding="lg">
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--erp-text)' }}>Extrato bancário</p>
          <div className="flex flex-col items-center gap-3 py-10 rounded-xl"
            style={{ border: '1px dashed var(--erp-border)' }}>
            <RefreshCw size={24} style={{ color: 'var(--erp-text-dim)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--erp-text-muted)' }}>Extrato não conectado</p>
            <p className="text-xs text-center max-w-xs" style={{ color: 'var(--erp-text-dim)' }}>
              Para conciliar automaticamente, conecte a API do banco ou importe o OFX/CSV do extrato mensal.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
