import { useState } from 'react';
import { api } from '../services/api';
import { PageHeader, SectionCard, StatusBadge, primaryButton } from '../components/ErpUi';

type Analysis = {
  headline: string;
  summary: string;
  actions?: { title: string; area: string; priority: string; rationale: string; recommended_action: string }[];
  budget_suggestions?: { title: string; suggestion: string }[];
  content_ideas?: { title: string; format: string; angle: string }[];
};

const scopes = [
  ['operacao', 'Operação'],
  ['financeiro', 'Financeiro'],
  ['comercial', 'Comercial'],
  ['marketing', 'Marketing'],
  ['site', 'Site'],
];

export default function AiPage() {
  const [scope, setScope] = useState('operacao');
  const [instructions, setInstructions] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/ai/analyze', { scope, instructions });
      setAnalysis(data.analysis);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Não foi possível gerar a análise. Entre na plataforma e confirme a configuração do Groq.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Assistente IA"
        title="Análises e próximos passos"
        description="Transforme os dados do ERP e do site em prioridades, orçamento e ideias de conteúdo."
        action={<button onClick={generate} disabled={loading} className={`${primaryButton} disabled:opacity-60`}>{loading ? 'Analisando...' : 'Gerar análise'}</button>}
      />

      <SectionCard title="Contexto da análise" subtitle="Escolha uma área e descreva o que precisa decidir.">
        <div className="flex flex-wrap gap-2">
          {scopes.map(([id, label]) => (
            <button key={id} onClick={() => setScope(id)} className={`rounded-xl px-4 py-2 text-sm font-medium transition ${scope === id ? 'bg-violet-600 text-white' : 'border border-violet-100 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'}`}>
              {label}
            </button>
          ))}
        </div>
        <textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          className="mt-5 min-h-24 w-full rounded-[24px] border border-violet-100 bg-white p-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
          placeholder="Ex.: sugira orçamento, posts para a semana, prioridades comerciais ou melhorias de conversão."
        />
      </SectionCard>

      {error && <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      {analysis ? (
        <>
          <SectionCard title={analysis.headline} subtitle={analysis.summary}>
            <div className="space-y-4">
              {analysis.actions?.map((action) => (
                <article key={action.title} className="rounded-[24px] border border-violet-100 bg-white p-5">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">{action.area}</p>
                      <p className="mt-2 font-semibold text-slate-950">{action.title}</p>
                    </div>
                    <StatusBadge tone={action.priority === 'alta' ? 'rose' : action.priority === 'media' ? 'amber' : 'emerald'}>{action.priority}</StatusBadge>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{action.rationale}</p>
                  <p className="mt-3 text-sm font-medium text-violet-700">Próximo passo: {action.recommended_action}</p>
                </article>
              ))}
            </div>
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Sugestões orçamentárias" subtitle="Estimativas gerenciais; valide antes de executar">
              {analysis.budget_suggestions?.map((item) => (
                <div key={item.title} className="mb-3 rounded-[22px] border border-violet-100 bg-violet-50/45 p-4">
                  <p className="font-medium text-slate-950">{item.title}</p>
                  <p className="mt-2 text-sm text-slate-600">{item.suggestion}</p>
                </div>
              ))}
            </SectionCard>
            <SectionCard title="Ideias de conteúdo" subtitle="Posts e campanhas sugeridos">
              {analysis.content_ideas?.map((item) => (
                <div key={item.title} className="mb-3 rounded-[22px] border border-violet-100 bg-violet-50/45 p-4">
                  <p className="font-medium text-slate-950">{item.title}</p>
                  <p className="mt-1 text-xs font-medium text-violet-700">{item.format}</p>
                  <p className="mt-2 text-sm text-slate-600">{item.angle}</p>
                </div>
              ))}
            </SectionCard>
          </div>
        </>
      ) : (
        <SectionCard title="Use a IA em cada módulo" subtitle="Financeiro para orçamento e caixa; Comercial para follow-ups; Marketing para posts; Site para conversão; Operação para prioridades integradas.">
          <p className="text-sm text-slate-600">Os dados disponíveis são usados como contexto e a IA informa quando ainda falta uma fonte conectada.</p>
        </SectionCard>
      )}
    </div>
  );
}
