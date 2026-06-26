import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid,
} from 'recharts';
import {
  DollarSign, TrendingUp, AlertTriangle, Users, Clock,
  ArrowRight, Sparkles, RefreshCw, CheckCircle, TrendingDown,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { MetricCard } from '../shared/components/layout/MetricCard';
import { Card, CardHeader } from '../shared/components/ui/Card';

// ─── types ────────────────────────────────────────────────────────────────────
type AsaasData = {
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
  payments: { id: string; customer: string; description: string; value: number; status: string; due_date: string }[];
};

type SiteData = {
  configured: boolean;
  summary?: {
    unique_visitors: number;
    pageviews: number;
    conversion_rate: number;
    bounce_rate: number;
    leads: number;
  };
  daily?: { date: string; visitors: number; pageviews: number }[];
};

// ─── helpers ──────────────────────────────────────────────────────────────────
const money = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const fmt = new Intl.NumberFormat('pt-BR');

function PendingMark() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium"
      style={{
        background: 'var(--erp-surface-2)',
        color: 'var(--erp-text-muted)',
        border: '1px dashed var(--erp-border-strong)',
      }}
    >
      <Clock size={9} />
      Aguarda mapeamento
    </span>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs shadow-2xl"
      style={{
        background: 'var(--erp-surface-2)',
        border: '1px solid var(--erp-border-strong)',
        color: 'var(--erp-text)',
      }}
    >
      <p className="mb-1" style={{ color: 'var(--erp-text-muted)' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {typeof p.value === 'number' && p.value > 1000 ? money(p.value) : fmt.format(p.value)}
        </p>
      ))}
    </div>
  );
};

function EmptyChart({ label }: { label: string }) {
  return (
    <div
      className="flex h-36 flex-col items-center justify-center gap-2 rounded-xl"
      style={{ border: '1px dashed var(--erp-border-strong)' }}
    >
      <Clock size={16} style={{ color: 'var(--erp-text-dim)' }} />
      <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>{label}</p>
    </div>
  );
}

