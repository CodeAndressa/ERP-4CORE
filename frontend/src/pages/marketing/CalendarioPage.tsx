import { useState } from 'react';
import {
  Calendar, Camera, Globe, Mail, Layers, Video, Plus, X,
  CalendarDays, CheckCircle, Clock, Lightbulb, Edit3,
} from 'lucide-react';
import { Card } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';
import { Badge } from '../../shared/components/ui/Badge';

type PostStatus = 'publicado' | 'agendado' | 'revisao' | 'ideia';

interface Post {
  id: number;
  date: string;
  title: string;
  channel: string;
  status: PostStatus;
  format: string;
  responsible: string;
}

const SEED_POSTS: Post[] = [
  { id: 1, date: '2026-07-01', title: 'Checklist de conformidade trabalhista', channel: 'Instagram', status: 'publicado', format: 'Carrossel', responsible: 'Marketing' },
  { id: 2, date: '2026-07-04', title: 'Case Grupo Atlas — Redução de passivos', channel: 'LinkedIn', status: 'revisao', format: 'Artigo', responsible: 'Diretoria' },
  { id: 3, date: '2026-07-08', title: 'Guia definitivo sobre Portaria 671', channel: 'E-mail', status: 'agendado', format: 'Newsletter', responsible: 'Marketing' },
  { id: 4, date: '2026-07-10', title: 'Bastidores da 4Core — como trabalhamos', channel: 'Stories', status: 'ideia', format: 'Vídeo', responsible: 'Marketing' },
  { id: 5, date: '2026-07-15', title: 'Dicas de documentação trabalhista', channel: 'Instagram', status: 'agendado', format: 'Reels', responsible: 'Marketing' },
  { id: 6, date: '2026-07-18', title: 'Webinar: Compliance na prática', channel: 'LinkedIn', status: 'agendado', format: 'Evento', responsible: 'Diretoria' },
  { id: 7, date: '2026-07-22', title: 'Infográfico: Calendário trabalhista 2026', channel: 'Instagram', status: 'ideia', format: 'Estático', responsible: 'Marketing' },
  { id: 8, date: '2026-07-25', title: 'Resultados do primeiro semestre', channel: 'E-mail', status: 'ideia', format: 'Newsletter', responsible: 'Diretoria' },
];

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

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

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
  const [posts, setPosts] = useState<Post[]>(SEED_POSTS);
  const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: '', title: '', channel: 'Instagram', format: 'Carrossel', status: 'ideia' as PostStatus });

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
    setForm({ date: '', title: '', channel: 'Instagram', format: 'Carrossel', status: 'ideia' });
  }

  function removePost(id: number) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
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
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all"
          style={{ background: 'var(--erp-violet)', color: '#fff' }}
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancelar' : 'Nova publicação'}
        </button>
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

      {/* Posts by week */}
      {weeks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Calendar size={32} style={{ color: 'var(--erp-text-dim)' }} />
          <p className="text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhuma publicação neste filtro</p>
        </div>
      ) : (
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
