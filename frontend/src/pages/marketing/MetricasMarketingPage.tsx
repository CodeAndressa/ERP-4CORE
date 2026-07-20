import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, Users, Eye, Heart, ExternalLink, AlertCircle,
  MessageCircle, Lock, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { MetricCard } from '../../shared/components/layout/MetricCard';
import { Card, CardHeader } from '../../shared/components/ui/Card';
import { api } from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeeklyPoint { week: string; alcance: number; impressoes?: number }
interface Summary {
  followers: number;
  media_count: number;
  reach_total: number;
  impressions_total: number;
  profile_views_total: number;
  trend_pct: number;
}
interface InsightsData {
  weekly: WeeklyPoint[];
  summary: Summary;
  insights_available: boolean;
}

interface IgPost {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  thumbnail_url?: string;
  media_url?: string;
  permalink?: string;
  timestamp: string;
  like_count: number;
  comments_count: number;
}

interface FollowerGrowth {
  available: boolean;
  current_followers: number;
  daily?: { date: string; novos: number }[];
  growth_30d?: number;
}

interface MessagesData {
  available: boolean;
  reason?: string;
  total?: number;
  conversations?: { id: string; participants?: { data: { name: string }[] }; updated_time?: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs"
      style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border-strong)', color: 'var(--erp-text)' }}>
      <p className="mb-1" style={{ color: 'var(--erp-text-muted)' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {Number(p.value).toLocaleString('pt-BR')}
        </p>
      ))}
    </div>
  );
};

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl ${className ?? ''}`}
      style={{ background: 'var(--erp-surface-2)' }} />
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MetricasMarketingPage() {
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [posts, setPosts] = useState<IgPost[]>([]);
  const [followerGrowth, setFollowerGrowth] = useState<FollowerGrowth | null>(null);
  const [messages, setMessages] = useState<MessagesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<InsightsData>('/marketing/meta/instagram/insights'),
      api.get<{ posts: IgPost[] }>('/marketing/meta/instagram/posts'),
      api.get<FollowerGrowth>('/marketing/meta/instagram/follower-growth').catch(() => null),
      api.get<MessagesData>('/marketing/meta/instagram/messages').catch(() => null),
    ])
      .then(([insRes, postsRes, growthRes, msgRes]) => {
        setInsights(insRes.data);
        setPosts(postsRes.data.posts ?? []);
        if (growthRes) setFollowerGrowth(growthRes.data);
        if (msgRes) setMessages(msgRes.data);
      })
      .catch((err) => {
        const detail = err?.response?.data?.detail ?? '';
        setError(detail || 'Não foi possível carregar dados do Instagram. Verifique a conexão em Marketing → Conexões.');
      })
      .finally(() => setLoading(false));
  }, []);

  const summary = insights?.summary;
  const weekly = insights?.weekly ?? [];
  const insightsAvailable = insights?.insights_available ?? false;

  const totalLikes = posts.reduce((s, p) => s + p.like_count, 0);
  const totalComments = posts.reduce((s, p) => s + p.comments_count, 0);
  const totalEngagement = totalLikes + totalComments;

  const topPosts = [...posts]
    .sort((a, b) => (b.like_count + b.comments_count) - (a.like_count + a.comments_count))
    .slice(0, 5)
    .map((p) => ({
      label: p.caption?.replace(/\n/g, ' ').slice(0, 28) ?? p.timestamp.slice(0, 10),
      engajamento: p.like_count + p.comments_count,
      permalink: p.permalink,
    }));

  const growth30d = followerGrowth?.growth_30d ?? 0;
  const growthPositive = growth30d >= 0;

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Marketing</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Métricas de Marketing</h1>
        </div>
        <Card padding="lg">
          <div className="flex items-start gap-3 text-sm">
            <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--erp-amber)' }} />
            <div>
              <p style={{ color: 'var(--erp-text)' }}>{error}</p>
              <a href="/marketing/conexoes" className="mt-1 inline-block text-xs font-semibold"
                style={{ color: 'var(--erp-violet-light)' }}>
                Ir para Conexões →
              </a>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Marketing</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Métricas de Marketing</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Dados dos últimos 30 dias · Instagram @4coreconsultoria</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ background: 'var(--erp-violet)' }}>
          Instagram
        </span>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Seguidores"
            value={fmtNum(summary?.followers ?? followerGrowth?.current_followers ?? 0)}
            detail={followerGrowth?.available && growth30d > 0
              ? `+${growth30d} novos em 30 dias`
              : 'total atual de seguidores'}
            tone="violet"
            icon={<Users size={16} />}
            trend={followerGrowth?.available && growth30d > 0 ? growth30d : undefined}
          />
          <MetricCard
            label="Alcance"
            value={insightsAvailable ? fmtNum(summary?.reach_total ?? 0) : '—'}
            detail={insightsAvailable
              ? `${(summary?.trend_pct ?? 0) > 0 ? '+' : ''}${summary?.trend_pct ?? 0}% vs. 2 sem. ant.`
              : 'requer instagram_manage_insights'}
            tone="emerald"
            icon={<TrendingUp size={16} />}
            trend={insightsAvailable ? summary?.trend_pct : undefined}
            sparkline={insightsAvailable ? weekly.map((w) => w.alcance) : undefined}
          />
          <MetricCard
            label="Comentários"
            value={fmtNum(totalComments)}
            detail="últimas 30 publicações"
            tone="amber"
            icon={<Eye size={16} />}
          />
          <MetricCard
            label="Engajamento"
            value={fmtNum(totalEngagement)}
            detail={`${posts.length} publicações`}
            tone="cyan"
            icon={<Heart size={16} />}
          />
        </div>
      )}

      {loading && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="lg:col-span-2 h-64" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-56" />
          <Skeleton className="h-40" />
        </>
      )}

      {/* Aviso instagram_manage_insights */}
      {!loading && !insightsAvailable && (
        <div className="rounded-xl px-4 py-4 text-sm"
          style={{ background: 'rgba(180,83,9,0.08)', border: '1px solid rgba(180,83,9,0.25)' }}>
          <div className="flex items-start gap-3">
            <AlertCircle size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--erp-amber)' }} />
            <div className="space-y-1">
              <p className="font-semibold" style={{ color: 'var(--erp-text)' }}>
                Alcance não disponível — permissão <code className="text-xs">instagram_manage_insights</code> não concedida
              </p>
              <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                Vá em <a href="/marketing/conexoes" className="underline font-semibold" style={{ color: 'var(--erp-violet-light)' }}>Marketing → Conexões</a>,
                reconecte via Meta e mantenha todas as permissões marcadas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Crescimento de seguidores */}
      {!loading && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2" padding="lg">
            <CardHeader
              title="Crescimento de Seguidores"
              subtitle={followerGrowth?.available
                ? 'Novos seguidores por dia nos últimos 30 dias'
                : 'Histórico disponível após liberar instagram_manage_insights'}
            />
            {!followerGrowth?.available ? (
              <div className="flex flex-col items-center gap-3 py-12 mt-2">
                <Lock size={24} style={{ color: 'var(--erp-text-dim)' }} />
                <p className="text-sm text-center" style={{ color: 'var(--erp-text-muted)' }}>
                  Gráfico de crescimento diário requer a permissão <strong>instagram_manage_insights</strong>
                </p>
                <div className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{ background: 'var(--erp-violet-dim)', color: 'var(--erp-violet-light)' }}>
                  {growthPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {followerGrowth?.current_followers ?? summary?.followers ?? 0} seguidores atualmente
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 mt-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full" style={{ background: 'var(--erp-violet)' }} />
                    <span className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>Seguidores</span>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 text-sm font-semibold"
                    style={{ color: growthPositive ? 'var(--erp-emerald)' : 'var(--erp-rose)' }}>
                    {growthPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {growthPositive ? '+' : ''}{growth30d} nos últimos 30 dias
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={followerGrowth.daily} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--erp-border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: 'var(--erp-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={(d) => d.slice(8)} />
                    <YAxis tick={{ fill: 'var(--erp-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={45}
                      domain={['auto', 'auto']} tickFormatter={fmtNum} />
                    <Tooltip content={<Tip />} />
                    <Line name="Novos seguidores" type="monotone" dataKey="novos" stroke="var(--erp-violet)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </Card>

          {/* Top posts */}
          <Card padding="lg">
            <CardHeader title="Top Posts" subtitle="Mais engajados (curtidas + comentários)" />
            {posts.length === 0 ? (
              <p className="text-sm mt-4" style={{ color: 'var(--erp-text-muted)' }}>Nenhum post encontrado.</p>
            ) : (
              <div className="space-y-2 mt-2">
                {topPosts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium tabular-nums" style={{ color: 'var(--erp-violet)', minWidth: 16 }}>{i + 1}</span>
                      <span className="truncate" style={{ color: 'var(--erp-text)' }}>{p.label}</span>
                      {p.permalink && (
                        <a href={p.permalink} target="_blank" rel="noreferrer">
                          <ExternalLink size={10} style={{ color: 'var(--erp-text-muted)' }} />
                        </a>
                      )}
                    </div>
                    <span className="font-semibold tabular-nums shrink-0" style={{ color: 'var(--erp-text-muted)' }}>
                      {p.engajamento}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Gráfico semanal */}
      {!loading && (
        <Card padding="lg">
          <CardHeader
            title={insightsAvailable ? 'Alcance Semanal' : 'Engajamento por Post'}
            subtitle={insightsAvailable ? 'Alcance por semana (últimos 30 dias)' : 'Curtidas + comentários nas últimas publicações'}
          />
          {insightsAvailable ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={weekly} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gAlcance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--erp-violet)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--erp-violet)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--erp-border)" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: 'var(--erp-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--erp-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={40}
                  tickFormatter={(v) => fmtNum(v)} />
                <Tooltip content={<Tip />} />
                <Area name="Alcance" type="monotone" dataKey="alcance" stroke="var(--erp-violet)" strokeWidth={2} fill="url(#gAlcance)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={[...posts].slice(0, 10).map((p) => ({
                  label: p.caption?.slice(0, 20).replace(/\n/g, ' ') ?? p.timestamp.slice(5, 10),
                  engajamento: p.like_count + p.comments_count,
                }))}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--erp-border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--erp-text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--erp-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip content={<Tip />} />
                <Bar name="Engajamento" dataKey="engajamento" fill="var(--erp-violet)" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      )}

      {/* DMs */}
      {!loading && (
        <Card padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle size={15} style={{ color: 'var(--erp-violet-light)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Mensagens Diretas (DMs)</p>
          </div>
          {!messages?.available ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3 rounded-xl px-4 py-3"
                style={{ background: 'var(--erp-violet-dim)', border: '1px solid var(--erp-border)' }}>
                <Lock size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--erp-violet-light)' }} />
                <div className="space-y-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--erp-text)' }}>
                    Acesso às DMs requer aprovação da Meta
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}>
                    A permissão <code>instagram_manage_messages</code> é restrita e precisa passar pelo processo de
                    revisão do aplicativo na Meta. Para solicitar:
                  </p>
                  <ol className="text-xs list-decimal list-inside space-y-1 mt-1" style={{ color: 'var(--erp-text-muted)' }}>
                    <li>Acesse <a href="https://developers.facebook.com/apps/1649220676379325/review-center/" target="_blank" rel="noreferrer"
                        className="underline" style={{ color: 'var(--erp-violet-light)' }}>
                        Meta for Developers → Central de Revisão do App
                      </a></li>
                    <li>Solicite a permissão <strong style={{ color: 'var(--erp-text)' }}>instagram_manage_messages</strong></li>
                    <li>Preencha o questionário e envie para aprovação (processo leva 5–10 dias úteis)</li>
                    <li>Após aprovação, reconecte o Instagram em Conexões</li>
                  </ol>
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--erp-text-dim)' }}>
                Enquanto a permissão não é aprovada, gerencie suas DMs diretamente no app do Instagram.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm mb-3" style={{ color: 'var(--erp-text-muted)' }}>
                {messages.total} conversas ativas
              </p>
              <div className="space-y-2">
                {(messages.conversations ?? []).slice(0, 5).map((conv) => {
                  const name = conv.participants?.data?.find((p) => p.name)?.name ?? 'Usuário';
                  return (
                    <div key={conv.id} className="flex items-center justify-between rounded-xl px-3 py-2.5"
                      style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)' }}>
                      <div className="flex items-center gap-2">
                        <MessageCircle size={13} style={{ color: 'var(--erp-violet-light)' }} />
                        <span className="text-sm" style={{ color: 'var(--erp-text)' }}>{name}</span>
                      </div>
                      {conv.updated_time && (
                        <span className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                          {new Date(conv.updated_time).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Bar chart top posts */}
      {!loading && topPosts.length > 0 && (
        <Card padding="lg">
          <CardHeader title="Top 5 Posts por Engajamento" subtitle="Curtidas + comentários · Instagram" />
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={topPosts} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--erp-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--erp-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--erp-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
              <Tooltip content={<Tip />} />
              <Bar name="Engajamento" dataKey="engajamento" radius={[4, 4, 0, 0]} maxBarSize={60} fill="var(--erp-violet)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
