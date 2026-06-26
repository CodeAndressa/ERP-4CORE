import { useEffect, useState, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, RefreshCw,
  CheckCircle, Users, ArrowRight, CreditCard,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { SubNav } from '../../shared/components/layout/SubNav';
import { MetricCard } from '../../shared/components/layout/MetricCard';
import { Card, CardHeader } from '../../shared/components/ui/Card';

// ─── types ────────────────────────────────────────────────────────────────────
export type AsaasData = {
  received_value: number;
  pending_value: number;
  overdue_value: number;
  overdue_count: number;
  pending_count: number;
  received_count: number;
  customers_total: number;
  recurring_value: number;
  recurring_count: number;
  forecast_6_months: { month: string; value: number }[];
  billing_types: { type: string; value: number }[];
  daily_status: { date: string; received: number; confirmed: number; pending: number; overdue: number }[];
  payments: {
    id: string; customer: string; description: string;
    value: number; status: string; due_date: string;
  }[];
  subscriptions?: {
    id: string; customer: string; value: number;
    status: string; nextDueDate: string; description: string;
  }[];
};

// ─── helpers ─────────────────────────────────────────────────────────────────
export const money = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const TABS = [
  { label: 'Visão Geral',     path: '/financeiro' },
  { label: 'A Receber',       path: '/financeiro/contas-receber' },
  { label: 'Mensalidades',    path: '/financeiro/mensalidades' },
  { label: 'Projeções',       path: '/financeiro/projecoes' },
  { label: 'Receitas',        path: '/financeiro/receitas' },
  { label: 'Despesas',        path: '/financeiro/despesas' },
  { label: 'Fluxo de Caixa',  path: '/financeiro/fluxo-caixa' },
];

const PERIODS = [
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: '180d', value: 180 },
  { label: '365d', value: 365 },
];

const BILLING_LABELS: Record<string, string> = {
  BOLETO: 'Boleto',
  CREDIT_CARD: 'Cartão',
  PIX: 'PIX',
  DEBIT_CARD: 'Débito',
  UNDEFINED: 'Outros',
};

