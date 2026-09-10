import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, LockKeyhole } from 'lucide-react';
import { api } from '../../../services/api';

export type TopdataAccessAlertItem = {
  customer_id?: string;
  customer: string;
  customer_email?: string;
  customer_phone?: string;
  days_overdue: number;
  oldest_due_date?: string;
  overdue_value: number;
  charge_count: number;
  charge_ids: string[];
};

export type TopdataAccessAlertsResponse = {
  threshold_days: number;
  total_clients: number;
  total_charges: number;
  total_value: number;
  items: TopdataAccessAlertItem[];
};

const money = (value = 0) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(value);

export function TopdataAccessAlert({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<TopdataAccessAlertsResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = refreshKey > 0 ? '?refresh=true' : '';
    setFailed(false);
    api.get<TopdataAccessAlertsResponse>(`/financial/topdata-access-alerts${refresh}`)
      .then(({ data: response }) => {
        if (active) setData(response);
      })
      .catch(() => {
        if (active) {
          setData(null);
          setFailed(true);
        }
      });
    return () => { active = false; };
  }, [refreshKey]);

  if (failed) {
    return (
      <div role="status" className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm" style={{ background: 'rgba(180,83,9,0.08)', borderColor: 'rgba(180,83,9,0.22)', color: 'var(--erp-amber)' }}>
        <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
        Não foi possível verificar agora quais clientes exigem bloqueio na Topdata.
      </div>
    );
  }

  if (!data?.items.length) return null;

  const visibleItems = data.items.slice(0, 3);
  const remaining = data.items.length - visibleItems.length;
  const clientsLabel = data.total_clients === 1 ? '1 cliente precisa' : `${data.total_clients} clientes precisam`;

  return (
    <section
      role="alert"
      aria-live="polite"
      className="rounded-2xl border bg-white p-4 sm:p-5"
      style={{ borderColor: 'rgba(190,18,60,0.28)' }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(190,18,60,0.10)', color: 'var(--erp-rose)' }}>
            <LockKeyhole size={18} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--erp-rose)' }}>Bloqueio na Topdata necessário</p>
            <p className="mt-1 max-w-3xl text-sm leading-6" style={{ color: 'var(--erp-text)' }}>
              {clientsLabel} ter o acesso bloqueado manualmente: há cobranças vencidas há mais de {data.threshold_days} dias.
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}>
              {money(data.total_value)} em {data.total_charges} {data.total_charges === 1 ? 'cobrança vencida' : 'cobranças vencidas'}.
            </p>
          </div>
        </div>
        <Link
          to="/financeiro/cobrancas?status=overdue"
          className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition-colors hover:bg-[#9f1239]"
          style={{ background: 'var(--erp-rose)' }}
        >
          Ver cobranças <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-2 xl:grid-cols-3" style={{ borderColor: 'var(--erp-border)' }}>
        {visibleItems.map((item) => (
          <div key={item.customer_id || item.customer} className="rounded-xl px-3 py-2.5" style={{ background: 'var(--erp-surface-2)' }}>
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>{item.customer}</p>
              <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: 'rgba(190,18,60,0.10)', color: 'var(--erp-rose)' }}>
                {item.days_overdue} dias
              </span>
            </div>
            <p className="mt-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}>
              {money(item.overdue_value)} · {item.charge_count} {item.charge_count === 1 ? 'cobrança' : 'cobranças'}
            </p>
          </div>
        ))}
      </div>
      {remaining > 0 && <p className="mt-2 text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>Mais {remaining} {remaining === 1 ? 'cliente exige' : 'clientes exigem'} a mesma ação.</p>}
    </section>
  );
}
