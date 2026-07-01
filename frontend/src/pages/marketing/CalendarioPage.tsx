import { useState, useEffect } from 'react';
import {
  Calendar, Camera, Globe, Mail, Layers, Video, Plus, X,
  CalendarDays, CheckCircle, Clock, Lightbulb, Edit3, RefreshCw,
} from 'lucide-react';
import { Card } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';
import { Badge } from '../../shared/components/ui/Badge';
import { api } from '../../services/api';

type PostStatus = 'publicado' | 'agendado' | 'revisao' | 'ideia';

interface Post {
  id: number | string;
  date: string;
  title: string;
  channel: string;
  status: PostStatus;
  format: string;
  responsible: string;
}

interface ApiPost { id: string | number; title: string; channel: string; status: string; format?: string; date?: string }

const STATUS_TONE: Record<PostStatus, 'emerald' | 'violet' | 'amber' | 'slate'> = {
  publicado: 'emerald',
  agendado:  'violet',
  revisao:   'amber',
  ideia:     'slate',
};

const STATUS_LABELS: Record<PostStatus, string> = {
  publicado: 'Publicado',
  agendado:  'Agendado',
  revisao:   'Em revisão',
  ideia:     'Ideia',
};

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  Instagram: <Camera  size={13} className="text-pink-400"   />,
  LinkedIn:  <Globe   size={13} className="text-blue-400"   />,
  'E-mail':  <Mail    size={13} className="text-violet-400" />,
  Stories:   <Layers  size={13} className="text-amber-400"  />,
  YouTube:   <Video   size={13} className="text-rose-400"   />,
};

const CHANNELS = ['Instagram', 'LinkedIn', 'E-mail', 'Stories', 'YouTube'];
const FORMATS  = ['Carrossel', 'Reels', 'Artigo', 'Newsletter', 'Evento', 'Estático', 'Vídeo'];

