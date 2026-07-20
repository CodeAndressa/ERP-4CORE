import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, Send, Sparkles } from 'lucide-react';
import { api } from '../../services/api';

type Scope = 'operacao' | 'financeiro' | 'comercial' | 'marketing' | 'site' | 'clientes' | 'propostas';

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'operacao', label: 'Operação' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'comercial', label: 'Comercial' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'site', label: 'Site' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'propostas', label: 'Propostas' },
];

const QUICK_PROMPTS: Record<Scope, string[]> = {
  operacao: ['Quais são as prioridades desta semana?', 'Onde estão os maiores riscos operacionais?'],
  financeiro: ['Como está o caixa realizado?', 'Quais clientes têm pagamentos vencidos?'],
  comercial: ['Quem devo contatar hoje?', 'Onde o pipeline está travado?'],
  marketing: ['Que conteúdo devo publicar essa semana?', 'Como aumentar engajamento no LinkedIn?'],
  site: ['Como melhorar a taxa de conversão?', 'Quais páginas têm mais rejeição?'],
  clientes: ['Quais clientes correm risco de churn?', 'Quem está mais engajado?'],
  propostas: ['Quais propostas estão paradas há mais tempo?', 'Como melhorar a taxa de fechamento?'],
};

interface Analysis {
  headline: string;
  summary: string;
}

type Message =
  | { id: number; role: 'user'; content: string; scope: Scope }
  | { id: number; role: 'assistant'; analysis: Analysis }
  | { id: number; role: 'error'; content: string };

function UserBubble({ message }: { message: Extract<Message, { role: 'user' }> }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] space-y-1">
        <div className="flex items-center justify-end gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{SCOPES.find((scope) => scope.id === message.scope)?.label}</span>
        </div>
        <div className="rounded-[24px] rounded-tr-md bg-violet-600 px-4 py-3 text-white">
          <p className="text-sm leading-relaxed">{message.content}</p>
        </div>
      </div>
    </div>
  );
}

function AnalysisBubble({ message }: { message: Extract<Message, { role: 'assistant' }> }) {
  const analysis = message.analysis;
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-50">
            <Sparkles size={12} className="text-violet-600" />
          </div>
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">4Core IA</span>
        </div>
        <div className="space-y-1 rounded-[26px] rounded-tl-md border border-violet-100 bg-white p-4">
          <p className="text-sm font-semibold text-slate-950">{analysis.headline}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{analysis.summary}</p>
        </div>
      </div>
    </div>
  );
}

function ErrorBubble({ message }: { message: Extract<Message, { role: 'error' }> }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-2 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
        <span>{message.content}</span>
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
    setMessages((previous) => [...previous, { id: ++msgId.current, role: 'user', content, scope }]);
    setLoading(true);
    try {
      const { data } = await api.post<{ analysis: Analysis }>('/ai/analyze', { scope, instructions: content });
      setMessages((previous) => [...previous, { id: ++msgId.current, role: 'assistant', analysis: data.analysis }]);
    } catch (err: any) {
      const message = err?.response?.data?.detail || 'Não foi possível conectar ao assistente IA. Verifique as configurações do Groq.';
      setMessages((previous) => [...previous, { id: ++msgId.current, role: 'error', content: message }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 160px)' }}>
      <div className="mb-4 flex flex-wrap items-center gap-1">
        {SCOPES.map((item) => (
          <button key={item.id} onClick={() => setScope(item.id)} className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${scope === item.id ? 'bg-violet-600 text-white' : 'border border-violet-100 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'}`}>{item.label}</button>
        ))}
      </div>

      <div className="mb-4 flex-1 space-y-4 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-50">
              <Sparkles size={28} className="text-violet-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-950">Assistente 4Core IA</p>
              <p className="mt-1 text-sm text-slate-600">Selecione uma área e faça sua pergunta ou use um prompt rápido abaixo.</p>
            </div>
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id}>
            {message.role === 'user' && <UserBubble message={message} />}
            {message.role === 'assistant' && <AnalysisBubble message={message} />}
            {message.role === 'error' && <ErrorBubble message={message} />}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-[24px] border border-violet-100 bg-white px-4 py-3">
              <RefreshCw size={13} className="animate-spin text-violet-600" />
              <span className="text-sm text-slate-600">Analisando com IA...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {QUICK_PROMPTS[scope].map((prompt) => (
          <button key={prompt} onClick={() => send(prompt)} disabled={loading} className="rounded-xl border border-violet-100 bg-white px-3 py-1.5 text-xs text-slate-600 transition-all hover:border-violet-200 hover:text-violet-700 disabled:opacity-40">{prompt}</button>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder={`Pergunte sobre ${SCOPES.find((item) => item.id === scope)?.label.toLowerCase()}...`} rows={2} className="flex-1 resize-none rounded-[26px] border border-violet-100 bg-white px-4 py-3 text-sm leading-relaxed text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100" />
        <button onClick={() => send()} disabled={!input.trim() || loading} className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-white transition-all hover:bg-violet-700 disabled:opacity-40">
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
