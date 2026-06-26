import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, RefreshCw, AlertTriangle, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';

type Scope = 'operacao' | 'financeiro' | 'comercial' | 'marketing' | 'site' | 'clientes' | 'propostas';

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'operacao',   label: 'Operação'   },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'comercial',  label: 'Comercial'  },
  { id: 'marketing',  label: 'Marketing'  },
  { id: 'site',       label: 'Site'       },
  { id: 'clientes',   label: 'Clientes'   },
  { id: 'propostas',  label: 'Propostas'  },
];

const QUICK_PROMPTS: Record<Scope, string[]> = {
  operacao:   ['Quais são as prioridades desta semana?', 'Onde estão os maiores riscos operacionais?'],
  financeiro: ['Como está o caixa projetado?', 'Quais clientes têm pagamentos vencidos?'],
  comercial:  ['Quem devo contatar hoje?', 'Onde o pipeline está travado?'],
  marketing:  ['Que conteúdo devo publicar essa semana?', 'Como aumentar engajamento no LinkedIn?'],
  site:       ['Como melhorar a taxa de conversão?', 'Quais páginas têm mais rejeição?'],
  clientes:   ['Quais clientes correm risco de churn?', 'Quem está mais engajado?'],
  propostas:  ['Quais propostas estão paradas há mais tempo?', 'Como melhorar a taxa de fechamento?'],
};

interface Action { area: string; priority: string; title: string; rationale: string; recommended_action: string }
interface Analysis {
  headline: string; summary: string;
  actions?: Action[];
  budget_suggestions?: { title: string; suggestion: string }[];
  content_ideas?: { title: string; format: string; angle: string }[];
}

type Message =
  | { id: number; role: 'user'; content: string; scope: Scope }
  | { id: number; role: 'assistant'; analysis: Analysis }
  | { id: number; role: 'error'; content: string };

function UserBubble({ msg }: { msg: Extract<Message, { role: 'user' }> }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] space-y-1">
        <div className="flex items-center justify-end gap-2">
          <span className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--erp-text-dim)' }}>
            {SCOPES.find((s) => s.id === msg.scope)?.label}
          </span>
        </div>
        <div className="rounded-2xl rounded-tr-sm px-4 py-3"
          style={{ background: 'var(--erp-violet)', color: '#fff' }}>
          <p className="text-sm leading-relaxed">{msg.content}</p>
        </div>
      </div>
    </div>
  );
}

