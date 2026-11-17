import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle,
  Clock,
  RefreshCw,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Card, CardHeader } from '../shared/components/ui/Card';
import { Badge } from '../shared/components/ui/Badge';
import ScheduleCoverageAlert, { type Coverage } from '../shared/components/ScheduleCoverageAlert';
import { useAuthStore } from '../core/store/useAuthStore';

type Payment = { id: string; customer: string; description: string; value: number; status: string; due_date: string };
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
  payments: Payment[];
};

type SiteData = {
  configured?: boolean;
  summary?: {
    unique_visitors?: number;
    visitors?: number;
    pageviews?: number;
    conversion_rate?: number;
    bounce_rate?: number;
    leads?: number;
    conversions?: number;
  };
  daily?: { date: string; visitors: number; pageviews?: number }[];
};

type Lead = {
  id?: number | string;
  name?: string;
  company?: string;
  status?: string;
  origin?: string;
  source?: string;
  value?: number;
  value_potential?: number;
  potential_value?: number;
  created_at?: string;
};

type IgProfile = { followers_count?: number; media_count?: number; username?: string };
type Client = { id?: string | number; name?: string; company?: string; email?: string };
type Post = { id: string | number; title: string; channel: string; status: string; format?: string; date?: string };

const STATUS_LABELS: Record<string, string> = {
  publicado: 'Publicado',
  agendado: 'Agendado',
  revisao: 'Em revisão',
  ideia: 'Ideia',
};

const money = (value: number, digits = 0) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: digits }).format(value);
const fmt = new Intl.NumberFormat('pt-BR');

function normalizeList<T>(payload: T[] | { data?: T[]; leads?: T[] } | null | undefined): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.leads)) return payload.leads;
  return [];
}

function paymentStatus(payment: Payment) {
  if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(payment.status)) return { label: 'Pago', tone: 'emerald' as const };
  if (payment.status === 'OVERDUE') return { label: 'Vencido', tone: 'rose' as const };
  return { label: 'Pendente', tone: 'amber' as const };
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[18px] border border-violet-100 bg-white px-3 py-2 text-xs">
      <p className="mb-1 text-slate-500">{label}</p>
      {payload.map((item: any) => (
        <p key={item.name} className="font-medium" style={{ color: item.color }}>
          {item.name}: {fmt.format(Number(item.value ?? 0))}
        </p>
      ))}
    </div>
  );
}

function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-[22px] border border-dashed border-violet-200 bg-violet-50/40">
      <Clock size={16} className="text-slate-400" />
      <p className="text-xs text-slate-600">{label}</p>
    </div>
  );
}

