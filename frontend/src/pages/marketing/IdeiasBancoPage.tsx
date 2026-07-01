import { useState } from 'react';
import { Lightbulb, Plus, ArrowRight, Tag, Camera, Globe, Mail, Layers, Sparkles, Loader2 } from 'lucide-react';
import { Card } from '../../shared/components/ui/Card';
import { api } from '../../services/api';

type IdeiaStatus = 'nova' | 'desenvolvendo' | 'pronta';

interface Ideia {
  id: number;
  title: string;
  angle: string;
  format: string;
  channel: string;
  tags: string[];
  status: IdeiaStatus;
}

const COLUMN_CONFIG: { id: IdeiaStatus; label: string; description: string; color: string }[] = [
  { id: 'nova',         label: 'Novas Ideias',          description: 'Ideias brutas para avaliar', color: 'var(--erp-text-dim)' },
  { id: 'desenvolvendo',label: 'Desenvolvendo',          description: 'Em criação ou refinamento',  color: '#fbbf24' },
  { id: 'pronta',       label: 'Pronta para Executar',  description: 'Aprovadas e prontas',         color: '#34d399' },
];

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  Instagram: <Camera size={11} className="text-pink-400" />,
  LinkedIn:  <Globe  size={11} className="text-blue-400" />,
  'E-mail':  <Mail   size={11} className="text-violet-400" />,
  Stories:   <Layers size={11} className="text-amber-400" />,
};

const NEXT_STATUS: Record<IdeiaStatus, IdeiaStatus | null> = {
  nova: 'desenvolvendo',
  desenvolvendo: 'pronta',
  pronta: null,
};

