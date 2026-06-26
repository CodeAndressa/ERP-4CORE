import { useState } from 'react';
import { BookOpen, Search, Plus, Clock } from 'lucide-react';
import { Card } from '../shared/components/ui/Card';

interface Entry {
  id: number;
  category: string;
  title: string;
  updatedAt: string;
  owner: string;
  status: 'disponivel' | 'revisao';
}

const COLLECTIONS = [
  { label: 'Processos e playbooks', count: 12 },
  { label: 'Comercial',             count: 8  },
  { label: 'Marketing',             count: 7  },
  { label: 'Financeiro',            count: 5  },
  { label: 'JurÃ­dico e regulatÃ³rio',count: 9  },
];

const SEED_ENTRIES: Entry[] = [
  { id: 1, category: 'Processos',  title: 'Onboarding de clientes',       updatedAt: '2026-06-26', owner: 'OperaÃ§Ãµes', status: 'disponivel' },
  { id: 2, category: 'Comercial',  title: 'Roteiro de diagnÃ³stico',       updatedAt: '2026-06-24', owner: 'Comercial', status: 'disponivel' },
  { id: 3, category: 'Marketing',  title: 'Guia de tom de voz',           updatedAt: '2026-06-20', owner: 'Marketing', status: 'disponivel' },
  { id: 4, category: 'JurÃ­dico',   title: 'Checklist Portaria 671',       updatedAt: '2026-06-18', owner: 'Consultoria', status: 'disponivel' },
  { id: 5, category: 'Comercial',  title: 'Roteiro de follow-up',         updatedAt: '2026-06-15', owner: 'Comercial', status: 'revisao'    },
  { id: 6, category: 'Processos',  title: 'GestÃ£o de contratos',          updatedAt: '2026-06-12', owner: 'OperaÃ§Ãµes', status: 'disponivel' },
  { id: 7, category: 'Financeiro', title: 'PolÃ­tica de precificaÃ§Ã£o',     updatedAt: '2026-06-10', owner: 'Diretoria', status: 'revisao'    },
];

export default function KnowledgePage() {
  const [search, setSearch] = useState('');
  const [activeCollection, setActiveCollection] = useState<string | null>(null);

  const filtered = SEED_ENTRIES.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.title.toLowerCase().includes(q) || e.category.toLowerCase().includes(q);
    const matchCollection = !activeCollection || e.category.toLowerCase().includes(activeCollection.toLowerCase().split(' ')[0]);
    return matchSearch && matchCollection;
  });

  function fmtDate(iso: string) {
    const d = new Date(iso + 'T12:00:00');
    const today = new Date('2026-06-26');
    const diffMs = today.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays} dias atrÃ¡s`;
    return d.toLocaleDateString('pt-BR');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Conhecimento</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Base Operacional</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Processos, playbooks e aprendizados da equipe</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)', minWidth: 200 }}>
            <Search size={13} style={{ color: 'var(--erp-text-muted)' }} />
            <input type="text" placeholder="Buscar conteÃºdoâ€¦" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none" style={{ color: 'var(--erp-text)' }} />
          </div>
          <button className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
            style={{ background: 'var(--erp-violet)', color: '#fff' }}>
            <Plus size={14} />
            Novo conteÃºdo
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Collections sidebar */}
        <Card padding="lg">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--erp-text-dim)' }}>ColeÃ§Ãµes</p>
          <div className="space-y-1">
            <button
              onClick={() => setActiveCollection(null)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 transition-all text-sm"
              style={{
                background: !activeCollection ? 'var(--erp-violet-dim)' : 'transparent',
                color: !activeCollection ? 'var(--erp-violet-light)' : 'var(--erp-text-muted)',
              }}
            >
              <span>Todas as coleÃ§Ãµes</span>
              <span className="text-xs font-bold">{SEED_ENTRIES.length}</span>
            </button>
            {COLLECTIONS.map((col) => (
              <button
                key={col.label}
                onClick={() => setActiveCollection(col.label === activeCollection ? null : col.label)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 transition-all text-sm"
                style={{
                  background: activeCollection === col.label ? 'var(--erp-violet-dim)' : 'transparent',
                  color: activeCollection === col.label ? 'var(--erp-violet-light)' : 'var(--erp-text-muted)',
                }}
              >
                <span>{col.label}</span>
                <span className="text-xs font-bold">{col.count}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* Content list */}
        <div className="lg:col-span-2 space-y-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl py-14"
              style={{ border: '1px dashed var(--erp-border)' }}>
              <BookOpen size={28} style={{ color: 'var(--erp-text-dim)' }} />
              <p className="text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhum conteÃºdo encontrado</p>
            </div>
          ) : filtered.map((entry) => (
            <div key={entry.id}
              className="flex items-start justify-between gap-4 rounded-2xl px-4 py-4 cursor-pointer transition-all"
              style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--erp-border-strong)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--erp-border)'; }}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl mt-0.5"
                  style={{ background: 'var(--erp-violet-dim)' }}>
                  <BookOpen size={14} style={{ color: 'var(--erp-violet-light)' }} />
                </div>
                <div>
                  <p className="font-medium text-sm" style={{ color: 'var(--erp-text)' }}>{entry.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] uppercase tracking-wide font-medium"
                      style={{ color: 'var(--erp-violet-light)' }}>{entry.category}</span>
                    <span className="text-[10px]" style={{ color: 'var(--erp-text-dim)' }}>Â·</span>
                    <span className="text-[10px]" style={{ color: 'var(--erp-text-dim)' }}>{entry.owner}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    background: entry.status === 'disponivel' ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.12)',
                    color: entry.status === 'disponivel' ? '#34d399' : '#fbbf24',
                  }}>
                  {entry.status === 'disponivel' ? 'DisponÃ­vel' : 'Em revisÃ£o'}
                </span>
                <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--erp-text-dim)' }}>
                  <Clock size={9} />
                  {fmtDate(entry.updatedAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