const BILLING_COLORS = ['#7c4dff', '#34d399', '#fbbf24', '#67e8f9', '#f87171'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-2xl"
      style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border-strong)', color: 'var(--erp-text)' }}>
      <p className="mb-1" style={{ color: 'var(--erp-text-muted)' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {typeof p.value === 'number' ? money(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

// ─── context / shared state ──────────────────────────────────────────────────
// Sub-pages import and use this hook to get shared data
let _sharedData: AsaasData | null = null;
let _sharedLoading = true;

export function useFinanceiroData() {
  return { data: _sharedData, loading: _sharedLoading };
}

// ─── FinanceiroLayout — wraps all sub-pages with SubNav + shared data fetch ──
export function FinanceiroLayout() {
  const { pathname } = useLocation();
  const isIndex = pathname === '/financeiro';

  return (
    <div className="space-y-0">
      <SubNav tabs={TABS} />
      <div className="pt-6">
        {isIndex ? <FinanceiroOverview /> : <Outlet />}
      </div>
    </div>
  );
}

// ─── Main overview page ───────────────────────────────────────────────────────
function FinanceiroOverview() {
  const [data, setData] = useState<AsaasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(180);
  const [expandedCard, setExpandedCard] = useState<'pending' | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get<AsaasData>(`/financial/overview?days=${days}`)
      .then(({ data: d }) => { setData(d); _sharedData = d; _sharedLoading = false; })
      .catch((e) => setError(e?.response?.data?.detail || 'Falha ao conectar ao ASAAS'))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const forecastData = (data?.forecast_6_months ?? []).map((d) => ({
    ...d,
    label: new Date(d.month + '-02').toLocaleString('pt-BR', { month: 'short' }),
  }));

  const billingData = (data?.billing_types ?? []).map((b) => ({
    name: BILLING_LABELS[b.type] ?? b.type,
    value: b.value,
  }));

  return (
    <div className="space-y-6">
      {/* Title + period filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--erp-text)' }}>Financeiro</h1>
          <p className="text-sm" style={{ color: 'var(--erp-text-muted)' }}>Dados reais · ASAAS</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--erp-border)' }}>
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setDays(p.value)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: days === p.value ? 'var(--erp-violet)' : 'var(--erp-surface)',
                  color: days === p.value ? '#fff' : 'var(--erp-text-muted)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors"
            style={{ border: '1px solid var(--erp-border)', color: 'var(--erp-text-muted)', background: 'var(--erp-surface)' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
          <AlertTriangle size={14} />
          <span><strong>ASAAS:</strong> {error}</span>
        </div>
      )}

      {/* KPIs */}
      <div className="space-y-3">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Recebido"
            value={loading ? '…' : data ? money(data.received_value) : '—'}
            detail={data ? `${data.received_count} cobranças · ${days}d` : undefined}
            tone="emerald"
            icon={<CheckCircle size={16} />}
          />
          <MetricCard
            label="A Receber"
            value={loading ? '…' : data ? money(data.pending_value) : '—'}
            detail={data ? `${data.pending_count} pendentes` : undefined}
            tone="violet"
            icon={<DollarSign size={16} />}
            tooltip="Cobranças criadas no ASAAS que ainda não foram pagas (status PENDING). Inclui vencimentos futuros e cobranças aguardando pagamento."
            expandable
            expanded={expandedCard === 'pending'}
            onExpand={() => setExpandedCard(expandedCard === 'pending' ? null : 'pending')}
          />
          <MetricCard
            label="Em Atraso"
            value={loading ? '…' : data ? money(data.overdue_value) : '—'}
            detail={data ? `${data.overdue_count} vencidas` : undefined}
            tone="rose"
            icon={<AlertTriangle size={16} />}
          />
          <MetricCard
            label="Recorrente (MRR)"
            value={loading ? '…' : data ? money(data.recurring_value) : '—'}
            detail={data ? `${data.recurring_count} assinaturas ativas` : undefined}
            tone="amber"
            icon={<RefreshCw size={16} />}
          />
        </div>

        {/* Expandable: A Receber detail */}
        {expandedCard === 'pending' && data && (() => {
          const pending = data.payments.filter((p) =>
            ['PENDING', 'AWAITING_RISK_ANALYSIS', 'AWAITING_CHARGEBACK_REVERSAL'].includes(p.status)
          );
          return (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: '1px solid var(--erp-border-strong)', background: 'var(--erp-surface)' }}
            >
              <div className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: '1px solid var(--erp-border)', background: 'var(--erp-surface-2)' }}>
                <div className="flex items-center gap-2">
                  <DollarSign size={14} style={{ color: 'var(--erp-violet-light)' }} />
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--erp-text-muted)' }}>
                    Detalhamento · A Receber
                  </span>
                </div>
                <span className="text-xs" style={{ color: 'var(--erp-text-dim)' }}>
                  {pending.length} cobrança{pending.length !== 1 ? 's' : ''} · {money(pending.reduce((s, p) => s + p.value, 0))}
                </span>
              </div>
              {pending.length === 0 ? (
                <p className="py-8 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhuma cobrança pendente</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                        {['Cliente', 'Descrição', 'Vencimento', 'Valor', 'Status'].map((h) => (
                          <th key={h} className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                            style={{ color: 'var(--erp-text-dim)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pending.map((p, i) => (
                        <tr
                          key={p.id}
                          style={{ borderBottom: i < pending.length - 1 ? '1px solid var(--erp-border)' : undefined }}
                        >
                          <td className="px-5 py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{p.customer}</td>
                          <td className="px-5 py-3 max-w-[220px] truncate text-xs" style={{ color: 'var(--erp-text-muted)' }}>{p.description}</td>
                          <td className="px-5 py-3 tabular-nums text-xs" style={{ color: 'var(--erp-text-muted)' }}>{p.due_date}</td>
                          <td className="px-5 py-3 font-semibold tabular-nums" style={{ color: 'var(--erp-violet-light)' }}>{money(p.value)}</td>
                          <td className="px-5 py-3">
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
                              Pendente
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Secondary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Clientes"
          value={loading ? '…' : data ? String(data.customers_total) : '—'}
          detail="Total cadastrados · ASAAS"
          tone="cyan"
          icon={<Users size={16} />}
        />
        <MetricCard label="Despesas"      value="—" detail="Aguarda mapeamento" tone="rose"    icon={<TrendingDown size={16} />} />
        <MetricCard label="Lucro Líquido" value="—" detail="Aguarda mapeamento" tone="emerald" icon={<TrendingUp  size={16} />} />
        <MetricCard label="Caixa"         value="—" detail="Aguarda mapeamento" tone="violet"  icon={<CreditCard  size={16} />} />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Forecast chart */}
        <Card className="lg:col-span-2" padding="lg">
          <CardHeader
            title="Previsão de Recebimento"
            subtitle={forecastData.length ? `${days} dias por vencimento · ASAAS` : 'Aguardando dados'}
            action={
              <Link to="/financeiro/projecoes" className="text-xs flex items-center gap-1" style={{ color: 'var(--erp-violet-light)' }}>
                Detalhes <ArrowRight size={11} />
              </Link>
            }
          />
          {forecastData.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={forecastData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gFin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#7c4dff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7c4dff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--erp-border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--erp-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--erp-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={36} />
                <Tooltip content={<CustomTooltip />} />
                <Area name="Previsto" type="monotone" dataKey="value" stroke="#7c4dff" strokeWidth={2} fill="url(#gFin)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-44 items-center justify-center rounded-xl"
              style={{ border: '1px dashed var(--erp-border-strong)' }}>
              <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                {loading ? 'Carregando…' : 'Sem dados de previsão'}
              </p>
            </div>
          )}
        </Card>

        {/* Meios de pagamento */}
        <Card padding="lg">
          <CardHeader title="Meios de Pagamento" subtitle="Por volume cobrado" />
          {billingData.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={billingData} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={50} outerRadius={75} paddingAngle={3}>
                  {billingData.map((_, i) => (
                    <Cell key={i} fill={BILLING_COLORS[i % BILLING_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', color: 'var(--erp-text-muted)' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-44 items-center justify-center rounded-xl"
              style={{ border: '1px dashed var(--erp-border-strong)' }}>
              <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                {loading ? 'Carregando…' : 'Sem dados'}
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Payments list */}
      <Card padding="lg">
        <CardHeader
          title="Cobranças Recentes"
          subtitle={`${data?.payments?.length ?? 0} registros · amostra ${days}d`}
          action={
            <Link to="/financeiro/contas-receber" className="text-xs flex items-center gap-1" style={{ color: 'var(--erp-violet-light)' }}>
              Ver tudo <ArrowRight size={11} />
            </Link>
          }
        />
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />
            ))}
          </div>
        ) : (data?.payments ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhuma cobrança no período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                  {['Cliente', 'Descrição', 'Vencimento', 'Valor', 'Status'].map((h) => (
                    <th key={h} className="pb-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--erp-text-dim)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--erp-border)' }}>
                {(data?.payments ?? []).slice(0, 10).map((p) => {
                  const isPaid = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status);
                  const isOverdue = p.status === 'OVERDUE';
                  return (
                    <tr key={p.id}>
                      <td className="py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{p.customer}</td>
                      <td className="py-3 max-w-[200px] truncate" style={{ color: 'var(--erp-text-muted)' }}>{p.description}</td>
                      <td className="py-3 tabular-nums" style={{ color: 'var(--erp-text-muted)' }}>{p.due_date}</td>
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

export default FinanceiroLayout;
