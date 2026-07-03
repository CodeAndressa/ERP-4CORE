import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, RefreshCw, UserPlus, WalletCards, X } from 'lucide-react';
import { api } from '../services/api';

type Lead = {
  id: string;
  name: string;
  company?: string | null;
  status?: string | null;
  stage?: string | null;
  next_contact_date?: string | null;
  next_action?: string | null;
};

type FinanceOverview = {
  overdue_count?: number;
  overdue_value?: number;
  pending_count?: number;
  pending_value?: number;
};

type NotificationTone = 'danger' | 'warning' | 'info' | 'success';

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  meta: string;
  path: string;
  tone: NotificationTone;
  icon: JSX.Element;
};

const toneStyle: Record<NotificationTone, { bg: string; color: string }> = {
  danger: { bg: 'rgba(190,18,60,0.10)', color: 'var(--erp-rose)' },
  warning: { bg: 'rgba(180,83,9,0.12)', color: 'var(--erp-amber)' },
  info: { bg: 'var(--erp-violet-dim)', color: 'var(--erp-violet)' },
  success: { bg: 'rgba(4,120,87,0.10)', color: 'var(--erp-emerald)' },
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(iso?: string | null) {
  if (!iso) return 999;
  const today = new Date(todayIso() + 'T12:00:00');
  const target = new Date(iso + 'T12:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function dateLabel(iso?: string | null) {
  if (!iso) return 'Sem data';
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

function money(value?: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0);
}

function isOpenLead(lead: Lead) {
  return lead.status !== 'perdido' && lead.stage !== 'fechado';
}

function buildNotifications(leads: Lead[], finance: FinanceOverview | null): NotificationItem[] {
  const openLeads = leads.filter(isOpenLead);
  const overdue = openLeads.filter((lead) => lead.next_contact_date && daysUntil(lead.next_contact_date) < 0);
  const today = openLeads.filter((lead) => lead.next_contact_date && daysUntil(lead.next_contact_date) === 0);
  const tomorrow = openLeads.filter((lead) => lead.next_contact_date && daysUntil(lead.next_contact_date) === 1);
  const withoutNext = openLeads.filter((lead) => !lead.next_contact_date);
  const recentLeads = openLeads.filter((lead) => lead.status === 'novo' || lead.stage === 'novo').length;

  const items: NotificationItem[] = [];

  if ((finance?.overdue_count ?? 0) > 0) {
    items.push({
      id: 'finance-overdue',
      title: `${finance?.overdue_count} cobranca${finance?.overdue_count === 1 ? '' : 's'} em atraso`,
      body: `${money(finance?.overdue_value)} precisam de revisao no financeiro.`,
      meta: 'Financeiro',
      path: '/financeiro/receita',
      tone: 'danger',
      icon: <WalletCards size={16} />,
    });
  }

  if (overdue.length > 0) {
    const first = overdue[0];
    items.push({
      id: 'lead-overdue',
      title: `${overdue.length} follow-up${overdue.length === 1 ? '' : 's'} atrasado${overdue.length === 1 ? '' : 's'}`,
      body: `${first.name} era para ${dateLabel(first.next_contact_date)}.`,
      meta: 'Comercial',
      path: '/comercial/followup',
      tone: 'danger',
      icon: <AlertTriangle size={16} />,
    });
  }

  if (today.length > 0) {
    const first = today[0];
    items.push({
      id: 'lead-today',
      title: `${today.length} contato${today.length === 1 ? '' : 's'} para hoje`,
      body: first.next_action || `${first.name}${first.company ? `, ${first.company}` : ''}`,
      meta: 'Agenda',
      path: '/comercial/agenda',
      tone: 'warning',
      icon: <CalendarClock size={16} />,
    });
  }

  if (tomorrow.length > 0) {
    items.push({
      id: 'lead-tomorrow',
      title: `${tomorrow.length} proximo${tomorrow.length === 1 ? '' : 's'} contato${tomorrow.length === 1 ? '' : 's'} amanha`,
      body: 'Prepare a cadencia comercial antes de virar urgencia.',
      meta: 'Agenda',
      path: '/comercial/agenda',
      tone: 'info',
      icon: <CalendarClock size={16} />,
    });
  }

  if (withoutNext.length > 0) {
    items.push({
      id: 'lead-without-next',
      title: `${withoutNext.length} lead${withoutNext.length === 1 ? '' : 's'} sem proximo contato`,
      body: 'Defina uma data para aparecerem em agenda e follow-up.',
      meta: 'Leads',
      path: '/comercial/leads',
      tone: 'info',
      icon: <UserPlus size={16} />,
    });
  }

  if (items.length === 0 && recentLeads > 0) {
    items.push({
      id: 'commercial-ok',
      title: 'Comercial sem urgencias agora',
      body: `${recentLeads} lead${recentLeads === 1 ? '' : 's'} ativo${recentLeads === 1 ? '' : 's'} em acompanhamento.`,
      meta: 'Resumo',
      path: '/comercial/leads',
      tone: 'success',
      icon: <CheckCircle2 size={16} />,
    });
  }

  if ((finance?.pending_count ?? 0) > 0 && items.length < 6) {
    items.push({
      id: 'finance-pending',
      title: `${finance?.pending_count} cobranca${finance?.pending_count === 1 ? '' : 's'} pendente${finance?.pending_count === 1 ? '' : 's'}`,
      body: `${money(finance?.pending_value)} previstos para recebimento.`,
      meta: 'Financeiro',
      path: '/financeiro/receita',
      tone: 'info',
      icon: <WalletCards size={16} />,
    });
  }

  return items.slice(0, 6);
}

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [finance, setFinance] = useState<FinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [leadResult, financeResult] = await Promise.allSettled([
        api.get('/leads?soft=true'),
        api.get('/financial/overview?days=30'),
      ]);

      if (leadResult.status === 'fulfilled') {
        setLeads(Array.isArray(leadResult.value.data) ? leadResult.value.data : []);
      } else {
        setLeads([]);
        setError('Nao foi possivel carregar os leads agora.');
      }

      if (financeResult.status === 'fulfilled') setFinance(financeResult.value.data ?? null);
      else setFinance(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', handlePointer);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('pointerdown', handlePointer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const notifications = useMemo(() => buildNotifications(leads, finance), [leads, finance]);
  const urgentCount = notifications.filter((item) => item.tone === 'danger' || item.tone === 'warning').length;
  const badgeCount = notifications.length;

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white transition-colors hover:bg-violet-50 sm:h-8 sm:w-8"
        style={{ color: open ? 'var(--erp-violet)' : 'var(--erp-text-muted)', border: '1px solid var(--erp-border)' }}
        aria-label="Notificacoes"
        aria-expanded={open}
      >
        <Bell size={16} />
        {badgeCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white" style={{ background: urgentCount > 0 ? 'var(--erp-rose)' : 'var(--erp-violet)' }}>
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-x-3 top-[4.25rem] z-[55] overflow-hidden rounded-2xl border bg-white shadow-[0_18px_45px_rgba(43,22,92,0.16)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-[23rem]"
            style={{ borderColor: 'var(--erp-border)' }}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--erp-border)' }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Notificacoes</p>
                <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>{loading ? 'Atualizando prioridades...' : `${badgeCount} prioridade${badgeCount === 1 ? '' : 's'} agora`}</p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => void load()} className="flex h-9 w-9 items-center justify-center rounded-full" style={{ color: 'var(--erp-text-muted)' }} aria-label="Atualizar notificacoes">
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
                <button type="button" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full sm:hidden" style={{ color: 'var(--erp-text-muted)' }} aria-label="Fechar notificacoes">
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-2">
              {error && (
                <div className="mb-2 rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(190,18,60,0.08)', color: 'var(--erp-rose)' }}>
                  {error}
                </div>
              )}

              {loading && notifications.length === 0 ? (
                <div className="space-y-2 p-1">
                  {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />)}
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-5 py-8 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: 'rgba(4,120,87,0.10)', color: 'var(--erp-emerald)' }}><CheckCircle2 size={20} /></span>
                  <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Tudo em ordem</p>
                  <p className="mt-1 max-w-[16rem] text-xs" style={{ color: 'var(--erp-text-muted)' }}>Sem follow-ups urgentes ou pendencias financeiras no momento.</p>
                </div>
              ) : (
                <div className="grid gap-1.5">
                  {notifications.map((item) => {
                    const style = toneStyle[item.tone];
                    return (
                      <button key={item.id} type="button" onClick={() => go(item.path)} className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-violet-50">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: style.bg, color: style.color }}>{item.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>{item.title}</span>
                            <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--erp-surface-2)', color: 'var(--erp-text-muted)' }}>{item.meta}</span>
                          </span>
                          <span className="mt-1 block text-xs leading-5" style={{ color: 'var(--erp-text-muted)' }}>{item.body}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
