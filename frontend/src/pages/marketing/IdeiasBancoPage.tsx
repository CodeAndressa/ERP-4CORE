import { useState } from 'react';
import { Lightbulb, Plus, ArrowRight, Tag, Camera, Globe, Mail, Layers } from 'lucide-react';
import { Card } from '../../shared/components/ui/Card';

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

const SEED_IDEIAS: Ideia[] = [
  { id: 1, title: 'Guia eSocial para PMEs', angle: 'Como simplificar obrigaÃ§Ãµes sem burocracia', format: 'Artigo', channel: 'LinkedIn', tags: ['eSocial', 'PME', 'compliance'], status: 'nova' },
  { id: 2, title: 'SÃ©rie: Erros comuns em folha de pagamento', angle: '5 erros que custam caro â€” com exemplos reais', format: 'Carrossel', channel: 'Instagram', tags: ['folha', 'erros', 'educacional'], status: 'nova' },
  { id: 3, title: 'Calculadora de encargos trabalhistas', angle: 'Ferramenta interativa no site', format: 'Landing page', channel: 'Site', tags: ['ferramenta', 'encargos', 'lead gen'], status: 'desenvolvendo' },
  { id: 4, title: 'Case: Como reduzimos passivos trabalhistas em 40%', angle: 'Resultado real com cliente do setor industrial', format: 'Case study', channel: 'LinkedIn', tags: ['case', 'resultado', 'industrial'], status: 'desenvolvendo' },
  { id: 5, title: 'Newsletter mensal: AtualizaÃ§Ãµes trabalhistas', angle: 'Resumo do mÃªs para gestores de RH', format: 'Newsletter', channel: 'E-mail', tags: ['newsletter', 'atualizaÃ§Ã£o', 'RH'], status: 'pronta' },
  { id: 6, title: 'Webinar: Compliance trabalhista 2026', angle: 'Ao vivo com especialistas da 4Core', format: 'Webinar', channel: 'LinkedIn', tags: ['webinar', 'ao vivo', 'especialistas'], status: 'pronta' },
];

const COLUMN_CONFIG: { id: IdeiaStatus; label: string; description: string; color: string }[] = [
  { id: 'nova',         label: 'Novas Ideias',          description: 'Ideias brutas para avaliar', color: 'var(--erp-text-dim)' },
  { id: 'desenvolvendo',label: 'Desenvolvendo',          description: 'Em criaÃ§Ã£o ou refinamento',  color: '#fbbf24' },
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
  const [ideias, setIdeias] = useState<Ideia[]>(SEED_IDEIAS);
  const [showForm, setShowForm] = useState(false);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Marketing</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Banco de Ideias</h1>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--erp-violet)', color: '#fff' }}
        >
          <Plus size={14} />
          Nova ideia
        </button>
      </div>

      {showForm && (
        <Card padding="lg">
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--erp-text)' }}>Nova ideia</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder="TÃ­tulo da ideia"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="rounded-xl px-3 py-2 text-sm outline-none sm:col-span-2"
              style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}
            />
            <input
              placeholder="Ã‚ngulo / abordagem"
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
              placeholder="Tags (vÃ­rgula para separar)"
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

      {/* Kanban columns */}
      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMN_CONFIG.map((col) => {
          const colIdeias = ideias.filter((i) => i.status === col.id);
          return (
            <div key={col.id} className="flex flex-col gap-3">
              {/* Column header */}
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

              {/* Cards */}
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
                            onClick={() => advance(idea.id)}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all hover:opacity-80"
                            style={{ background: 'var(--erp-surface-2)', color: 'var(--erp-text-muted)', border: '1px solid var(--erp-border)' }}
                          >
                            AvanÃ§ar <ArrowRight size={10} />
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
    </div>
  );
}