function weekLabel(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  const monday = new Date(d);
  monday.setDate(d.getDate() - d.getDay() + 1);
  return `Semana de ${monday.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
}

function groupByWeek(posts: Post[]) {
  const groups: Record<string, Post[]> = {};
  for (const p of [...posts].sort((a, b) => a.date.localeCompare(b.date))) {
    const key = weekLabel(p.date);
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }
  return Object.entries(groups);
}

export default function CalendarioPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: '', title: '', channel: 'Instagram', format: 'Carrossel', status: 'ideia' as PostStatus });

  useEffect(() => {
    setLoading(true);
    api.get<ApiPost[]>('/marketing/posts')
      .then(({ data }) => {
        const normalized = Array.isArray(data) ? data : [];
        setPosts(normalized.map((p) => ({
          id: p.id,
          date: p.date ?? '',
          title: p.title,
          channel: p.channel ?? 'Instagram',
          status: (['publicado', 'agendado', 'revisao', 'ideia'].includes(p.status) ? p.status : 'publicado') as PostStatus,
          format: p.format ?? 'Post',
          responsible: 'Marketing',
        })));
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = posts.filter((p) => statusFilter === 'all' || p.status === statusFilter);
  const weeks = groupByWeek(filtered);

  const counts = {
    publicado: posts.filter((p) => p.status === 'publicado').length,
    agendado:  posts.filter((p) => p.status === 'agendado').length,
    revisao:   posts.filter((p) => p.status === 'revisao').length,
    ideia:     posts.filter((p) => p.status === 'ideia').length,
  };

  function addPost() {
    if (!form.date || !form.title) return;
    setPosts((prev) => [
      ...prev,
      { ...form, id: Date.now(), responsible: 'Marketing' },
    ]);
    setShowForm(false);
    setForm({ date: '', title: '', channel: 'Instagram', format: 'Carrossel', status: statusFilter !== 'all' ? statusFilter as PostStatus : 'agendado' });
  }

  function removePost(id: number | string) {
    setPosts((prev) => prev.filter((p) => String(p.id) !== String(id)));
  }

  function openForm() {
    setForm((f) => ({
      ...f,
      status: statusFilter !== 'all' ? statusFilter as PostStatus : 'agendado',
    }));
    setShowForm(true);
  }

  const STATUS_FILTER_TABS: { id: PostStatus | 'all'; label: string }[] = [
    { id: 'all',      label: 'Todos' },
    { id: 'publicado',label: 'Publicados' },
    { id: 'agendado', label: 'Agendados' },
    { id: 'revisao',  label: 'Em revisão' },
    { id: 'ideia',    label: 'Ideias' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Marketing</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Calendário Editorial</h1>
        </div>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--erp-text-muted)' }} />}
          <button
            onClick={() => showForm ? setShowForm(false) : openForm()}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all"
            style={{ background: 'var(--erp-violet)', color: '#fff' }}
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Cancelar' : 'Nova publicação'}
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Publicados"  value={String(counts.publicado)} detail="este mês" tone="emerald" icon={<CheckCircle size={16} />} />
        <MetricCard label="Agendados"   value={String(counts.agendado)}  detail="a publicar" tone="violet" icon={<CalendarDays size={16} />} />
        <MetricCard label="Em revisão"  value={String(counts.revisao)}   detail="pendentes" tone="amber"  icon={<Clock size={16} />} />
        <MetricCard label="Ideias"      value={String(counts.ideia)}     detail="no banco" tone="cyan"   icon={<Lightbulb size={16} />} />
      </div>

      {/* New post form */}
      {showForm && (
        <Card padding="lg">
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--erp-text)' }}>Nova publicação</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>Data</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-1 lg:col-span-2">
              <label className="text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>Título</label>
              <input
                type="text"
                placeholder="Título da publicação"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>Canal</label>
              <select
                value={form.channel}
                onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                className="rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}
              >
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>Formato</label>
              <select
                value={form.format}
                onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))}
                className="rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}
              >
                {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as PostStatus }))}
                className="rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}
              >
                {(Object.keys(STATUS_LABELS) as PostStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={addPost}
                className="w-full rounded-xl py-2 text-sm font-medium transition-all"
                style={{ background: 'var(--erp-violet)', color: '#fff' }}
              >
                Adicionar
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Aviso sobre posts da API */}
      {!loading && posts.length > 0 && counts.agendado === 0 && statusFilter === 'all' && (
        <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs"
          style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)' }}>
          <Camera size={13} className="mt-0.5 shrink-0 text-pink-400" />
          <span style={{ color: 'var(--erp-text-muted)' }}>
            {posts.length} posts reais do Instagram carregados (todos publicados). O Instagram não expõe posts agendados via API.
            Para registrar um agendamento futuro, use <strong style={{ color: 'var(--erp-text)' }}>Nova publicação</strong>.
          </span>
        </div>
      )}

      {/* Status filter */}
      <div className="flex items-center gap-1 flex-wrap">
        {STATUS_FILTER_TABS.map((tab) => {
          const active = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: active ? 'var(--erp-violet-dim)' : 'transparent',
                color: active ? 'var(--erp-violet-light)' : 'var(--erp-text-muted)',
                border: active ? '1px solid var(--erp-violet)44' : '1px solid transparent',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Empty state contextual */}
      {!loading && weeks.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-2xl py-14"
          style={{ border: '1px dashed var(--erp-border)', background: 'var(--erp-surface)' }}>
          <Calendar size={28} style={{ color: 'var(--erp-text-dim)' }} />
          {statusFilter === 'agendado' ? (
            <div className="text-center space-y-2 max-w-sm px-4">
              <p className="text-sm font-medium" style={{ color: 'var(--erp-text)' }}>
                Nenhum post agendado
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}>
                O Instagram não expõe posts agendados via API. Para registrar um agendamento futuro, clique em{' '}
                <strong>"Nova publicação"</strong> e defina uma data futura com status <strong>Agendado</strong>.
              </p>
              <button
                onClick={openForm}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium"
                style={{ background: 'var(--erp-violet)', color: '#fff' }}
              >
                <Plus size={12} /> Adicionar agendamento
              </button>
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--erp-text-muted)' }}>
              Nenhuma publicação neste filtro
            </p>
          )}
        </div>
      )}

      {/* Posts by week */}
      {weeks.length > 0 && (
        <div className="space-y-6">
          {weeks.map(([weekLabel, weekPosts]) => (
            <div key={weekLabel}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--erp-text-dim)' }}>
                {weekLabel}
              </p>
              <div className="space-y-2">
                {weekPosts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center gap-4 rounded-xl px-4 py-3 transition-all"
                    style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}
                  >
                    {/* Date */}
                    <div className="flex h-10 w-10 flex-shrink-0 flex-col items-center justify-center rounded-lg"
                      style={{ background: 'var(--erp-surface-2)' }}>
                      <span className="text-xs font-bold leading-tight" style={{ color: 'var(--erp-text)' }}>
                        {new Date(post.date + 'T12:00:00').getDate().toString().padStart(2, '0')}
                      </span>
                      <span className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--erp-text-dim)' }}>
                        {new Date(post.date + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
                      </span>
                    </div>

                    {/* Channel icon */}
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                      style={{ background: 'var(--erp-surface-2)' }}>
                      {CHANNEL_ICONS[post.channel] ?? <Edit3 size={13} style={{ color: 'var(--erp-text-muted)' }} />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--erp-text)' }}>{post.title}</p>
                      <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                        {post.channel} · {post.format} · {post.responsible}
                      </p>
                    </div>

                    {/* Status */}
                    <Badge tone={STATUS_TONE[post.status]} dot>
                      {STATUS_LABELS[post.status]}
                    </Badge>

                    {/* Remove */}
                    <button
                      onClick={() => removePost(post.id)}
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg opacity-30 transition-opacity hover:opacity-70"
                      style={{ color: 'var(--erp-text-muted)' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
