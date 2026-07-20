import { useState } from 'react';
import { FileText, RefreshCw, AlertTriangle, Calendar } from 'lucide-react';
import { api } from '../../services/api';
import { Card } from '../../shared/components/ui/Card';

interface Analysis {
  headline: string;
  summary: string;
  actions?: { area: string; priority: string; title: string; recommended_action: string }[];
}

const RESUMO_TYPES = [
  { id: 'semanal',  label: 'Resumo Semanal',  prompt: 'Gere um resumo executivo da semana: principais eventos, alertas financeiros, comerciais e de marketing.' },
  { id: 'mensal',   label: 'Resumo Mensal',   prompt: 'Gere um resumo executivo do mês: resultados alcançados, desvios do plano e próximos passos estratégicos.' },
  { id: 'executivo',label: 'Briefing Diário', prompt: 'Gere um briefing executivo para hoje: o que precisa de atenção imediata e quais são as 3 prioridades do dia.' },
];

export default function ResumosPage() {
  const [type, setType] = useState('semanal');
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  function generate() {
    const t = RESUMO_TYPES.find((x) => x.id === type)!;
    setLoading(true);
    setError(null);
    api.post<{ analysis: Analysis }>('/ai/analyze', { scope: 'operacao', instructions: t.prompt, include_actions: true })
      .then(({ data: d }) => {
        setData(d.analysis);
        setGeneratedAt(new Date().toLocaleString('pt-BR'));
      })
      .catch((e) => setError(e?.response?.data?.detail || 'Falha ao gerar resumo'))
      .finally(() => setLoading(false));
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Inteligência IA</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Resumos Automáticos</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Resumos executivos gerados pela IA com base nos dados da plataforma</p>
      </div>

      <Card padding="lg">
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--erp-text)' }}>Tipo de resumo</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {RESUMO_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className="rounded-xl px-4 py-2 text-sm font-medium transition-all"
              style={{
                background: type === t.id ? 'var(--erp-violet)' : 'var(--erp-surface-2)',
                color: type === t.id ? '#fff' : 'var(--erp-text-muted)',
                border: '1px solid var(--erp-border)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--erp-violet)', color: '#fff' }}
        >
          <FileText size={14} />
          {loading ? 'Gerando…' : 'Gerar resumo'}
        </button>
      </Card>

      {error && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(190,18,60,0.08)', border: '1px solid rgba(190,18,60,0.2)', color: 'var(--erp-rose)' }}>
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl" style={{ background: 'var(--erp-surface-2)' }} />
          ))}
        </div>
      )}

      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl py-14 text-center" style={{ border: '1px dashed var(--erp-border)' }}>
          <FileText size={24} style={{ color: 'var(--erp-text-dim)' }} />
          <p className="text-sm" style={{ color: 'var(--erp-text-muted)' }}>Escolha um tipo de resumo e clique em "Gerar resumo" para começar.</p>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">
          {generatedAt && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--erp-text-dim)' }}>
              <Calendar size={11} />
              Gerado em {generatedAt}
            </div>
          )}
          <Card padding="lg">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ background: 'var(--erp-violet-dim)' }}>
                <FileText size={16} style={{ color: 'var(--erp-violet-light)' }} />
              </div>
              <div className="flex-1">
                <p className="font-semibold" style={{ color: 'var(--erp-text)' }}>{data.headline}</p>
                <p className="text-sm mt-2 leading-relaxed whitespace-pre-line" style={{ color: 'var(--erp-text-muted)' }}>{data.summary}</p>
              </div>
            </div>
          </Card>
          {(data.actions ?? []).length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--erp-text-dim)' }}>Ações prioritárias</p>
              <div className="space-y-2">
                {(data.actions ?? []).map((a, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl px-4 py-3"
                    style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}>
                    <RefreshCw size={12} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--erp-violet-light)' }} />
                    <div>
                      <p className="text-xs font-medium" style={{ color: 'var(--erp-text)' }}>{a.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--erp-text-muted)' }}>{a.recommended_action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
