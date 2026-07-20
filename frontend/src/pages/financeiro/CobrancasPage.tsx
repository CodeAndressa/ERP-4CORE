import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle, Calendar, Check, CheckCircle2, ChevronDown, ChevronRight, Clock3, Copy,
  ExternalLink, FileText, Mail, MessageCircle, RefreshCw, Search, Wallet, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import FinancePeriodFilter from './FinancePeriodFilter';
import { DEFAULT_PERIOD, getPeriodRange, type FinancePeriod } from './financePeriod';

type ChargeKind = 'all' | 'one_off' | 'subscription';
type StatusFilter = 'all' | 'received' | 'confirmed' | 'pending' | 'overdue';

type Charge = {
  id: string;
  customer_id?: string;
  customer: string;
  customer_email?: string;
  customer_phone?: string;
  customer_document?: string;
  description: string;
  value: number;
  net_value: number;
  status: string;
  status_label: string;
  billing_type?: string;
  payment_method: string;
  due_date?: string;
  original_due_date?: string;
  payment_date?: string;
  client_payment_date?: string;
  estimated_credit_date?: string;
  subscription_id?: string;
  installment_id?: string;
  installment_number?: number;
  invoice_url?: string;
  bank_slip_url?: string;
  invoice_number?: string;
  external_reference?: string;
  charge_kind: 'one_off' | 'subscription';
  days_overdue: number;
  last_invoice_viewed_date?: string;
  last_bank_slip_viewed_date?: string;
};

type Metric = { count: number; value: number };
type ChargesResponse = {
  account_balance?: number | null;
  updated_at: string;
  summary: { total: Metric; received: Metric; confirmed: Metric; pending: Metric; overdue: Metric };
  total: number;
  data: Charge[];
};

