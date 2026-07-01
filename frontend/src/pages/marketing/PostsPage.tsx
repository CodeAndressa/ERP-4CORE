import { useState, useEffect } from 'react';
import { Search, ExternalLink, Image, Video, Layers, PlaySquare } from 'lucide-react';
import { api } from '../../services/api';
import { Card } from '../../shared/components/ui/Card';
import { Badge } from '../../shared/components/ui/Badge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Post {
  id: string;
  caption: string;
  media_type: string;       // IMAGE | VIDEO | CAROUSEL_ALBUM
  media_product_type?: string; // REELS | FEED
  thumbnail_url?: string;
  media_url?: string;
  permalink?: string;
  timestamp: string;
  like_count: number;
  comments_count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLabel(type: string, productType?: string): string {
  if (productType === 'REELS') return 'Reels';
  if (type === 'CAROUSEL_ALBUM') return 'Carrossel';
  if (type === 'VIDEO') return 'Vídeo';
  return 'Foto';
}

function formatIcon(type: string, productType?: string) {
  const cls = 'shrink-0';
  if (productType === 'REELS') return <PlaySquare size={13} className={cls} style={{ color: '#a78bfa' }} />;
  if (type === 'CAROUSEL_ALBUM') return <Layers size={13} className={cls} style={{ color: '#f59e0b' }} />;
  if (type === 'VIDEO') return <Video size={13} className={cls} style={{ color: '#60a5fa' }} />;
  return <Image size={13} className={cls} style={{ color: '#f472b6' }} />;
}

type StatusTone = 'emerald';
const STATUS_TONE: Record<string, StatusTone> = { publicado: 'emerald' };
const STATUS_LABELS: Record<string, string> = { publicado: 'Publicado' };

type FilterOption = 'todos' | 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REELS';

const FILTER_OPTIONS: { key: FilterOption; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'IMAGE', label: 'Fotos' },
  { key: 'CAROUSEL_ALBUM', label: 'Carrossel' },
  { key: 'VIDEO', label: 'Vídeos' },
  { key: 'REELS', label: 'Reels' },
];

function Thumbnail({ post }: { post: Post }) {
  const src = post.thumbnail_url || post.media_url;
  if (!src) {
    return (
      <div className="h-10 w-10 rounded-lg shrink-0 flex items-center justify-center"
        style={{ background: 'var(--erp-surface-2)' }}>
        {formatIcon(post.media_type, post.media_product_type)}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-10 w-10 rounded-lg object-cover shrink-0"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterOption>('todos');

  useEffect(() => {
    api.get<{ posts: Post[] }>('/marketing/meta/instagram/posts')
      .then(({ data }) => setPosts(data.posts ?? []))
      .catch((err) => setError(err?.response?.data?.detail ?? 'Erro ao carregar posts do Instagram. Verifique a conexão em Marketing → Conexões.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = posts.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.caption?.toLowerCase().includes(q);
    const matchType = typeFilter === 'todos'
      || (typeFilter === 'REELS' && p.media_product_type === 'REELS')
      || (typeFilter !== 'REELS' && p.media_type === typeFilter && p.media_product_type !== 'REELS');
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Marketing</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Posts</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--erp-text-muted)' }}>
            Publicações reais do Instagram · 4Core Consultoria
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)', minWidth: 200 }}>
          <Search size={13} style={{ color: 'var(--erp-text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar na legenda…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--erp-text)' }}
          />
        </div>
      </div>

      {/* Type filter */}
      <div className="flex items-center gap-1 flex-wrap">
        {FILTER_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTypeFilter(key)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              background: typeFilter === key ? 'var(--erp-violet-dim)' : 'transparent',
              color: typeFilter === key ? 'var(--erp-violet-light)' : 'var(--erp-text-muted)',
              border: typeFilter === key ? '1px solid var(--erp-violet)44' : '1px solid transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Platform badge */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #ee2a7b, #6228d7)' }}>
          Instagram
        </span>
        {!loading && !error && (
          <span className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>
            {posts.length} publicações encontradas
          </span>
        )}
      </div>

      {/* Table */}
      <Card padding="sm">
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />
            ))}
          </div>
        ) : error ? (
          <p className="py-10 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>{error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                  {['', 'Legenda', 'Tipo', 'Data', 'Curtidas', 'Coment.', 'Status'].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr
                    key={p.id}
                    style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--erp-border)' : undefined }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--erp-surface-2)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <td className="pl-4 py-3">
                      <Thumbnail post={p} />
                    </td>
                    <td className="px-4 py-3 font-medium max-w-[260px]" style={{ color: 'var(--erp-text)' }}>
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">
                          {p.caption ? p.caption.replace(/\n/g, ' ').slice(0, 90) : '(sem legenda)'}
                        </span>
                        {p.permalink && (
                          <a href={p.permalink} target="_blank" rel="noreferrer" className="shrink-0">
                            <ExternalLink size={11} style={{ color: 'var(--erp-text-muted)' }} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                        {formatIcon(p.media_type, p.media_product_type)}
                        {formatLabel(p.media_type, p.media_product_type)}
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                      {p.timestamp
                        ? new Date(p.timestamp).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                      {p.like_count}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                      {p.comments_count}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE['publicado']} dot>
                        {STATUS_LABELS['publicado']}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="py-10 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>
                Nenhum post encontrado
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
