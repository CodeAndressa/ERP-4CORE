import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, LockKeyhole, UnlockKeyhole } from 'lucide-react';
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
  total_blocked_clients?: number;
  total_unblock_clients?: number;
  unblock_items?: TopdataUnblockAlertItem[];
};

export type TopdataUnblockAlertItem = {
  customer_id: string;
  customer: string;
  blocked_at?: string;
  payment_date?: string;
  paid_value: number;
  charge_count: number;
  charge_ids: string[];
};

const money = (value = 0) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(value);

export function TopdataAccessAlert({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<TopdataAccessAlertsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [working, setWorking] = useState('');
  const [actionError, setActionError] = useState('');

  function load(force = false) {
    const refresh = force || refreshKey > 0 ? '?refresh=true' : '';
    setFailed(false);
    return api.get<TopdataAccessAlertsResponse>(`/financial/topdata-access-alerts${refresh}`)
      .then(({ data: response }) => setData(response))
      .catch(() => {
        setData(null);
        setFailed(true);
      });
  }

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

  async function confirmAction(customerId: string, action: 'blocked' | 'unblocked') {
    setWorking(`${action}:${customerId}`);
    setActionError('');
    try {
      await api.post(`/financial/topdata-access/${encodeURIComponent(customerId)}/${action}`);
      await load(true);
    } catch (error: any) {
      setActionError(error?.response?.data?.detail || 'Não foi possível registrar a ação na Topdata.');
    } finally {
      setWorking('');
    }
  }

  if (failed) {
    return (
      <div role="status" className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm" style={{ background: 'rgba(180,83,9,0.08)', borderColor: 'rgba(180,83,9,0.22)', color: 'var(--erp-amber)' }}>
        <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
        Não foi possível verificar agora quais clientes exigem bloqueio na Topdata.
      </div>
    );
  }

  const unblockItems = data?.unblock_items ?? [];
  if (!data?.items.length && !unblockItems.length) return null;

  const visibleItems = (data?.items ?? []).slice(0, 3);
  const remaining = (data?.items.length ?? 0) - visibleItems.length;
  const clientsLabel = data?.total_clients === 1 ? '1 cliente precisa' : `${data?.total_clients ?? 0} clientes precisam`;

  return (
    <div className="space-y-3" aria-live="polite">
      {actionError && <div role="status" className="rounded-xl border px-4 py-3 text-sm" style={{ background: 'rgba(190,18,60,0.08)', borderColor: 'rgba(190,18,60,0.22)', color: 'var(--erp-rose)' }}>{actionError}</div>}

      {unblockItems.length > 0 && <section role="alert" className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: 'rgba(4,120,87,0.28)' }}>
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(4,120,87,0.10)', color: 'var(--erp-emerald)' }}>
            <UnlockKeyhole size={18} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--erp-emerald)' }}>Pagamento identificado — desbloqueio necessário</p>
            <p className="mt-1 max-w-3xl text-sm leading-6" style={{ color: 'var(--erp-text)' }}>
              {unblockItems.length === 1 ? 'Um cliente bloqueado pagou todas as cobranças pendentes.' : `${unblockItems.length} clientes bloqueados pagaram todas as cobranças pendentes.`} Desbloqueie o acesso na Topdata e confirme abaixo.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-2 xl:grid-cols-3" style={{ borderColor: 'var(--erp-border)' }}>
          {unblockItems.map((item) => (
            <div key={item.customer_id} className="rounded-xl px-3 py-3" style={{ background: 'rgba(4,120,87,0.06)' }}>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>{item.customer}</p>
                <CheckCircle2 size={16} className="shrink-0" style={{ color: 'var(--erp-emerald)' }} aria-hidden="true" />
              </div>
              <p className="mt-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{money(item.paid_value)} recebidos{item.payment_date ? ` em ${new Date(`${item.payment_date}T12:00:00`).toLocaleDateString('pt-BR')}` : ''}</p>
              <button type="button" aria-label={`Confirmar desbloqueio de ${item.customer}`} disabled={!!working} onClick={() => void confirmAction(item.customer_id, 'unblocked')} className="mt-3 min-h-10 w-full rounded-xl px-3 text-xs font-semibold text-white disabled:opacity-60" style={{ background: 'var(--erp-emerald)' }}>
                {working === `unblocked:${item.customer_id}` ? 'Registrando...' : 'Marcar como desbloqueado'}
              </button>
            </div>
          ))}
        </div>
      </section>}

      {visibleItems.length > 0 && <section role="alert" className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: 'rgba(190,18,60,0.28)' }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(190,18,60,0.10)', color: 'var(--erp-rose)' }}>
            <LockKeyhole size={18} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--erp-rose)' }}>Bloqueio na Topdata necessário</p>
            <p className="mt-1 max-w-3xl text-sm leading-6" style={{ color: 'var(--erp-text)' }}>
              {clientsLabel} ter o acesso bloqueado manualmente: há cobranças vencidas há mais de {data?.threshold_days ?? 10} dias.
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}>
              {money(data?.total_value)} em {data?.total_charges ?? 0} {data?.total_charges === 1 ? 'cobrança vencida' : 'cobranças vencidas'}.
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
            {item.customer_id && <button type="button" aria-label={`Confirmar bloqueio de ${item.customer}`} disabled={!!working} onClick={() => void confirmAction(item.customer_id!, 'blocked')} className="mt-3 min-h-10 w-full rounded-xl border px-3 text-xs font-semibold disabled:opacity-60" style={{ borderColor: 'rgba(190,18,60,0.28)', color: 'var(--erp-rose)', background: '#fff' }}>
              {working === `blocked:${item.customer_id}` ? 'Registrando...' : 'Marcar como bloqueado'}
            </button>}
          </div>
        ))}
      </div>
      {remaining > 0 && <p className="mt-2 text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>Mais {remaining} {remaining === 1 ? 'cliente exige' : 'clientes exigem'} a mesma ação.</p>}
      </section>}
    </div>
  );
}
