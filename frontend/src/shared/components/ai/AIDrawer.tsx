import { useCallback, useEffect, useState } from 'react';
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
  opportunity: { icon: Lightbulb, color: 'text-violet-600', bg: 'bg-violet-50' },
  warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
  trend: { icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  recommendation: { icon: Sparkles, color: 'text-cyan-600', bg: 'bg-cyan-50' },
};

function parseInsights(text: string): Insight[] {
  const lines = text.split('\n').filter((line) => line.trim());
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
      current.body = (current.body ? `${current.body} ` : '') + stripped;
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

export function AIDrawer() {
  const { aiDrawerOpen, aiDrawerModule, closeAIDrawer } = useUIStore();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  // A falha precisa chegar na tela. Antes ela virava insight de exemplo, e a
  // pessoa nao tinha como saber que estava lendo texto escrito a mao em vez da
  // analise dos dados dela.
  const [erro, setErro] = useState('');

  const buscar = useCallback(() => {
    setLoading(true);
    setInsights([]);
    setErro('');

    return api
      .get<{ recommendations: string[] }>('/ai/recommendations')
      .then(({ data }) => {
        const text = (data.recommendations ?? []).join('\n');
        const parsed = parseInsights(text);
        setInsights(parsed);
        if (!parsed.length) {
          setErro('A análise voltou vazia. Pode ser que ainda não haja dado conectado suficiente nesta área.');
        }
      })
      .catch((err) => {
        const detalhe = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setErro(detalhe || 'Não foi possível gerar a análise agora.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!aiDrawerOpen) return;
    void buscar();
  }, [aiDrawerOpen, aiDrawerModule, buscar]);

  // Atualizar busca de novo. Antes ele devolvia os insights de exemplo depois de
  // 1,2 segundo de espera encenada, sem chamar nada.
  const refresh = () => {
    if (loading) return;
    void buscar();
  };

  return (
    <AnimatePresence>
      {aiDrawerOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-violet-950/10 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeAIDrawer}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-violet-100 bg-white"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          >
            <div className="flex items-center justify-between border-b border-violet-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-50">
                  <Sparkles size={14} className="text-violet-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">Análise IA</p>
                  <p className="text-sm font-semibold text-slate-950">{aiDrawerModule || 'Visão Geral'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={refresh}
                  className="rounded-full p-2 text-slate-500 transition-colors hover:bg-violet-50 hover:text-violet-700"
                  title="Atualizar análise"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={closeAIDrawer}
                  className="rounded-full p-2 text-slate-500 transition-colors hover:bg-violet-50 hover:text-violet-700"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {loading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2 rounded-[24px] border border-violet-100 bg-violet-50/40 p-4">
                      <div className="h-3 w-32 animate-pulse rounded-full bg-violet-100" />
                      <div className="h-2.5 w-full animate-pulse rounded-full bg-violet-100" />
                      <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-violet-100" />
                    </div>
                  ))}
                  <p className="pt-2 text-center text-xs text-slate-500">Analisando contexto...</p>
                </>
              ) : erro ? (
                <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm font-semibold text-rose-700">Sem análise para mostrar</p>
                  <p className="mt-1 text-xs leading-relaxed text-rose-700">{erro}</p>
                  <button
                    onClick={refresh}
                    className="mt-3 text-xs font-semibold text-rose-700 underline"
                  >
                    Tentar de novo
                  </button>
                </div>
              ) : (
                insights.map((ins, i) => {
                  const cfg = iconMap[ins.type];
                  const Icon = cfg.icon;
                  return (
                    <motion.div
                      key={i}
                      className="rounded-[24px] border border-violet-100 bg-white p-4"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${cfg.bg}`}>
                          <Icon size={13} className={cfg.color} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{ins.title}</p>
                          {ins.body && (
                            <p className="mt-1 text-xs leading-relaxed text-slate-600">{ins.body}</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            <div className="border-t border-violet-100 px-5 py-4">
              <Link
                to="/ia/chat"
                onClick={closeAIDrawer}
                className="flex items-center justify-between rounded-full border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-700 transition hover:bg-violet-100"
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
