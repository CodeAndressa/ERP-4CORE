import { useState, useEffect } from 'react';
import { Camera, Globe, Mail, Layers, Video, Edit3, Search } from 'lucide-react';
import { api } from '../../services/api';
import { Card, CardHeader } from '../../shared/components/ui/Card';
import { Badge } from '../../shared/components/ui/Badge';

interface Post {
  id: number | string;
  title: string;
  channel: string;
  status: string;
  format?: string;
  date?: string;
}

const MOCK_EXTRA: Post[] = [
  { id: 'm1', title: 'Checklist de conformidade trabalhista', channel: 'Instagram', status: 'publicado', format: 'Carrossel', date: '2026-07-01' },
  { id: 'm2', title: 'Case Grupo Atlas', channel: 'LinkedIn', status: 'revisao', format: 'Artigo', date: '2026-07-04' },
  { id: 'm3', title: 'Guia Portaria 671', channel: 'E-mail', status: 'agendado', format: 'Newsletter', date: '2026-07-08' },
  { id: 'm4', title: 'Bastidores da 4Core', channel: 'Stories', status: 'ideia', format: 'Vídeo', date: '2026-07-10' },
  { id: 'm5', title: 'Dicas de documentação trabalhista', channel: 'Instagram', status: 'agendado', format: 'Reels', date: '2026-07-15' },
];

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  Instagram: <Camera size={13} className="text-pink-400" />,
  LinkedIn:  <Globe  size={13} className="text-blue-400" />,
  'E-mail':  <Mail   size={13} className="text-violet-400" />,
  Stories:   <Layers size={13} className="text-amber-400" />,
  YouTube:   <Video  size={13} className="text-rose-400" />,
};

type StatusTone = 'emerald' | 'violet' | 'amber' | 'slate';
const STATUS_TONE: Record<string, StatusTone> = {
  publicado: 'emerald', agendado: 'violet', revisao: 'amber', ideia: 'slate',
};
const STATUS_LABELS: Record<string, string> = {
  publicado: 'Publicado', agendado: 'Agendado', revisao: 'Em revisão', ideia: 'Ideia',
};

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');

  useEffect(() => {
    api.get<Post[]>('/marketing/posts')
      .then(({ data }) => setPosts([...data, ...MOCK_EXTRA]))
      .catch(() => setPosts(MOCK_EXTRA))
      .finally(() => setLoading(false));
  }, []);

  const channels = ['all', ...Array.from(new Set(posts.map((p) => p.channel)))];

  const filtered = posts.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.title.toLowerCase().includes(q) || p.channel.toLowerCase().includes(q);
    const matchChannel = channelFilter === 'all' || p.channel === channelFilter;
    return matchSearch && matchChannel;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Marketing</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Posts</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)', minWidth: 200 }}>
            <Search size={13} style={{ color: 'var(--erp-text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--erp-text)' }}
            />
          </div>
        </div>
      </div>

      {/* Channel filter */}
      <div className="flex items-center gap-1 flex-wrap">
        {channels.map((c) => (
          <button
            key={c}
            onClick={() => setChannelFilter(c)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              background: channelFilter === c ? 'var(--erp-violet-dim)' : 'transparent',
              color: channelFilter === c ? 'var(--erp-violet-light)' : 'var(--erp-text-muted)',
              border: channelFilter === c ? '1px solid var(--erp-violet)44' : '1px solid transparent',
            }}
          >
            {c !== 'all' && (CHANNEL_ICONS[c] ?? <Edit3 size={11} />)}
            {c === 'all' ? 'Todos' : c}
          </button>
        ))}
      </div>

      <Card padding="sm">
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                  {['Título', 'Canal', 'Formato', 'Data', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr
                    key={String(p.id)}
                    style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--erp-border)' : undefined }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--erp-surface-2)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <td className="px-4 py-3 font-medium max-w-[260px] truncate" style={{ color: 'var(--erp-text)' }}>{p.title}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {CHANNEL_ICONS[p.channel] ?? <Edit3 size={13} style={{ color: 'var(--erp-text-muted)' }} />}
                        <span style={{ color: 'var(--erp-text-muted)' }}>{p.channel}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{p.format ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                      {p.date ? new Date(p.date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[p.status] ?? 'slate'} dot>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="py-10 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhum post encontrado</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