const money = (value = 0) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const dateLabel = (value?: string) => value ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${value.slice(0, 10)}T12:00:00`)) : '—';

const STATUS_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  RECEIVED: { bg: '#ecfdf5', color: '#047857', dot: '#059669' },
  RECEIVED_IN_CASH: { bg: '#ecfdf5', color: '#047857', dot: '#059669' },
  CONFIRMED: { bg: '#ecfeff', color: '#0e7490', dot: '#0891b2' },
  PENDING: { bg: '#fffbeb', color: '#a16207', dot: '#d97706' },
  OVERDUE: { bg: '#fff1f2', color: '#be123c', dot: '#e11d48' },
};

function StatusBadge({ charge }: { charge: Charge }) {
  const style = STATUS_STYLE[charge.status] ?? { bg: 'var(--erp-surface-2)', color: 'var(--erp-text-muted)', dot: 'var(--erp-text-dim)' };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: style.bg, color: style.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.dot }} />
      {charge.status_label}
    </span>
  );
}

function MetricButton({ label, metric, active, tone, icon, onClick }: { label: string; metric: Metric; active: boolean; tone: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-[168px] flex-1 rounded-2xl border bg-white p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ borderColor: active ? tone : 'var(--erp-border)', outlineColor: 'var(--erp-violet)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold" style={{ color: 'var(--erp-text-muted)' }}>{label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums" style={{ color: 'var(--erp-text)' }}>{money(metric.value)}</p>
          <p className="mt-1 text-xs" style={{ color: tone }}>{metric.count} {metric.count === 1 ? 'cobrança' : 'cobranças'}</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: `${tone}12`, color: tone }}>{icon}</span>
      </div>
    </button>
  );
}

function ChargeDetail({ charge, onClose }: { charge: Charge; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const collectionMessage = `Olá, ${charge.customer}. Identificamos que a cobrança de ${money(charge.value)}, com vencimento em ${dateLabel(charge.due_date)}, está pendente. Você consegue verificar, por favor?${charge.invoice_url ? ` Link para pagamento: ${charge.invoice_url}` : ''}`;
  const phone = (charge.customer_phone ?? '').replace(/\D/g, '');
  const whatsappPhone = phone.startsWith('55') ? phone : `55${phone}`;

  async function copyLink() {
    if (!charge.invoice_url) return;
    await navigator.clipboard.writeText(charge.invoice_url);
    toast.success('Link da cobrança copiado');
  }

  const fields = [
    ['Forma de pagamento', charge.payment_method],
    ['Vencimento', dateLabel(charge.due_date)],
    ['Pagamento', dateLabel(charge.payment_date || charge.client_payment_date)],
    ['Crédito estimado', dateLabel(charge.estimated_credit_date)],
    ['Valor líquido', money(charge.net_value)],
    ['Tipo', charge.charge_kind === 'subscription' ? 'Assinatura' : 'Avulsa'],
    ['Número da fatura', charge.invoice_number || '—'],
    ['Referência externa', charge.external_reference || '—'],
  ];

  return (
    <motion.aside
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes da cobrança de ${charge.customer}`}
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 24, opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-[520px] flex-col border-l bg-white"
      style={{ borderColor: 'var(--erp-border)', boxShadow: '-12px 0 32px rgba(43,22,92,0.12)' }}
    >
      <div className="flex items-start justify-between gap-4 border-b px-5 py-5 sm:px-6" style={{ borderColor: 'var(--erp-border)' }}>
        <div className="min-w-0">
          <StatusBadge charge={charge} />
          <h2 className="mt-3 truncate text-lg font-bold" style={{ color: 'var(--erp-text)' }}>{charge.customer}</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--erp-text-muted)' }}>{charge.description}</p>
        </div>
        <button type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-[var(--erp-surface-2)]" aria-label="Fechar detalhes">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="border-b pb-5" style={{ borderColor: 'var(--erp-border)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--erp-text-muted)' }}>Valor da cobrança</p>
          <p className="mt-1 text-3xl font-bold tabular-nums" style={{ color: charge.status === 'OVERDUE' ? 'var(--erp-rose)' : 'var(--erp-text)' }}>{money(charge.value)}</p>
          {charge.status === 'OVERDUE' && <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--erp-rose)' }}>Vencida há {charge.days_overdue} {charge.days_overdue === 1 ? 'dia' : 'dias'}</p>}
        </div>

        {charge.status === 'OVERDUE' && (
          <div className="mt-5 rounded-2xl p-4" style={{ background: '#fff1f2', color: '#9f1239' }}>
            <p className="text-sm font-semibold">Ação recomendada</p>
            <p className="mt-1 text-sm leading-relaxed">Entre em contato com o cliente, confirme o recebimento da fatura e combine uma nova data quando necessário.</p>
          </div>
        )}

        <div className="mt-6">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Dados da cobrança</h3>
          <dl className="mt-3 divide-y" style={{ borderColor: 'var(--erp-border)' }}>
            {fields.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 py-3 text-sm">
                <dt style={{ color: 'var(--erp-text-muted)' }}>{label}</dt>
                <dd className="text-right font-medium" style={{ color: 'var(--erp-text)' }}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Contato do cliente</h3>
          <div className="mt-3 space-y-2 text-sm" style={{ color: 'var(--erp-text-muted)' }}>
            <p>{charge.customer_phone || 'Telefone não informado no ASAAS'}</p>
            <p>{charge.customer_email || 'E-mail não informado no ASAAS'}</p>
          </div>
        </div>
      </div>

      <div className="border-t bg-white p-4 sm:p-5" style={{ borderColor: 'var(--erp-border)' }}>
        <div className="grid grid-cols-2 gap-2">
          {phone && (
            <a href={`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(collectionMessage)}`} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2b165c] px-3 text-sm font-semibold text-white">
              <MessageCircle size={16} /> Cobrar no WhatsApp
            </a>
          )}
          {charge.customer_email && (
            <a href={`mailto:${charge.customer_email}?subject=${encodeURIComponent(`Cobrança ${charge.invoice_number || charge.id}`)}&body=${encodeURIComponent(collectionMessage)}`} className="flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold" style={{ borderColor: 'var(--erp-border)', color: 'var(--erp-text)' }}>
              <Mail size={16} /> Enviar e-mail
            </a>
          )}
          {charge.invoice_url && (
            <a href={charge.invoice_url} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold" style={{ borderColor: 'var(--erp-border)', color: 'var(--erp-text)' }}>
              <ExternalLink size={16} /> Abrir cobrança
            </a>
          )}
          {charge.invoice_url && (
            <button type="button" onClick={copyLink} className="flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold" style={{ borderColor: 'var(--erp-border)', color: 'var(--erp-text)' }}>
              <Copy size={16} /> Copiar link
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );
}