export default function IdeiasBancoPage() {
  const [ideias, setIdeias] = useState<Ideia[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [form, setForm] = useState({ title: '', angle: '', format: 'Artigo', channel: 'LinkedIn', tags: '' });

  function advance(id: number) {
    setIdeias((prev) => prev.map((idea) => {
      if (idea.id !== id) return idea;
      const next = NEXT_STATUS[idea.status];
      return next ? { ...idea, status: next } : idea;
    }));
  }

  function addIdeia() {
    if (!form.title) return;
    setIdeias((prev) => [
      ...prev,
      {
        id: Date.now(),
        title: form.title,
        angle: form.angle,
        format: form.format,
        channel: form.channel,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        status: 'nova' as IdeiaStatus,
      },
    ]);
    setShowForm(false);
    setForm({ title: '', angle: '', format: 'Artigo', channel: 'LinkedIn', tags: '' });
  }

  async function generateWithAI() {
    setGeneratingAI(true);
    try {
      const { data } = await api.post<{ ideas: { title: string; angle: string; format: string; channel: string; tags: string[] }[] }>(
        '/marketing/meta/ai/ideas',
      );
      const ideas = data?.ideas ?? [];
      const newIdeias: Ideia[] = ideas.map((idea, i) => ({
        id: Date.now() + i,
        title: idea.title,
        angle: idea.angle,
        format: idea.format,
        channel: idea.channel,
        tags: idea.tags ?? [],
        status: 'nova' as IdeiaStatus,
      }));
      setIdeias((prev) => [...prev, ...newIdeias]);
    } catch (err) {
      console.error('AI ideas error', err);
    } finally {
      setGeneratingAI(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Marketing</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Banco de Ideias</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generateWithAI}
            disabled={generatingAI}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all disabled:opacity-60"
            style={{ background: 'var(--erp-surface-2)', color: 'var(--erp-violet-light)', border: '1px solid var(--erp-violet)44' }}
          >
            {generatingAI ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generatingAI ? 'Gerando...' : 'Gerar com IA'}
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
            style={{ background: 'var(--erp-violet)', color: '#fff' }}
          >
            <Plus size={14} />
            Nova ideia
          </button>
        </div>
      </div>

      {ideias.length === 0 && !showForm && (
        <div
          className="flex flex-col items-center gap-4 rounded-2xl py-12"
          style={{ border: '1px dashed var(--erp-border)', background: 'var(--erp-surface)' }}
        >
          <Sparkles size={28} style={{ color: 'var(--erp-violet-light)' }} />
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--erp-text)' }}>Banco de ideias vazio</p>
            <p className="text-xs mt-1" style={{ color: 'var(--erp-text-muted)' }}>
              Clique em <strong>Gerar com IA</strong> para criar ideias baseadas nos seus posts do Instagram,
              ou adicione uma manualmente.
            </p>
          </div>
        </div>
      )}

      {showForm && (
        <Card padding="lg">
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--erp-text)' }}>Nova ideia</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Título da ideia"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="rounded-xl px-3 py-2 text-sm outline-none sm:col-span-2"
              style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}
            />
            <input
              placeholder="Ângulo / abordagem"
              value={form.angle}
              onChange={(e) => setForm((f) => ({ ...f, angle: e.target.value }))}
              className="rounded-xl px-3 py-2 text-sm outline-none sm:col-span-2"
              style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}
            />
            <select
              value={form.channel}
              onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
              className="rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}
            >
              {['Instagram', 'LinkedIn', 'E-mail', 'Stories', 'Site'].map((c) => <option key={c}>{c}</option>)}
            </select>
            <input
              placeholder="Tags (vírgula para separar)"
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              className="rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}
            />
            <button
              onClick={addIdeia}
              className="sm:col-span-2 rounded-xl py-2 text-sm font-medium"
              style={{ background: 'var(--erp-violet)', color: '#fff' }}
            >
              Adicionar ao banco
            </button>
          </div>
        </Card>
      )}

      {ideias.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMN_CONFIG.map((col) => {
            const colIdeias = ideias.filter((i) => i.status === col.id);
            return (
              <div key={col.id} className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>{col.label}</p>
                    <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>{col.description}</p>
                  </div>
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                    style={{ background: 'var(--erp-surface-2)', color: col.color }}
                  >
                    {colIdeias.length}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {colIdeias.length === 0 ? (
                    <div
                      className="flex flex-col items-center gap-2 rounded-2xl py-8"
                      style={{ border: '1px dashed var(--erp-border)' }}
                    >
                      <Lightbulb size={20} style={{ color: 'var(--erp-text-dim)' }} />
                      <p className="text-xs" style={{ color: 'var(--erp-text-dim)' }}>Nenhuma ideia aqui</p>
                    </div>
                  ) : (
                    colIdeias.map((idea) => (
                      <div
                        key={idea.id}
                        className="rounded-2xl p-4"
                        style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-medium leading-snug" style={{ color: 'var(--erp-text)' }}>{idea.title}</p>
                          <div className="flex items-center gap-1 flex-shrink-0"
                            style={{ background: 'var(--erp-surface-2)', borderRadius: 6, padding: '2px 6px' }}>
                            {CHANNEL_ICONS[idea.channel]}
                            <span className="text-[10px]" style={{ color: 'var(--erp-text-muted)' }}>{idea.channel}</span>
                          </div>
                        </div>
                        {idea.angle && (
                          <p className="text-xs mb-2 leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}>{idea.angle}</p>
                        )}
                        <div className="flex items-center justify-between gap-2 mt-3">
                          <div className="flex flex-wrap gap-1">
                            {idea.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px]"
                                style={{ background: 'var(--erp-violet-dim)', color: 'var(--erp-violet-light)' }}>
                                <Tag size={8} />
                                {tag}
                              </span>
                            ))}
                          </div>
                          {NEXT_STATUS[idea.status] && (
                            <button
                              onClick={() => advance(idea.id as number)}
                              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all hover:opacity-80"
                              style={{ background: 'var(--erp-surface-2)', color: 'var(--erp-text-muted)', border: '1px solid var(--erp-border)' }}
                            >
                              Avançar <ArrowRight size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