// ─── component ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [asaas, setAsaas] = useState<AsaasData | null>(null);
  const [asaasLoading, setAsaasLoading] = useState(true);
  const [site, setSite] = useState<SiteData | null>(null);
  const [siteLoading, setSiteLoading] = useState(true);

  useEffect(() => {
    api.get<AsaasData>('/financial/overview')
      .then(({ data }) => setAsaas(data))
      .catch(() => setAsaas(null))
      .finally(() => setAsaasLoading(false));

    api.get<SiteData>('/site/dashboard?days=30')
      .then(({ data }) => setSite(data))
      .catch(() => setSite(null))
      .finally(() => setSiteLoading(false));
  }, []);

  const siteDaily = site?.daily?.slice(-14) ?? [];
  const forecast = asaas?.forecast_6_months?.slice(0, 6) ?? [];

  // show month abbrev for forecast chart labels (2025-06 → Jun)
  const forecastData = forecast.map((d) => ({
    ...d,
    label: new Date(d.month + '-02').toLocaleString('pt-BR', { month: 'short' }),
  }));

  return (
    <div className="space-y-6">

      {/* ── Page title ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>
            Visão executiva
          </p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Dashboard</h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--erp-text-muted)' }}>
            Dados em tempo real — integração ASAAS ativo
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition"
          style={{ border: '1px solid var(--erp-border)', color: 'var(--erp-text-muted)', background: 'var(--erp-surface)' }}
        >
          <RefreshCw size={12} />
          Atualizar
        </button>
      </div>

      {/* ── ASAAS financial KPIs ────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Recebido (amostra)"
          value={asaasLoading ? '…' : asaas ? money(asaas.received_value) : '—'}
          detail={asaas ? `${asaas.received_count} cobranças pagas · ASAAS` : 'Sem dados ASAAS'}
          tone="emerald"
          icon={<CheckCircle size={16} />}
        />
        <MetricCard
          label="A Receber"
          value={asaasLoading ? '…' : asaas ? money(asaas.pending_value) : '—'}
          detail={asaas ? `${asaas.pending_count} cobranças pendentes` : 'Sem dados ASAAS'}
          tone="violet"
          icon={<DollarSign size={16} />}
        />
        <MetricCard
          label="Em Atraso"
          value={asaasLoading ? '…' : asaas ? money(asaas.overdue_value) : '—'}
          detail={asaas ? `${asaas.overdue_count} cobranças vencidas` : 'Sem dados ASAAS'}
          tone="rose"
          icon={<AlertTriangle size={16} />}
        />
        <MetricCard
          label="Clientes (ASAAS)"
          value={asaasLoading ? '…' : asaas ? fmt.format(asaas.customers_total) : '—'}
          detail="Total de clientes cadastrados"
          tone="cyan"
          icon={<Users size={16} />}
        />
      </div>

      {/* ── Secondary KPIs ─────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Recorrente (MRR)"
          value={
            asaasLoading ? '…' :
            asaas && asaas.recurring_value > 0 ? money(asaas.recurring_value) : '—'
          }
          detail={
            asaas && asaas.recurring_value > 0
              ? `${asaas.recurring_count} assinaturas ativas`
              : 'Aguarda mapeamento'
          }
          tone="violet"
          icon={<RefreshCw size={16} />}
        />
        <MetricCard
          label="Receita do Mês"
          value="—"
          detail={<PendingMark />}
          tone="emerald"
          icon={<TrendingUp size={16} />}
        />
        <MetricCard
          label="Churn"
          value="—"
          detail={<PendingMark />}
          tone="amber"
          icon={<TrendingDown size={16} />}
        />
        <MetricCard
          label="Pipeline"
          value="—"
          detail={<PendingMark />}
          tone="cyan"
          icon={<Sparkles size={16} />}
        />
      </div>

      {/* ── Charts row ─────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Forecast ASAAS — real data */}
        <Card className="lg:col-span-2" padding="lg">
          <CardHeader
            title="Previsão de Cobrança"
            subtitle={
              forecast.length
                ? 'Próximos 6 meses · ASAAS por vencimento'
                : 'Aguarda dados do ASAAS'
            }
          />
          {asaasLoading ? (
            <EmptyChart label="Carregando dados do ASAAS…" />
          ) : forecast.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={forecastData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#7c4dff" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#7c4dff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--erp-border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--erp-text-muted)', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--erp-text-muted)', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  width={36}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  name="Previsto"
                  type="monotone"
                  dataKey="value"
                  stroke="#7c4dff"
                  strokeWidth={2}
                  fill="url(#gForecast)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="Sem dados de previsão disponíveis" />
          )}
        </Card>

        {/* Site traffic — real Supabase data */}
        <Card padding="lg">
          <CardHeader
            title="Tráfego do Site"
            subtitle={
              site?.configured
                ? 'Visitantes · 14 dias · Supabase'
                : 'Aguarda integração Supabase'
            }
          />
          {siteLoading ? (
            <EmptyChart label="Carregando dados do site…" />
          ) : siteDaily.length ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={siteDaily} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barSize={6}>
                  <Bar dataKey="visitors" fill="#7c4dff" opacity={0.75} radius={[3, 3, 0, 0]} name="Visitantes" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'var(--erp-text-muted)', fontSize: 9 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(d) => d.slice(8)}
                  />
                  <Tooltip content={<CustomTooltip />} />
                </BarChart>
              </ResponsiveContainer>
              {site?.summary && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg p-2 text-center" style={{ background: 'var(--erp-surface-2)' }}>
                    <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>Visitantes únicos</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>
                      {fmt.format(site.summary.unique_visitors)}
                    </p>
                  </div>
                  <div className="rounded-lg p-2 text-center" style={{ background: 'var(--erp-surface-2)' }}>
                    <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>Conversão</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>
                      {site.summary.conversion_rate}%
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <EmptyChart label="Integração Supabase não configurada" />
          )}
        </Card>
      </div>

      {/* ── Payments list + Alerts ─────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Recent payments from ASAAS */}
        <Card className="lg:col-span-2" padding="lg">
          <CardHeader
            title="Últimas Cobranças"
            subtitle="ASAAS — dados reais"
            action={
              <Link to="/financeiro" className="flex items-center gap-1 text-xs" style={{ color: 'var(--erp-violet-light)' }}>
                Ver todas <ArrowRight size={11} />
              </Link>
            }
          />
          {asaasLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg" style={{ background: 'var(--erp-surface-2)' }} />
              ))}
            </div>
          ) : asaas?.payments?.length ? (
            <div className="divide-y" style={{ borderColor: 'var(--erp-border)' }}>
              {asaas.payments.slice(0, 6).map((p) => {
                const isPaid = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status);
                const isOverdue = p.status === 'OVERDUE';
                return (
                  <div key={p.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: 'var(--erp-text)' }}>{p.customer}</p>
                      <p className="truncate text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                        {p.description} · vence {p.due_date}
                      </p>
                    </div>
                    <div className="ml-3 flex flex-shrink-0 items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          background: isPaid
                            ? 'rgba(52,211,153,0.12)'
                            : isOverdue
                            ? 'rgba(248,113,113,0.12)'
                            : 'rgba(251,191,36,0.12)',
                          color: isPaid ? '#34d399' : isOverdue ? '#f87171' : '#fbbf24',
                        }}
                      >
                        {isPaid ? 'Pago' : isOverdue ? 'Vencido' : 'Pendente'}
                      </span>
                      <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--erp-text)' }}>
                        {money(p.value)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyChart label="Sem cobranças disponíveis" />
          )}
        </Card>

        {/* Alerts & pending items */}
        <Card padding="lg">
          <CardHeader
            title="Alertas"
            subtitle="Ações recomendadas"
            action={
              <div className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: 'var(--erp-violet-dim)' }}>
                <Sparkles size={12} style={{ color: 'var(--erp-violet-light)' }} />
              </div>
            }
          />
          <div className="space-y-2.5">
            {/* Dynamic alert from ASAAS overdue */}
            {asaas && asaas.overdue_count > 0 && (
              <Link
                to="/financeiro/contas-receber"
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition"
                style={{ background: 'var(--erp-surface-2)' }}
              >
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
                  <AlertTriangle size={12} />
                </div>
                <p className="flex-1 text-xs leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}>
                  <span className="font-semibold" style={{ color: 'var(--erp-text)' }}>{asaas.overdue_count} cobrança{asaas.overdue_count !== 1 ? 's' : ''} vencida{asaas.overdue_count !== 1 ? 's'  : ''}</span>
                  {' '}— {money(asaas.overdue_value)} em atraso
                </p>
              </Link>
            )}
            {asaas && asaas.pending_count > 0 && (
              <Link
                to="/financeiro/contas-receber"
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition"
                style={{ background: 'var(--erp-surface-2)' }}
              >
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
                  <Clock size={12} />
                </div>
                <p className="flex-1 text-xs leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}>
                  <span className="font-semibold" style={{ color: 'var(--erp-text)' }}>{asaas.pending_count} pendente{asaas.pending_count !== 1 ? 's' : ''}</span>
                  {' '}· {money(asaas.pending_value)} a receber
                </p>
              </Link>
            )}

            {/* Static pending items */}
            {[
              { icon: Users, label: 'Top Oportunidades', to: '/comercial/pipeline' },
              { icon: TrendingUp, label: 'Agenda do dia', to: '/comercial/agenda' },
              { icon: Sparkles, label: 'Score de saúde', to: '/dashboard' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: 'var(--erp-surface-2)', border: '1px dashed var(--erp-border-strong)' }}
                >
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ background: 'var(--erp-violet-dim)', color: 'var(--erp-text-muted)' }}>
                    <Icon size={12} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>{item.label}</p>
                    <PendingMark />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