type DunningPreview = {
  dry_run: boolean;
  total_overdue_eligible: number;
  sent: { payment_id: string; customer: string; customer_email: string; value: number; days_overdue: number; send_count: number }[];
  skipped: { payment_id: string; customer: string; days_overdue: number; reason: string }[];
};
type CollectionsStatus = { configured: boolean; dry_run: boolean; start_days: number; interval_days: number };

function DunningCard() {
  const [status, setStatus] = useState<CollectionsStatus | null>(null);
  const [preview, setPreview] = useState<DunningPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<CollectionsStatus>('/financial/collections/status').catch(() => null),
      api.get<DunningPreview>('/financial/collections/preview').catch(() => null),
    ]).then(([s, p]) => {
      if (s) setStatus(s.data);
      if (p) setPreview(p.data);
    }).finally(() => setLoading(false));
  }, []);

  async function openEmailPreview() {
    const { data } = await api.get('/financial/collections/preview-email', { responseType: 'text' });
    const win = window.open('', '_blank');
    if (win) { win.document.write(data as unknown as string); win.document.close(); }
  }

  if (loading) return <div className="h-16 animate-pulse rounded-2xl" style={{ background: 'var(--erp-surface-2)' }} />;
  if (!status) return null;

  return (
    <div className="rounded-2xl border bg-white p-4" style={{ borderColor: 'var(--erp-border)' }}>
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: 'rgba(180,83,9,0.12)', color: '#b45309' }}>
            <Mail size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>
              Cobrança automática por e-mail {status.dry_run ? <span className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: 'rgba(8,145,178,0.12)', color: 'var(--erp-cyan)' }}>Modo teste</span> : null}
            </p>
            <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>
              A partir de {status.start_days} dias de atraso, a cada {status.interval_days} dias · {preview?.total_overdue_eligible ?? 0} cobranças elegíveis hoje
              {!status.configured && ' · Resend não configurado ainda'}
            </p>
          </div>
        </div>
        <ChevronDown size={16} style={{ color: 'var(--erp-text-dim)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {expanded && preview && (
        <div className="mt-4 space-y-1.5 border-t pt-3" style={{ borderColor: 'var(--erp-border)' }}>
          {preview.sent.length === 0 && preview.skipped.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>Nenhuma cobrança vencida elegível agora.</p>
          ) : (
            <>
              {preview.sent.map((item) => (
                <div key={item.payment_id} className="flex items-center justify-between gap-2 text-xs">
                  <span style={{ color: 'var(--erp-text)' }}>{item.customer} <span style={{ color: 'var(--erp-text-dim)' }}>({item.customer_email})</span></span>
                  <span style={{ color: 'var(--erp-text-muted)' }}>{item.days_overdue}d · {item.send_count === 1 ? '1º lembrete' : `${item.send_count}º lembrete`}</span>
                </div>
              ))}
              {preview.skipped.map((item) => (
                <div key={item.payment_id} className="flex items-center justify-between gap-2 text-xs opacity-60">
                  <span style={{ color: 'var(--erp-text-muted)' }}>{item.customer}</span>
                  <span style={{ color: 'var(--erp-text-dim)' }}>{item.reason}</span>
                </div>
              ))}
            </>
          )}
          {preview.total_overdue_eligible > 0 && (
            <button
              type="button"
              onClick={openEmailPreview}
              className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold"
              style={{ color: 'var(--erp-violet-light)' }}
            >
              <Mail size={12} /> Ver layout exato do e-mail
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type DunningHistoryItem = {
  payment_id: string;
  customer: string;
  value: number;
  send_count: number;
  last_sent_at: string | null;
  resolved_at: string | null;
  resolved_status: string;
  resolved_payment_date: string;
  status: 'em cobrança' | 'resolvido';
};

function dateTimeLabel(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function DunningHistoryCard() {
  const [items, setItems] = useState<DunningHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get<{ items: DunningHistoryItem[] }>('/financial/collections/history')
      .then(({ data }) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="h-24 animate-pulse rounded-2xl" style={{ background: 'var(--erp-surface-2)' }} />;
  if (items.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: 'var(--erp-border)' }}>
      <div className="flex items-center justify-between border-b p-4" style={{ borderColor: 'var(--erp-border)' }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Histórico da régua de cobrança</p>
          <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>Todo disparo automático, e quando cada pagamento foi identificado</p>
        </div>
        <button type="button" onClick={load} className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--erp-surface-2)]" aria-label="Atualizar">
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--erp-border)' }}>
              {['Cliente', 'Valor', 'Lembretes', 'Último envio', 'Status'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--erp-border)' }}>
            {items.map((item) => (
              <tr key={item.payment_id}>
                <td className="px-4 py-3 font-semibold" style={{ color: 'var(--erp-text)' }}>{item.customer}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--erp-text)' }}>{money(item.value)}</td>
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{item.send_count}</td>
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{dateTimeLabel(item.last_sent_at)}</td>
                <td className="px-4 py-3">
                  {item.status === 'resolvido' ? (
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: '#ecfdf5', color: '#047857' }}>
                        <CheckCircle2 size={12} /> Pagamento identificado
                      </span>
                      <p className="mt-1 text-[11px]" style={{ color: 'var(--erp-text-dim)' }}>
                        {dateTimeLabel(item.resolved_at)}{item.resolved_payment_date ? ` · pago em ${dateLabel(item.resolved_payment_date)}` : ''}
                      </p>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'rgba(180,83,9,0.12)', color: '#b45309' }}>
                      <Clock3 size={12} /> Em cobrança
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CobrancasPage() {
  const [searchParams] = useSearchParams();
  const [kind, setKind] = useState<ChargeKind>('all');
  const [status, setStatus] = useState<StatusFilter>(() => {
    const initial = searchParams.get('status');
    return initial && ['received', 'confirmed', 'pending', 'overdue'].includes(initial) ? initial as StatusFilter : 'all';
  });
  const [period, setPeriod] = useState<FinancePeriod>(DEFAULT_PERIOD);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<ChargesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Charge | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback((refresh = false) => {
    const range = getPeriodRange(period);
    const params = new URLSearchParams({ kind, status, limit: '100' });
    if (query) params.set('search', query);
    if (range.startDate && period.preset !== 'all') params.set('start_date', range.startDate);
    if (range.endDate && period.preset !== 'all') params.set('end_date', range.endDate);
    if (refresh) params.set('refresh', 'true');
    setLoading(true);
    setError(null);
    api.get<ChargesResponse>(`/financial/charges?${params.toString()}`)
      .then(({ data: response }) => setData(response))
      .catch((requestError) => setError(requestError?.response?.data?.detail || 'Não foi possível carregar as cobranças do ASAAS.'))
      .finally(() => setLoading(false));
  }, [kind, status, query, period]);

  useEffect(() => { load(false); }, [load]);

  const summary = data?.summary ?? {
    total: { count: 0, value: 0 }, received: { count: 0, value: 0 }, confirmed: { count: 0, value: 0 }, pending: { count: 0, value: 0 }, overdue: { count: 0, value: 0 },
  };
  const kinds = useMemo(() => [
    { id: 'all' as const, label: 'Todas' },
    { id: 'one_off' as const, label: 'Avulsas' },
    { id: 'subscription' as const, label: 'Assinaturas' },
  ], []);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-end lg:justify-between" style={{ borderColor: 'var(--erp-border)' }}>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--erp-text)' }}>Cobranças</h1>
          <p className="mt-1 max-w-2xl text-sm" style={{ color: 'var(--erp-text-muted)' }}>Acompanhe recebimentos e cobre pendências sem sair do 4Core.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <FinancePeriodFilter value={period} onApply={setPeriod} />
          <button type="button" onClick={() => load(true)} className="flex h-11 items-center justify-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold" style={{ borderColor: 'var(--erp-border)', color: 'var(--erp-text)' }}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Atualizar ASAAS
          </button>
        </div>
      </header>

      {error && <div className="flex items-center gap-2 rounded-xl border p-4 text-sm" style={{ background: '#fff1f2', borderColor: '#fecdd3', color: '#9f1239' }}><AlertCircle size={17} />{error}</div>}

      <DunningCard />
      <DunningHistoryCard />

      <div className="flex gap-3 overflow-x-auto pb-1">
        <div className="min-w-[168px] flex-1 rounded-2xl border bg-white p-4" style={{ borderColor: 'var(--erp-border)' }}>
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-semibold" style={{ color: 'var(--erp-text-muted)' }}>Saldo em conta</p><p className="mt-1 text-xl font-bold tabular-nums" style={{ color: 'var(--erp-text)' }}>{loading ? '—' : data?.account_balance == null ? 'Indisponível' : money(data.account_balance)}</p><p className="mt-1 text-xs" style={{ color: 'var(--erp-violet)' }}>Disponível agora no ASAAS</p></div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--erp-violet-soft)] text-[var(--erp-violet)]"><Wallet size={17} /></span>
          </div>
        </div>
        <MetricButton label="Recebidas" metric={summary.received} active={status === 'received'} tone="#047857" icon={<CheckCircle2 size={17} />} onClick={() => setStatus(status === 'received' ? 'all' : 'received')} />
        <MetricButton label="Confirmadas" metric={summary.confirmed} active={status === 'confirmed'} tone="#0891b2" icon={<Check size={17} />} onClick={() => setStatus(status === 'confirmed' ? 'all' : 'confirmed')} />
        <MetricButton label="Aguardando pagamento" metric={summary.pending} active={status === 'pending'} tone="#b45309" icon={<Clock3 size={17} />} onClick={() => setStatus(status === 'pending' ? 'all' : 'pending')} />
        <MetricButton label="Vencidas" metric={summary.overdue} active={status === 'overdue'} tone="#be123c" icon={<AlertCircle size={17} />} onClick={() => setStatus(status === 'overdue' ? 'all' : 'overdue')} />
      </div>

      <section className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: 'var(--erp-border)' }}>
        <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4" style={{ borderColor: 'var(--erp-border)' }}>
          <div className="flex rounded-xl bg-[var(--erp-surface-2)] p-1" role="tablist" aria-label="Tipo de cobrança">
            {kinds.map((item) => <button key={item.id} type="button" role="tab" aria-selected={kind === item.id} onClick={() => setKind(item.id)} className="min-h-10 flex-1 rounded-lg px-4 text-sm font-semibold transition-colors sm:flex-none" style={{ background: kind === item.id ? '#fff' : 'transparent', color: kind === item.id ? 'var(--erp-violet)' : 'var(--erp-text-muted)' }}>{item.label}</button>)}
          </div>
          <label className="flex h-11 min-w-0 items-center gap-2 rounded-xl bg-[var(--erp-surface-2)] px-3 sm:w-80">
            <Search size={16} style={{ color: 'var(--erp-text-dim)' }} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cliente, descrição ou contato" className="min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm" style={{ color: 'var(--erp-text)' }} />
          </label>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead><tr className="border-b" style={{ borderColor: 'var(--erp-border)' }}>{['Cliente', 'Tipo', 'Vencimento', 'Forma', 'Valor', 'Status', ''].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--erp-text-muted)' }}>{heading}</th>)}</tr></thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--erp-border)' }}>
              {(data?.data ?? []).map((charge) => (
                <tr key={charge.id} className="cursor-pointer transition-colors hover:bg-[var(--erp-surface-2)]" onClick={() => setSelected(charge)}>
                  <td className="px-4 py-3"><p className="font-semibold" style={{ color: 'var(--erp-text)' }}>{charge.customer}</p><p className="mt-0.5 max-w-[260px] truncate text-xs" style={{ color: 'var(--erp-text-muted)' }}>{charge.description}</p></td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{charge.charge_kind === 'subscription' ? 'Assinatura' : 'Avulsa'}</td>
                  <td className="px-4 py-3"><span className="flex items-center gap-1.5 text-xs" style={{ color: charge.status === 'OVERDUE' ? 'var(--erp-rose)' : 'var(--erp-text-muted)' }}><Calendar size={13} />{dateLabel(charge.due_date)}{charge.days_overdue > 0 && ` · ${charge.days_overdue}d`}</span></td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{charge.payment_method}</td>
                  <td className="px-4 py-3 font-bold tabular-nums" style={{ color: 'var(--erp-text)' }}>{money(charge.value)}</td>
                  <td className="px-4 py-3"><StatusBadge charge={charge} /></td>
                  <td className="px-4 py-3 text-right"><ChevronRight size={16} style={{ color: 'var(--erp-text-dim)' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y md:hidden" style={{ borderColor: 'var(--erp-border)' }}>
          {(data?.data ?? []).map((charge) => (
            <button key={charge.id} type="button" onClick={() => setSelected(charge)} className="block w-full p-4 text-left transition-colors active:bg-[var(--erp-surface-2)]">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold" style={{ color: 'var(--erp-text)' }}>{charge.customer}</p><p className="mt-1 truncate text-xs" style={{ color: 'var(--erp-text-muted)' }}>{charge.description}</p></div><p className="shrink-0 font-bold tabular-nums" style={{ color: 'var(--erp-text)' }}>{money(charge.value)}</p></div>
              <div className="mt-3 flex items-center justify-between gap-3"><StatusBadge charge={charge} /><span className="text-xs" style={{ color: charge.status === 'OVERDUE' ? 'var(--erp-rose)' : 'var(--erp-text-muted)' }}>{dateLabel(charge.due_date)}{charge.days_overdue > 0 && ` · ${charge.days_overdue}d em atraso`}</span></div>
            </button>
          ))}
        </div>

        {!loading && (data?.data.length ?? 0) === 0 && <div className="px-5 py-14 text-center"><FileText size={28} className="mx-auto" style={{ color: 'var(--erp-text-dim)' }} /><p className="mt-3 text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Nenhuma cobrança encontrada</p><p className="mt-1 text-sm" style={{ color: 'var(--erp-text-muted)' }}>Ajuste o período ou os filtros para ampliar a busca.</p></div>}
        {loading && <div className="space-y-3 p-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-[var(--erp-surface-2)]" />)}</div>}
        {!loading && (data?.total ?? 0) > 0 && <div className="border-t px-4 py-3 text-xs" style={{ borderColor: 'var(--erp-border)', color: 'var(--erp-text-muted)' }}>{data?.total} {data?.total === 1 ? 'cobrança encontrada' : 'cobranças encontradas'} · mostrando até 100</div>}
      </section>

      <AnimatePresence>
        {selected && <><motion.button type="button" aria-label="Fechar detalhes" onClick={() => setSelected(null)} className="fixed inset-0 z-[70] bg-[#151127]/20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><ChargeDetail charge={selected} onClose={() => setSelected(null)} /></>}
      </AnimatePresence>
    </div>
  );
}
