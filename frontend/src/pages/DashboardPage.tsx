import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle,
  Clock,
  DollarSign,
  Eye,
  MousePointerClick,
  RefreshCw,
  TrendingUp,
  Users,
  Camera,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { MetricCard } from '../shared/components/layout/MetricCard';
import { Card, CardHeader } from '../shared/components/ui/Card';
import { Badge } from '../shared/components/ui/Badge';

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

const FALLBACK_POSTS: Post[] = [
  { id: 'm1', title: 'Checklist de conformidade trabalhista', channel: 'Instagram', status: 'publicado', format: 'Carrossel', date: '2026-07-01' },
  { id: 'm2', title: 'Case Grupo Atlas', channel: 'LinkedIn', status: 'revisao', format: 'Artigo', date: '2026-07-04' },
  { id: 'm3', title: 'Guia Portaria 671', channel: 'E-mail', status: 'agendado', format: 'Newsletter', date: '2026-07-08' },
  { id: 'm4', title: 'Bastidores da 4Core', channel: 'Stories', status: 'ideia', format: 'Vídeo', date: '2026-07-10' },
  { id: 'm5', title: 'Dicas de documentação trabalhista', channel: 'Instagram', status: 'agendado', format: 'Reels', date: '2026-07-15' },
  { id: 'm6', title: 'Webinar: Compliance na prática', channel: 'LinkedIn', status: 'agendado', format: 'Evento', date: '2026-07-18' },
];

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

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-full border border-violet-100 bg-white px-3 py-2">
      <span className="truncate text-xs text-slate-600">{label}</span>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-950">{value}</span>
    </div>
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

    api.get<SiteData>('/site/dashboard?days=30')
      .then(({ data }) => setSite(data))
      .catch(() => setSite(null))
      .finally(() => setSiteLoading(false));

    Promise.allSettled([
      api.get<Lead[] | { data?: Lead[]; leads?: Lead[] }>('/leads'),
      api.get<Client[] | { data?: Client[] }>('/clients'),
      api.get<Post[]>('/marketing/posts'),
      api.get<IgProfile>('/marketing/meta/instagram/profile'),
    ])
      .then(([leadResult, clientResult, postResult, igResult]) => {
        if (leadResult.status === 'fulfilled') setLeads(normalizeList<Lead>(leadResult.value.data));
        if (clientResult.status === 'fulfilled') setClients(normalizeList<Client>(clientResult.value.data));
        if (postResult.status === 'fulfilled') {
          const apiPosts = normalizeList<Post>(postResult.value.data);
          setPosts(apiPosts.length > 1 ? apiPosts : [...apiPosts, ...FALLBACK_POSTS]);
        } else {
          setPosts(FALLBACK_POSTS);
        }
        if (igResult.status === 'fulfilled') setIgProfile(igResult.value.data);
      })
      .finally(() => setSecondaryLoading(false));
  };

  useEffect(() => {
    loadAll(false);
  }, []);

  const siteSummary = site?.summary;
  const visitors = siteSummary?.unique_visitors ?? siteSummary?.visitors ?? 0;
  const pageviews = siteSummary?.pageviews ?? 0;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-violet-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="h-10 w-1 rounded-full bg-violet-600" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-slate-950">Painel Executivo</h1>
            <p className="mt-0.5 text-sm text-slate-500">Financeiro, comercial, site e marketing em uma leitura única.</p>
          </div>
        </div>
        <button onClick={() => loadAll(true)} className="flex items-center gap-1.5 rounded-full border border-violet-100 bg-white px-3 py-2 text-xs text-slate-600 transition hover:border-violet-200 hover:text-violet-700">
          <RefreshCw size={12} className={asaasLoading || siteLoading || secondaryLoading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {asaasError && (
        <div className="flex items-center gap-3 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle size={14} />
          <span><strong>ASAAS:</strong> {asaasError}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Recebido" value={asaasLoading ? '...' : asaas ? money(asaas.received_value) : '-'} detail={asaas ? `${asaas.received_count} cobranças pagas` : 'Sem dados ASAAS'} tone="emerald" icon={<CheckCircle size={16} />} />
        <MetricCard label="A receber" value={asaasLoading ? '...' : asaas ? money(asaas.pending_value) : '-'} detail={asaas ? `${asaas.pending_count} cobranças pendentes` : 'Sem dados ASAAS'} tone="violet" icon={<DollarSign size={16} />} />
        <MetricCard label="Em atraso" value={asaasLoading ? '...' : asaas ? money(asaas.overdue_value) : '-'} detail={asaas ? `${asaas.overdue_count} cobranças vencidas` : 'Sem dados ASAAS'} tone="rose" icon={<AlertTriangle size={16} />} />
        <MetricCard label="Clientes" value={asaasLoading && secondaryLoading ? '...' : fmt.format(clientCount)} detail="ASAAS e base comercial" tone="cyan" icon={<Users size={16} />} />
        <MetricCard label="Recorrente MRR" value={asaasLoading ? '...' : asaas?.recurring_value ? money(asaas.recurring_value) : '-'} detail={asaas?.recurring_count ? `${asaas.recurring_count} assinaturas ativas` : 'Sem recorrências ativas'} tone="violet" icon={<RefreshCw size={16} />} />
        <MetricCard label="Leads" value={secondaryLoading ? '...' : fmt.format(leads.length)} detail={`${openLeads} em aberto`} tone="emerald" icon={<TrendingUp size={16} />} />
        <MetricCard label="Tráfego do site" value={siteLoading ? '...' : fmt.format(visitors)} detail={`${fmt.format(pageviews)} pageviews`} tone="amber" icon={<Eye size={16} />} />
        <MetricCard label="Posts" value={secondaryLoading ? '...' : fmt.format(postCounts.total)} detail={`${postCounts.scheduled} agendados`} tone="cyan" icon={<CalendarDays size={16} />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <Card padding="lg">
          <CardHeader title="Resumo financeiro" subtitle="ASAAS em tempo real" action={<Link to="/financeiro" className="text-xs font-medium text-violet-700">Abrir</Link>} />
          <div className="mt-4 space-y-2">
            <SummaryLine label="Recebido" value={asaas ? money(asaas.received_value) : '-'} />
            <SummaryLine label="A receber" value={asaas ? money(asaas.pending_value) : '-'} />
            <SummaryLine label="Em atraso" value={asaas ? money(asaas.overdue_value) : '-'} />
            <SummaryLine label="Recorrente" value={asaas ? money(asaas.recurring_value) : '-'} />
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader title="Comercial" subtitle="Clientes, leads e pipeline" action={<Link to="/comercial" className="text-xs font-medium text-violet-700">Abrir</Link>} />
          <div className="mt-4 space-y-2">
            <SummaryLine label="Clientes" value={fmt.format(clientCount)} />
            <SummaryLine label="Leads totais" value={fmt.format(leads.length)} />
            <SummaryLine label="Leads abertos" value={fmt.format(openLeads)} />
            <SummaryLine label="Pipeline estimado" value={money(leadPipeline)} />
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader title="Site e métricas" subtitle="Visitas e conversão" action={<Link to="/site-metrics" className="text-xs font-medium text-violet-700">Abrir</Link>} />
          <div className="mt-4 space-y-2">
            <SummaryLine label="Visitantes" value={fmt.format(visitors)} />
            <SummaryLine label="Pageviews" value={fmt.format(pageviews)} />
            <SummaryLine label="Conversão" value={`${conversion.toFixed(1)}%`} />
            <SummaryLine label="Leads via site" value={fmt.format(siteLeads)} />
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader title="Instagram" subtitle={igProfile?.username ? `@${igProfile.username}` : 'Marketing digital'} action={<Link to="/marketing/metricas" className="text-xs font-medium text-violet-700">Métricas</Link>} />
          <div className="mt-4 space-y-2">
            <SummaryLine label="Seguidores" value={igProfile ? fmt.format(igProfile.followers_count ?? 0) : '—'} />
            <SummaryLine label="Publicações" value={igProfile ? fmt.format(igProfile.media_count ?? 0) : '—'} />
            <SummaryLine label="Posts (calendário)" value={fmt.format(postCounts.total)} />
            <SummaryLine label="Agendados" value={fmt.format(postCounts.scheduled)} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" padding="lg">
          <CardHeader title="Tráfego do site" subtitle="Visitantes dos últimos 14 dias" action={<Link to="/site-metrics" className="flex items-center gap-1 text-xs font-medium text-violet-700">Detalhar <ArrowRight size={11} /></Link>} />
          {siteLoading ? <EmptyBlock label="Carregando dados do site..." /> : siteDaily.length ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={siteDaily} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barSize={10}>
                <Bar dataKey="visitors" fill="#2b165c" opacity={0.88} radius={[5, 5, 0, 0]} name="Visitantes" />
                <XAxis dataKey="date" tick={{ fill: '#746d91', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(date) => String(date).slice(8)} />
                <Tooltip content={<ChartTooltip />} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyBlock label="Integração Supabase não configurada" />}
        </Card>

        <Card padding="lg">
          <CardHeader title="Calendário de posts" subtitle={hasScheduled ? 'Próximas entregas' : 'Publicações recentes do Instagram'} action={<Link to="/marketing/calendario" className="flex items-center gap-1 text-xs font-medium text-violet-700">Ver agenda <ArrowRight size={11} /></Link>} />
          {secondaryLoading ? <EmptyBlock label="Carregando posts..." /> : upcomingPosts.length ? (
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

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" padding="lg">
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

        <Card padding="lg">
          <CardHeader title="Métricas rápidas" subtitle="Sinais operacionais" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-[18px] border border-violet-100 bg-white p-3">
              <Camera size={14} className="mb-2" style={{ color: '#ee2a7b' }} />
              <p className="text-lg font-bold text-slate-950">{igProfile ? fmt.format(igProfile.followers_count ?? 0) : '—'}</p>
              <p className="text-xs text-slate-500">Seguidores IG</p>
            </div>
            <div className="rounded-[18px] border border-violet-100 bg-white p-3">
              <MousePointerClick size={14} className="mb-2 text-violet-700" />
              <p className="text-lg font-bold text-slate-950">{conversion.toFixed(1)}%</p>
              <p className="text-xs text-slate-500">Conversão site</p>
            </div>
            <div className="rounded-[18px] border border-violet-100 bg-white p-3">
              <Users size={14} className="mb-2 text-violet-700" />
              <p className="text-lg font-bold text-slate-950">{fmt.format(openLeads)}</p>
              <p className="text-xs text-slate-500">Leads abertos</p>
            </div>
            <div className="rounded-[18px] border border-violet-100 bg-white p-3">
              <DollarSign size={14} className="mb-2 text-violet-700" />
              <p className="text-lg font-bold text-slate-950">{money(leadPipeline)}</p>
              <p className="text-xs text-slate-500">Pipeline</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
