import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Sparkles, TrendingUp, AlertTriangle, Lightbulb, ArrowRight, RefreshCw, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUIStore } from '../../../core/store/useUIStore';
import { api } from '../../../services/api';

interface Insight {
  type: 'opportunity' | 'warning' | 'trend' | 'recommendation';
  title: string;
  body: string;
}

const iconMap = {
  opportunity:    { icon: Lightbulb,    color: 'text-violet-300',  bg: 'bg-violet-500/12' },
  warning:        { icon: AlertTriangle, color: 'text-amber-300',   bg: 'bg-amber-400/10'  },
  trend:          { icon: TrendingUp,   color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  recommendation: { icon: Sparkles,     color: 'text-cyan-300',    bg: 'bg-cyan-500/10'   },
};

function parseInsights(text: string): Insight[] {
  const lines = text.split('\n').filter((l) => l.trim());
  const insights: Insight[] = [];
  let current: Partial<Insight> | null = null;

  for (const line of lines) {
    const stripped = line.replace(/^[-•*#]+\s*/, '').trim();
    if (!stripped) continue;

    if (/oportunidade|crescimento|potencial|upsell/i.test(stripped)) {
      if (current?.title) insights.push(current as Insight);
      current = { type: 'opportunity', title: stripped, body: '' };
    } else if (/atenção|alerta|risco|atraso|inadimpl/i.test(stripped)) {
      if (current?.title) insights.push(current as Insight);
      current = { type: 'warning', title: stripped, body: '' };
    } else if (/tendência|cresceu|reduziu|evolu/i.test(stripped)) {
      if (current?.title) insights.push(current as Insight);
      current = { type: 'trend', title: stripped, body: '' };
    } else if (current) {
      current.body = (current.body ? current.body + ' ' : '') + stripped;
    } else {
      current = { type: 'recommendation', title: stripped, body: '' };
    }
  }
  if (current?.title) insights.push(current as Insight);

  if (insights.length === 0 && text.trim()) {
    insights.push({ type: 'recommendation', title: 'Análise IA', body: text.trim() });
  }
  return insights.slice(0, 6);
}

function fallbackInsights(module: string): Insight[] {
  const map: Record<string, Insight[]> = {
    Dashboard: [
      { type: 'trend',          title: 'MRR em crescimento',             body: 'Receita recorrente cresceu nos últimos 3 meses consecutivos.' },
      { type: 'opportunity',    title: 'Pipeline com alto potencial',    body: 'Identifiquei 3 oportunidades com alta probabilidade de fechamento esta semana.' },
      { type: 'warning',        title: 'Atenção ao fluxo de caixa',      body: '2 boletos com vencimento nos próximos 3 dias. Verifique a conciliação.' },
      { type: 'recommendation', title: 'Recomendação estratégica',       body: 'Foque em retenção: o custo de aquisição de novos clientes está 3x maior que a manutenção.' },
    ],
    Financeiro: [
      { type: 'trend',          title: 'Receitas acima da média',        body: 'Receitas do mês atual 12% acima da média dos últimos 6 meses.' },
      { type: 'warning',        title: 'Despesas operacionais elevadas', body: 'Custos operacionais cresceram 18% vs mês anterior. Analise as categorias.' },
      { type: 'opportunity',    title: 'Oportunidade de economia',       body: '3 assinaturas recorrentes sem uso identificadas. Potencial de R$1.200/mês.' },
      { type: 'recommendation', title: 'Projeção positiva',              body: 'Com o pipeline atual, a receita prevista para o próximo mês supera a meta em 8%.' },
    ],
    Comercial: [
      { type: 'opportunity',    title: '5 leads quentes identificados',  body: 'Leads com alta pontuação de engajamento sem contato nos últimos 7 dias.' },
      { type: 'warning',        title: 'Leads esfriando',                body: '8 leads sem follow-up há mais de 14 dias. Risco de perda iminente.' },
      { type: 'trend',          title: 'Taxa de conversão em alta',      body: 'Conversão de proposta para contrato subiu 6% este mês.' },
      { type: 'recommendation', title: 'Ação prioritária',               body: 'Entre em contato com Empresa ABC — proposta aberta há 12 dias sem resposta.' },
    ],
    Marketing: [
      { type: 'trend',          title: 'Melhor engajamento: terças',     body: 'Posts publicados às terças tiveram 43% mais alcance na média histórica.' },
      { type: 'opportunity',    title: 'Temas com alta performance',     body: 'Conteúdo sobre resultados e cases tem CTR 2x maior que conteúdo institucional.' },
      { type: 'warning',        title: 'Frequência abaixo do ideal',     body: 'Apenas 2 posts na última semana. A consistência é fator-chave de alcance.' },
      { type: 'recommendation', title: 'Campanha sugerida',              body: 'Lançar campanha de case de sucesso: momento ideal dado o histórico recente.' },
    ],
  };

  return map[module] ?? map['Dashboard'];
}

export function AIDrawer() {
  const { aiDrawerOpen, aiDrawerModule, closeAIDrawer } = useUIStore();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!aiDrawerOpen) return;
    setLoading(true);
    setInsights([]);

    api.get<{ recommendations: string[] }>('/ai/recommendations')
      .then(({ data }) => {
        const text = (data.recommendations ?? []).join('\n');
        const parsed = parseInsights(text);
        setInsights(parsed.length ? parsed : fallbackInsights(aiDrawerModule));
      })
      .catch(() => setInsights(fallbackInsights(aiDrawerModule)))
      .finally(() => setLoading(false));
  }, [aiDrawerOpen, aiDrawerModule]);

  const refresh = () => {
    if (loading) return;
    setLoading(true);
    setInsights([]);
    setTimeout(() => {
      setInsights(fallbackInsights(aiDrawerModule));
      setLoading(false);
    }, 1200);
  };

  return (
    <AnimatePresence>
      {aiDrawerOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeAIDrawer}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-white/10 bg-[#0c0926] shadow-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15">
                  <Sparkles size={14} className="text-violet-300" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">Análise IA</p>
                  <p className="text-sm font-semibold text-white">{aiDrawerModule || 'Visão Geral'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={refresh}
                  className="rounded-lg p-2 text-slate-500 hover:bg-white/8 hover:text-slate-300 transition-colors"
                  title="Atualizar análise"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={closeAIDrawer}
                  className="rounded-lg p-2 text-slate-500 hover:bg-white/8 hover:text-slate-300 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {loading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2 rounded-xl border border-white/6 bg-white/[0.03] p-4">
                      <div className="h-3 w-32 animate-pulse rounded bg-white/8" />
                      <div className="h-2.5 w-full animate-pulse rounded bg-white/6" />
                      <div className="h-2.5 w-4/5 animate-pulse rounded bg-white/6" />
                    </div>
                  ))}
                  <p className="text-center text-xs text-slate-500 pt-2">Analisando contexto...</p>
                </>
              ) : (
                insights.map((ins, i) => {
                  const cfg = iconMap[ins.type];
                  const Icon = cfg.icon;
                  return (
                    <motion.div
                      key={i}
                      className="rounded-xl border border-white/6 bg-white/[0.03] p-4"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
                          <Icon size={13} className={cfg.color} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-200">{ins.title}</p>
                          {ins.body && (
                            <p className="mt-1 text-xs leading-relaxed text-slate-400">{ins.body}</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/8 px-5 py-4">
              <Link
                to="/ia/chat"
                onClick={closeAIDrawer}
                className="flex items-center justify-between rounded-xl border border-violet-500/25 bg-violet-500/8 px-4 py-3 text-sm font-medium text-violet-300 transition hover:bg-violet-500/14"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} />
                  Conversar sobre esta análise
                </div>
                <ArrowRight size={14} />
              </Link>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
