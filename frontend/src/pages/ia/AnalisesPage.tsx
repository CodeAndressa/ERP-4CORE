import { useState } from 'react';
import { Brain, AlertTriangle, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';
import { Card } from '../../shared/components/ui/Card';

type Scope = 'operacao' | 'financeiro' | 'comercial' | 'marketing' | 'site' | 'clientes' | 'propostas';

const SCOPES: { id: Scope; label: string; prompt: string }[] = [
  { id: 'financeiro', label: 'Financeiro', prompt: 'FaÃ§a uma anÃ¡lise profunda do cenÃ¡rio financeiro atual, identificando riscos e oportunidades.' },
  { id: 'comercial',  label: 'Comercial',  prompt: 'Analise o pipeline comercial e identifique os principais bloqueios e oportunidades de crescimento.' },
  { id: 'marketing',  label: 'Marketing',  prompt: 'Analise a performance de marketing e sugira otimizaÃ§Ãµes para aumentar geraÃ§Ã£o de leads.' },
  { id: 'operacao',   label: 'OperaÃ§Ã£o',   prompt: 'FaÃ§a uma anÃ¡lise completa das operaÃ§Ãµes e identifique as principais ineficiÃªncias.' },
];

interface Analysis {
  headline: string;
  summary: string;
  actions?: { area: string; priority: string; title: string; rationale: string; recommended_action: string }[];
}

export default function AnalisesPage() {
  const [scope, setScope] = useState<Scope>('financeiro');
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function analyze() {
    const s = SCOPES.find((x) => x.id === scope)!;
    setLoading(true);
    setError(null);
    setData(null);
    api.post<{ analysis: Analysis }>('/ai/analyze', { scope, instructions: s.prompt })
      .then(({ data: d }) => setData(d.analysis))
      .catch((e) => setError(e?.response?.data?.detail || 'Falha ao gerar anÃ¡lise'))
      .finally(() => setLoading(false));
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>InteligÃªncia IA</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>AnÃ¡lises Profundas</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>AnÃ¡lise detalhada por Ã¡rea com identificaÃ§Ã£o de riscos e oportunidades</p>
      </div>

      <Card padding="lg">
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--erp-text)' }}>Selecione a Ã¡rea para anÃ¡lise</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              onClick={() => setScope(s.id)}
              className="rounded-xl px-4 py-2 text-sm font-medium transition-all"
              style={{
                background: scope === s.id ? 'var(--erp-violet)' : 'var(--erp-surface-2)',
                color: scope === s.id ? '#fff' : 'var(--erp-text-muted)',
                border: '1px solid var(--erp-border)',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}>
          {SCOPES.find((s) => s.id === scope)?.prompt}
        </p>
        <button
          onClick={analyze}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--erp-violet)', color: '#fff' }}
        >
          <Brain size={14} />
          {loading ? 'Analisandoâ€¦' : 'Gerar anÃ¡lise'}
        </button>
      </Card>

      {error && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl" style={{ background: 'var(--erp-surface-2)' }} />
          ))}
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">
          <Card padding="lg">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ background: 'var(--erp-violet-dim)' }}>
                <Brain size={16} style={{ color: 'var(--erp-violet-light)' }} />
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--erp-text)' }}>{data.headline}</p>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}>{data.summary}</p>
              </div>
            </div>
          </Card>
          {(data.actions ?? []).map((a, i) => (
            <div key={i} className="rounded-2xl p-4"
              style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] uppercase font-semibold" style={{ color: 'var(--erp-violet-light)' }}>{a.area}</span>
                <span className="rounded-full px-2 py-0.5 text-[9px] font-medium"
                  style={{
                    background: a.priority === 'alta' ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)',
                    color: a.priority === 'alta' ? '#f87171' : '#fbbf24',
                  }}>
                  {a.priority}
                </span>
              </div>
              <p className="font-semibold text-sm" style={{ color: 'var(--erp-text)' }}>{a.title}</p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}>{a.rationale}</p>
              <div className="flex items-center gap-1 mt-2">
                <ChevronRight size={11} style={{ color: 'var(--erp-violet-light)' }} />
                <p className="text-xs font-medium" style={{ color: 'var(--erp-violet-light)' }}>{a.recommended_action}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