function AnalysisBubble({ msg }: { msg: Extract<Message, { role: 'assistant' }> }) {
  const a = msg.analysis;
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full"
            style={{ background: 'var(--erp-violet-dim)' }}>
            <Sparkles size={11} style={{ color: 'var(--erp-violet-light)' }} />
          </div>
          <span className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--erp-text-dim)' }}>
            4Core IA
          </span>
        </div>
        <div className="rounded-2xl rounded-tl-sm p-4 space-y-4"
          style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--erp-text)' }}>{a.headline}</p>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}>{a.summary}</p>
          </div>
          {a.actions && a.actions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-dim)' }}>
                Ações recomendadas
              </p>
              {a.actions.map((action, i) => (
                <div key={i} className="rounded-xl p-3 flex gap-3"
                  style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--erp-violet-light)' }}>{action.area}</span>
                      <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                        style={{
                          background: action.priority === 'alta' ? 'rgba(248,113,113,0.12)' : action.priority === 'media' ? 'rgba(251,191,36,0.12)' : 'rgba(52,211,153,0.12)',
                          color: action.priority === 'alta' ? '#f87171' : action.priority === 'media' ? '#fbbf24' : '#34d399',
                        }}>
                        {action.priority}
                      </span>
                    </div>
                    <p className="text-sm font-medium" style={{ color: 'var(--erp-text)' }}>{action.title}</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}>{action.rationale}</p>
                    <div className="flex items-start gap-1 mt-2">
                      <ChevronRight size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--erp-violet-light)' }} />
                      <p className="text-xs" style={{ color: 'var(--erp-violet-light)' }}>{action.recommended_action}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {a.content_ideas && a.content_ideas.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-dim)' }}>Ideias de conteúdo</p>
              {a.content_ideas.map((c, i) => (
                <div key={i} className="rounded-xl p-3" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)' }}>
                  <p className="text-sm font-medium" style={{ color: 'var(--erp-text)' }}>{c.title}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--erp-violet-light)' }}>{c.format}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--erp-text-muted)' }}>{c.angle}</p>
                </div>
              ))}
            </div>
          )}
          {a.budget_suggestions && a.budget_suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-dim)' }}>Orçamento</p>
              {a.budget_suggestions.map((b, i) => (
                <div key={i} className="rounded-xl p-3" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)' }}>
                  <p className="text-sm font-medium" style={{ color: 'var(--erp-text)' }}>{b.title}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--erp-text-muted)' }}>{b.suggestion}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorBubble({ msg }: { msg: Extract<Message, { role: 'error' }> }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-2 rounded-2xl px-4 py-3 text-sm"
        style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
        <span>{msg.content}</span>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [scope, setScope] = useState<Scope>('operacao');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const msgId = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput('');
    const uid = ++msgId.current;
    setMessages((prev) => [...prev, { id: uid, role: 'user', content, scope }]);
    setLoading(true);
    try {
      const { data } = await api.post<{ analysis: Analysis }>('/ai/analyze', { scope, instructions: content });
      setMessages((prev) => [...prev, { id: ++msgId.current, role: 'assistant', analysis: data.analysis }]);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Não foi possível conectar ao assistente IA. Verifique as configurações do Groq.';
      setMessages((prev) => [...prev, { id: ++msgId.current, role: 'error', content: msg }]);
    } finally {
      setLoading(false);
    }
  }

  const quickPrompts = QUICK_PROMPTS[scope];

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 160px)' }}>
      {/* Scope selector */}
      <div className="flex items-center gap-1 flex-wrap mb-4">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            onClick={() => setScope(s.id)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              background: scope === s.id ? 'var(--erp-violet-dim)' : 'var(--erp-surface)',
              color: scope === s.id ? 'var(--erp-violet-light)' : 'var(--erp-text-muted)',
              border: scope === s.id ? '1px solid var(--erp-violet)44' : '1px solid var(--erp-border)',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4 [scrollbar-width:thin]">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: 'var(--erp-violet-dim)' }}>
              <Sparkles size={28} style={{ color: 'var(--erp-violet-light)' }} />
            </div>
            <div className="text-center">
              <p className="font-semibold" style={{ color: 'var(--erp-text)' }}>Assistente 4Core IA</p>
              <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>
                Selecione uma área e faça sua pergunta ou use um prompt rápido abaixo.
              </p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === 'user'      && <UserBubble     msg={msg as Extract<Message, {role:'user'}>} />}
            {msg.role === 'assistant' && <AnalysisBubble msg={msg as Extract<Message, {role:'assistant'}>} />}
            {msg.role === 'error'     && <ErrorBubble    msg={msg as Extract<Message, {role:'error'}>} />}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl px-4 py-3"
              style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}>
              <RefreshCw size={13} className="animate-spin" style={{ color: 'var(--erp-violet-light)' }} />
              <span className="text-sm" style={{ color: 'var(--erp-text-muted)' }}>Analisando com IA…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {quickPrompts.map((p) => (
          <button
            key={p}
            onClick={() => send(p)}
            disabled={loading}
            className="rounded-xl px-3 py-1.5 text-xs transition-all disabled:opacity-40"
            style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)', color: 'var(--erp-text-muted)' }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={`Pergunte sobre ${SCOPES.find((s) => s.id === scope)?.label.toLowerCase()}…`}
          rows={2}
          className="flex-1 resize-none rounded-2xl px-4 py-3 text-sm outline-none leading-relaxed"
          style={{
            background: 'var(--erp-surface)',
            border: '1px solid var(--erp-border)',
            color: 'var(--erp-text)',
            caretColor: 'var(--erp-violet)',
          }}
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl transition-all disabled:opacity-40"
          style={{ background: 'var(--erp-violet)', color: '#fff' }}
        >
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
