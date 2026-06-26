import { useState, useEffect } from 'react';
import { Sparkles, ChevronRight, RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import { Card } from '../../shared/components/ui/Card';

interface Action {
  area: string;
  priority: string;
  title: string;
  rationale: string;
  recommended_action: string;
}
interface Analysis {
  headline: string;
  summary: string;
  actions?: Action[];
}

const PRIORITY_CONFIG = {
  alta:  { bg: 'rgba(248,113,113,0.12)', color: '#f87171' },
  media: { bg: 'rgba(251,191,36,0.12)',  color: '#fbbf24' },
  baixa: { bg: 'rgba(52,211,153,0.12)',  color: '#34d399' },
};

export default function SugestoesPage() {
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api.post<{ analysis: Analysis }>('/ai/analyze', { scope: 'operacao', instructions: 'Liste as principais sugestões e prioridades para a operação agora.' })
      .then(({ data: d }) => setData(d.analysis))
      .catch((e) => setError(e?.response?.data?.detail || 'Falha ao gerar sugestões'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Inteligência IA</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Sugestões</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Recomendações geradas pela IA com base nos dados da plataforma</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)', color: 'var(--erp-text-muted)' }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl" style={{ background: 'var(--erp-surface-2)' }} />
          ))}
        </div>
      ) : data ? (
        <>
          <Card padding="lg">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ background: 'var(--erp-violet-dim)' }}>
                <Sparkles size={16} style={{ color: 'var(--erp-violet-light)' }} />
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--erp-text)' }}>{data.headline}</p>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}>{data.summary}</p>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            {(data.actions ?? []).map((action, i) => {
              const pc = PRIORITY_CONFIG[action.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.baixa;
              return (
                <div key={i} className="rounded-2xl p-4"
                  style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}>
                  <div className="flex items-start gap-3">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0 mt-0.5"
                      style={{ background: pc.bg, color: pc.color }}>
                      {action.priority}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--erp-violet-light)' }}>{action.area}</span>
                      </div>
                      <p className="font-semibold text-sm" style={{ color: 'var(--erp-text)' }}>{action.title}</p>
                      <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}>{action.rationale}</p>
                      <div className="flex items-center gap-1 mt-2">
                        <ChevronRight size={11} style={{ color: 'var(--erp-violet-light)' }} />
                        <p className="text-xs font-medium" style={{ color: 'var(--erp-violet-light)' }}>{action.recommended_action}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