function KpiCell({ label, primaryLabel, primaryValue, lines, to, loading }: { label: string; primaryLabel: string; primaryValue: string; lines: { label: string; value: string }[]; to: string; loading: boolean }) {
  return (
    <Link
      to={to}
      className="group flex min-w-0 flex-1 flex-col gap-3 py-4 transition-colors sm:py-5 sm:first:pl-0 sm:px-5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-muted)' }}>{label}</span>
        <ArrowRight size={13} className="opacity-0 transition-opacity group-hover:opacity-100" style={{ color: 'var(--erp-violet)' }} />
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-7 w-24 animate-pulse rounded-lg" style={{ background: 'var(--erp-surface-2)' }} />
          <div className="h-3 w-32 animate-pulse rounded-lg" style={{ background: 'var(--erp-surface-2)' }} />
        </div>
      ) : (
        <>
          <div>
            {/* 2.25rem em vez de 1.5: o numero e o conteudo da celula, nao um
              detalhe do rotulo acima dele. */}
          <p className="text-[2.25rem] font-bold tabular-nums leading-none tracking-tight" style={{ color: 'var(--erp-text)' }}>{primaryValue}</p>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--erp-text-dim)' }}>{primaryLabel}</p>
          </div>
          <div className="mt-auto space-y-1 border-t pt-2.5" style={{ borderColor: 'var(--erp-border)' }}>
            {lines.map((line) => (
              <div key={line.label} className="flex items-center justify-between gap-3 text-xs">
                <span style={{ color: 'var(--erp-text-muted)' }}>{line.label}</span>
                <span className="shrink-0 font-semibold tabular-nums" style={{ color: 'var(--erp-text)' }}>{line.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Link>
  );
}

type PriorityTone = 'rose' | 'violet' | 'amber' | 'emerald';

const PRIORITY_TONE_COLOR: Record<PriorityTone, string> = {
  rose: 'var(--erp-rose)',
  violet: 'var(--erp-violet)',
  amber: 'var(--erp-amber)',
  emerald: 'var(--erp-emerald)',
};

const PRIORITY_TONE_BG: Record<PriorityTone, string> = {
  rose: 'rgba(190,18,60,0.08)',
  violet: 'var(--erp-violet-dim)',
  amber: 'rgba(180,83,9,0.08)',
  emerald: 'rgba(4,120,87,0.08)',
};

function PriorityRow({ icon, label, detail, value, tone, to }: { icon: ReactNode; label: string; detail: string; value: string; tone: PriorityTone; to: string }) {
  return (
    <Link to={to} className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[var(--erp-surface-2)] sm:px-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: PRIORITY_TONE_BG[tone], color: PRIORITY_TONE_COLOR[tone] }}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>{label}</p>
        <p className="truncate text-xs" style={{ color: 'var(--erp-text-muted)' }}>{detail}</p>
      </div>
      <p className="shrink-0 text-sm font-bold tabular-nums" style={{ color: PRIORITY_TONE_COLOR[tone] }}>{value}</p>
    </Link>
  );
}

export default function DashboardPage() {
  const [asaas, setAsaas] = useState<AsaasData | null>(null);
  const [asaasLoading, setAsaasLoading] = useState(true);
  const [asaasError, setAsaasError] = useState<string | null>(null);
  const [site, setSite] = useState<SiteData | null>(null);
  const [siteLoading, setSiteLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [coverageFailed, setCoverageFailed] = useState(false);
  const [igProfile, setIgProfile] = useState<IgProfile | null>(null);
  const [secondaryLoading, setSecondaryLoading] = useState(true);

  const loadAsaas = (forceRefresh = false) => {
    setAsaasLoading(true);
    setAsaasError(null);
    api.get<AsaasData>(`/financial/overview${forceRefresh ? '?refresh=true' : ''}`)
      .then(({ data }) => setAsaas(data))
      .catch((error) => {
        setAsaasError(error?.response?.data?.detail || error?.message || 'Falha ao conectar ao ASAAS');
        setAsaas(null);
      })
      .finally(() => setAsaasLoading(false));
  };

  const loadAll = (forceRefresh = false) => {
    loadAsaas(forceRefresh);
    setSiteLoading(true);
    setSecondaryLoading(true);
    setCoverageFailed(false);

    api.get<SiteData>('/site/dashboard?days=30')
      .then(({ data }) => setSite(data))
      .catch(() => setSite(null))
      .finally(() => setSiteLoading(false));

    Promise.allSettled([
      api.get<Lead[] | { data?: Lead[]; leads?: Lead[] }>('/leads?soft=true'),
      api.get<Client[] | { data?: Client[] }>('/clients'),
      api.get<Post[]>('/marketing/posts'),
      api.get<IgProfile>('/marketing/meta/instagram/profile'),
      api.get<Coverage>('/marketing/schedule-coverage'),
    ])
      .then(([leadResult, clientResult, postResult, igResult, coverageResult]) => {
        // Buscado aqui e repassado ao alerta como prop: os dois precisam do mesmo
        // dado, e sem isso a mesma rota seria chamada duas vezes na mesma tela.
        setCoverage(coverageResult.status === 'fulfilled' ? coverageResult.value.data : null);
        setCoverageFailed(coverageResult.status === 'rejected');
        if (leadResult.status === 'fulfilled') setLeads(normalizeList<Lead>(leadResult.value.data));
        if (clientResult.status === 'fulfilled') setClients(normalizeList<Client>(clientResult.value.data));
        // Sem invenção de post: quando a Meta não responde ou não há publicação, o
        // cartão do calendário mostra vazio. Antes, seis posts fictícios entravam
        // aqui e apareciam no Dashboard como se fossem reais.
        setPosts(postResult.status === 'fulfilled' ? normalizeList<Post>(postResult.value.data) : []);
        if (igResult.status === 'fulfilled') setIgProfile(igResult.value.data);
      })
      .finally(() => setSecondaryLoading(false));
  };

  useEffect(() => {
    loadAll(false);
  }, []);

  const siteSummary = site?.summary;
  const visitors = siteSummary?.unique_visitors ?? siteSummary?.visitors ?? 0;
  const conversion = siteSummary?.conversion_rate ?? 0;
  const siteLeads = siteSummary?.leads ?? 0;
  const siteDaily = site?.daily?.slice(-14) ?? [];
  const clientCount = clients.length || asaas?.customers_total || 0;
  const leadPipeline = leads.reduce((sum, lead) => sum + Number(lead.value ?? lead.value_potential ?? lead.potential_value ?? 0), 0);
  const openLeads = leads.filter((lead) => !['perdido', 'fechado', 'ganho'].includes((lead.status ?? '').toLowerCase())).length;

  const postCounts = useMemo(() => ({
    total: posts.length,
    scheduled: posts.filter((post) => post.status === 'agendado').length,
    review: posts.filter((post) => post.status === 'revisao').length,
    published: posts.filter((post) => post.status === 'publicado').length,
  }), [posts]);

  const today = new Date().toISOString().slice(0, 10);
  const futurePosts = [...posts].filter((p) => p.date && p.date >= today).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const recentPosts = [...posts].filter((p) => p.date && p.date < today).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const upcomingPosts = (futurePosts.length > 0 ? futurePosts : recentPosts).slice(0, 5);
  const hasScheduled = futurePosts.length > 0;

  // Agendamento vem de /marketing/schedule-coverage, a mesma fonte do Calendário e
  // do alerta. Antes esta contagem saía de /marketing/posts, que é o feed já
  // PUBLICADO do Instagram: como post publicado tem data no passado, o filtro de
  // "próximos 7 dias" nunca achava nada e o cartão dizia "nada agendado" mesmo com
  // a semana cheia. Contar agendamento em três lugares diferentes foi o que
  // permitiu essa divergência, então aqui não há contagem própria.
  const scheduledThisWeek = coverage?.in_next_7_days ?? 0;

  // Post e story contados separados. Somados viram um numero que nao diz o que
  // vai ao ar: tres stories e nenhum post e uma semana sem feed, e a soma "3"
  // parece uma semana coberta. A fila inteira entra quando a semana esta vazia,
  // porque "nada esta semana" com oito pecas na fila nao e a mesma coisa que
  // "nada esta semana" com a fila seca.
  const feedThisWeek = coverage?.by_kind_next_7_days?.feed ?? 0;
  const storyThisWeek = coverage?.by_kind_next_7_days?.story ?? 0;
  const filaTotal = coverage?.total_upcoming ?? 0;
  const esperandoAprovacao = coverage?.awaiting_approval ?? 0;

  // Peça produzida pela esteira fica em "esperando aprovação" com data marcada,
  // e não conta como agendada, com razão: sem aprovação ela não vai ao ar. Mas
  // esse é o estado em que a esteira deixa tudo, então o cartão dizia "nada
  // agendado" logo depois de produzir três peças com data. Agora as duas
  // contagens aparecem, porque pedem ações diferentes: uma é produzir, a outra
  // é só abrir o Estúdio e aprovar.
  const aprovacaoDetalhe =
    esperandoAprovacao > 0
      ? `${fmt.format(esperandoAprovacao)} esperando sua aprovação`
      : '';

  const agendaDetalhe = (() => {
    if (coverageFailed) return 'Não foi possível consultar os próximos agendamentos';
    if (scheduledThisWeek === 0) {
      if (esperandoAprovacao > 0) {
        return `Nada agendado, mas ${aprovacaoDetalhe} no Estúdio`;
      }
      return filaTotal > 0
        ? `Nada nos próximos 7 dias, mas ${fmt.format(filaTotal)} na fila depois disso`
        : 'Sem post nem story agendado';
    }
    const partes: string[] = [];
    if (feedThisWeek > 0) partes.push(`${fmt.format(feedThisWeek)} post${feedThisWeek > 1 ? 's' : ''}`);
    if (storyThisWeek > 0) partes.push(`${fmt.format(storyThisWeek)} story${storyThisWeek > 1 ? 'ies' : ''}`);
    const quebra = partes.length ? partes.join(' e ') : `${fmt.format(scheduledThisWeek)} publicações`;
    const base = `${quebra} nos próximos 7 dias`;
    return aprovacaoDetalhe ? `${base}, mais ${aprovacaoDetalhe}` : base;
  })();
  const overdueCount = asaas?.overdue_count ?? 0;

  const priorities: { key: string; icon: ReactNode; label: string; detail: string; value: string; tone: PriorityTone; to: string }[] = [
    {
      key: 'overdue',
      icon: overdueCount > 0 ? <AlertTriangle size={16} /> : <CheckCircle size={16} />,
      label: overdueCount > 0 ? 'Cobranças vencidas' : 'Financeiro em dia',
      detail: overdueCount > 0 ? (overdueCount === 1 ? '1 cobrança em atraso' : `${fmt.format(overdueCount)} cobranças em atraso`) : 'Nenhuma cobrança vencida',
      value: overdueCount > 0 ? money(asaas?.overdue_value ?? 0) : '—',
      tone: overdueCount > 0 ? 'rose' : 'emerald',
      to: '/financeiro/receita',
    },
    {
      key: 'leads',
      icon: <Users size={16} />,
      label: openLeads > 0 ? 'Leads aguardando retorno' : 'Nenhum lead em aberto',
      detail: openLeads > 0 ? (openLeads === 1 ? '1 lead em aberto no pipeline' : `${fmt.format(openLeads)} leads em aberto no pipeline`) : 'Pipeline comercial limpo',
      value: fmt.format(openLeads),
      tone: openLeads > 0 ? 'violet' : 'emerald',
      to: '/comercial/followup',
    },
    {
      key: 'posts',
      icon: <CalendarDays size={16} />,
      label: coverageFailed
        ? 'Agenda não verificada'
        : scheduledThisWeek > 0
        ? 'Conteúdo desta semana'
        : esperandoAprovacao > 0
        ? 'Peças esperando aprovação'
        : 'Nada agendado esta semana',
      detail: agendaDetalhe,
      value: coverageFailed ? '—' : fmt.format(scheduledThisWeek + esperandoAprovacao),
      // O tom estava invertido: semana vazia aparecia em verde e semana cheia em
      // âmbar, o oposto do que o cartão "precisa de atenção" quer dizer.
      tone: !coverageFailed && scheduledThisWeek > 0 ? 'emerald' : 'amber',
      to: '/marketing/calendario',
    },
  ];

  const usuario = useAuthStore((estado) => estado.user);
  const primeiroNome = (usuario?.full_name || '').trim().split(' ')[0] || 'por aqui';
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // A frase diz o que exige acao, com o numero em destaque. Quando nao ha nada
  // pendente, ela diz isso em vez de sumir: "nada em aberto" e informacao.
  const emAberto = priorities.filter((item) => item.tone !== 'emerald').length;
  const resumo =
    emAberto > 0 ? (
      <>
        <strong style={{ color: 'var(--erp-text)' }}>
          {emAberto} {emAberto === 1 ? 'ponto pede' : 'pontos pedem'}
        </strong>{' '}
        a sua atenção hoje.
      </>
    ) : (
      'Nada em aberto hoje. O financeiro está em dia e o comercial sem pendência.'
    );

  return (
    <div className="space-y-8">
      {/* Saudacao no lugar do nome da tela, como no Nucleo. "Painel Executivo"
          com "Financeiro, comercial, site e marketing em uma leitura unica"
          embaixo gastava duas linhas para dizer onde voce ja esta; a trilha do
          cabecalho ja informa isso. O que a abertura deve dizer e o que mudou
          desde ontem e o que espera por voce. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-light tracking-tight sm:text-4xl" style={{ color: 'var(--erp-text-muted)' }}>
            {saudacao},{' '}
            <span className="font-bold" style={{ color: 'var(--erp-text)' }}>{primeiroNome}.</span>
          </h1>
          <p className="mt-1.5 text-sm capitalize" style={{ color: 'var(--erp-text-dim)' }}>{hoje}</p>
          <p className="mt-4 max-w-xl text-base leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}>
            {resumo}
          </p>
        </div>
        <button onClick={() => loadAll(true)} className="flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-2 text-xs transition-colors" style={{ borderColor: 'var(--erp-border)', color: 'var(--erp-text-muted)' }}>
          <RefreshCw size={12} className={asaasLoading || siteLoading || secondaryLoading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      <ScheduleCoverageAlert coverage={coverage} />

      {asaasError && (
        <div className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(190,18,60,0.3)', background: 'rgba(190,18,60,0.06)', color: 'var(--erp-rose)' }}>
          <AlertTriangle size={14} />
          <span><strong>ASAAS:</strong> {asaasError}</span>
        </div>
      )}

      <Card padding="sm">
        <div className="px-2 pt-1 sm:px-1">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-muted)' }}>Como está cada área</p>
        </div>
        <div className="mt-2 space-y-1">
          {(asaasLoading || secondaryLoading) ? (
            <div className="space-y-2 p-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />)}</div>
          ) : (
            priorities.map(({ key, ...item }) => <PriorityRow key={key} {...item} />)
          )}
        </div>
      </Card>

      {/* Sem cartao: no Nucleo o numero e o conteudo, apoiado so por uma linha
          fina entre as colunas. Dentro de uma caixa branca sobre fundo quase
          branco, ele vira mais um bloco de dashboard generico. */}
      <div>
        <p className="mb-4 text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>O mês em números</p>
        <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4" style={{ borderColor: 'var(--erp-border)' }}>
          <KpiCell
            label="Financeiro"
            primaryLabel="Recebido no período"
            primaryValue={asaas ? money(asaas.received_value) : '—'}
            lines={[
              { label: 'A receber', value: asaas ? money(asaas.pending_value) : '—' },
              { label: 'Em atraso', value: asaas ? money(asaas.overdue_value) : '—' },
            ]}
            to="/financeiro"
            loading={asaasLoading}
          />
          <KpiCell
            label="Comercial"
            primaryLabel="Pipeline estimado"
            primaryValue={money(leadPipeline)}
            lines={[
              { label: 'Clientes', value: fmt.format(clientCount) },
              { label: 'Leads abertos', value: fmt.format(openLeads) },
            ]}
            to="/comercial"
            loading={secondaryLoading}
          />
          <KpiCell
            label="Site"
            primaryLabel="Visitantes (14d)"
            primaryValue={fmt.format(visitors)}
            lines={[
              { label: 'Conversão', value: `${conversion.toFixed(1)}%` },
              { label: 'Leads via site', value: fmt.format(siteLeads) },
            ]}
            to="/site-metrics"
            loading={siteLoading}
          />
          <KpiCell
            label="Instagram"
            primaryLabel={igProfile?.username ? `@${igProfile.username}` : 'Marketing digital'}
            primaryValue={igProfile ? fmt.format(igProfile.followers_count ?? 0) : '—'}
            lines={[
              { label: 'Publicações', value: igProfile ? fmt.format(igProfile.media_count ?? 0) : '—' },
              { label: 'Agendados', value: fmt.format(postCounts.scheduled) },
            ]}
            to="/marketing/metricas"
            loading={secondaryLoading}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" padding="lg">
          <CardHeader title="Tráfego do site" subtitle="Visitantes dos últimos 14 dias" action={<Link to="/site-metrics" className="flex items-center gap-1 text-xs font-medium text-violet-700">Detalhar <ArrowRight size={11} /></Link>} />
          {siteLoading ? (
            <div className="flex h-[180px] items-end gap-2 px-1">
              {[40, 65, 50, 80, 55, 70, 45, 90, 60, 75, 50, 85, 65, 55].map((h, i) => (
                <div key={i} className="flex-1 animate-pulse rounded-t-md" style={{ height: `${h}%`, background: 'var(--erp-surface-2)' }} />
              ))}
            </div>
          ) : siteDaily.length ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={siteDaily} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barSize={10}>
                <Bar dataKey="visitors" fill="var(--erp-violet)" opacity={0.88} radius={[5, 5, 0, 0]} name="Visitantes" />
                <XAxis dataKey="date" tick={{ fill: 'var(--erp-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(date) => String(date).slice(8)} />
                <Tooltip content={<ChartTooltip />} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyBlock label="Integração Supabase não configurada" />}
        </Card>

        <Card padding="lg">
          <CardHeader title="Calendário de posts" subtitle={hasScheduled ? 'Próximas entregas' : 'Publicações recentes do Instagram'} action={<Link to="/marketing/calendario" className="flex items-center gap-1 text-xs font-medium text-violet-700">Ver agenda <ArrowRight size={11} /></Link>} />
          {secondaryLoading ? (
            <div className="mt-1 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-[18px]" style={{ background: 'var(--erp-surface-2)' }} />
              ))}
            </div>
          ) : upcomingPosts.length ? (
            <div className="mt-1 space-y-2">
              {upcomingPosts.map((post) => (
                <div key={post.id} className="flex items-center gap-3 rounded-[18px] border border-violet-100 bg-white px-3 py-2.5">
                  <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-full bg-violet-50 text-[10px] font-semibold text-violet-700">
                    <span>{post.date ? new Date(`${post.date}T12:00:00`).getDate().toString().padStart(2, '0') : '--'}</span>
                    <span className="text-[8px] uppercase">{post.date ? new Date(`${post.date}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }) : ''}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-950">{post.title}</p>
                    <p className="truncate text-xs text-slate-500">{post.channel} - {post.format ?? 'Post'}</p>
                  </div>
                  <Badge tone={post.status === 'agendado' ? 'violet' : post.status === 'revisao' ? 'amber' : post.status === 'publicado' ? 'emerald' : 'slate'}>
                    {STATUS_LABELS[post.status] ?? post.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : <EmptyBlock label="Sem posts no calendário" />}
        </Card>
      </div>

      <Card padding="lg">
        <CardHeader title="Últimas cobranças" subtitle="ASAAS, recebidos e pendências" action={<Link to="/financeiro/receita" className="flex items-center gap-1 text-xs font-medium text-violet-700">Ver receita <ArrowRight size={11} /></Link>} />
        {asaasLoading ? (
          <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-10 animate-pulse rounded-full bg-violet-50" />)}</div>
        ) : asaas?.payments?.length ? (
          <div className="divide-y divide-violet-50">
            {asaas.payments.slice(0, 6).map((payment) => {
              const status = paymentStatus(payment);
              return (
                <div key={payment.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-950">{payment.customer}</p>
                    <p className="truncate text-xs text-slate-500">{payment.description} - vence {payment.due_date}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <span className="text-sm font-semibold tabular-nums text-slate-950">{money(payment.value)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <EmptyBlock label="Sem cobranças disponíveis" />}
      </Card>
    </div>
  );
}
