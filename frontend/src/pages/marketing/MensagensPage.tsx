import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, RefreshCw, Send } from 'lucide-react';
import { api } from '../../services/api';
import { Card } from '../../shared/components/ui/Card';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { Spinner } from '../../shared/components/ui/Spinner';

interface Conversation {
  id: string;
  participant_id: string | null;
  participant_username: string | null;
  last_message: string;
  last_message_at: string | null;
  last_from_me: boolean;
}

interface Message {
  id: string;
  text: string;
  created_at: string | null;
  from_me: boolean;
}

function ConversationSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 rounded-xl px-3 py-2.5">
          <div className="h-9 w-9 shrink-0 rounded-full" style={{ background: 'var(--erp-surface-2)' }} />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-24 rounded-full" style={{ background: 'var(--erp-surface-2)' }} />
            <div className="h-2 w-40 rounded-full" style={{ background: 'var(--erp-surface-2)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MessagesSkeleton() {
  return (
    <div className="flex-1 space-y-3 p-4">
      {[1, 0, 1, 1, 0].map((fromMe, i) => (
        <div key={i} className={`flex ${fromMe ? 'justify-end' : 'justify-start'}`}>
          <div className="h-8 w-40 max-w-[70%] animate-pulse rounded-2xl" style={{ background: 'var(--erp-surface-2)' }} />
        </div>
      ))}
    </div>
  );
}

export default function MensagensPage() {
  const navigate = useNavigate();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  function loadConversations() {
    setLoadingConversations(true);
    setError('');
    api.get<{ user_id?: string; configured: boolean }>('/marketing/meta/instagram-login/status')
      .then(({ data }) => {
        setConfigured(data.configured);
        if (!data.configured) { setLoadingConversations(false); return; }
        return api.get<{ conversations: Conversation[] }>('/marketing/meta/instagram/conversations')
          .then(({ data }) => setConversations(data.conversations ?? []));
      })
      .catch((err) => setError(err?.response?.data?.detail || 'Não foi possível carregar as conversas.'))
      .finally(() => setLoadingConversations(false));
  }

  useEffect(() => { loadConversations(); }, []);

  function openConversation(conversation: Conversation) {
    setSelected(conversation);
    setLoadingMessages(true);
    setMessages([]);
    api.get<{ messages: Message[] }>(`/marketing/meta/instagram/conversations/${conversation.id}/messages`)
      .then(({ data }) => setMessages(data.messages ?? []))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendReply() {
    if (!selected?.participant_id || !reply.trim()) return;
    const text = reply.trim();
    setSending(true);
    try {
      await api.post(`/marketing/meta/instagram/conversations/${selected.id}/reply`, {
        recipient_id: selected.participant_id,
        text,
      });
      setMessages((prev) => [...prev, { id: `local-${Date.now()}`, text, created_at: new Date().toISOString(), from_me: true }]);
      setReply('');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Não foi possível enviar a resposta.');
    } finally {
      setSending(false);
    }
  }

  if (configured === false) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold" style={{ color: 'var(--erp-text)' }}>Mensagens</h1>
        <EmptyState
          icon={<MessageCircle size={28} />}
          title="Conecte o Instagram para ver as mensagens"
          description="Cole o token de mensagens diretas na tela de Conexões antes de acessar sua caixa de entrada."
          action={{ label: 'Ir para Conexões', onClick: () => navigate('/marketing/conexoes') }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold" style={{ color: 'var(--erp-text)' }}>Mensagens</h1>
        <button
          type="button"
          onClick={loadConversations}
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--erp-surface-2)]"
          style={{ color: 'var(--erp-text-muted)' }}
          aria-label="Atualizar"
        >
          <RefreshCw size={14} className={loadingConversations ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: 'rgba(190,18,60,0.08)', border: '1px solid rgba(190,18,60,0.3)', color: 'var(--erp-rose)' }}>
          {error}
        </div>
      )}

      <Card padding="sm">
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] md:divide-x" style={{ borderColor: 'var(--erp-border)' }}>
          {/* Lista de conversas */}
          <div className="max-h-[65vh] overflow-y-auto md:max-h-[70vh]">
            {loadingConversations ? (
              <ConversationSkeleton />
            ) : conversations.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={<MessageCircle size={24} />} title="Nenhuma conversa ainda" description="Novas mensagens do Instagram aparecem aqui." />
              </div>
            ) : (
              <div className="space-y-0.5 p-2">
                {conversations.map((conversation) => {
                  const active = selected?.id === conversation.id;
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => openConversation(conversation)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors"
                      style={{ background: active ? 'var(--erp-violet-dim)' : 'transparent' }}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)' }}>
                        {(conversation.participant_username || '?').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold" style={{ color: active ? 'var(--erp-violet)' : 'var(--erp-text)' }}>
                          @{conversation.participant_username || conversation.participant_id || 'desconhecido'}
                        </p>
                        <p className="truncate text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                          {conversation.last_from_me ? 'Você: ' : ''}{conversation.last_message || 'Sem mensagens'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Thread */}
          <div className="flex max-h-[65vh] flex-col md:max-h-[70vh]">
            {!selected ? (
              <div className="flex flex-1 items-center justify-center p-10">
                <p className="text-sm" style={{ color: 'var(--erp-text-muted)' }}>Selecione uma conversa para ver as mensagens.</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto">
                  {loadingMessages ? (
                    <MessagesSkeleton />
                  ) : (
                    <div className="space-y-2 p-4">
                      {messages.map((message) => (
                        <div key={message.id} className={`flex ${message.from_me ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className="max-w-[70%] rounded-2xl px-3.5 py-2 text-sm"
                            style={{
                              background: message.from_me ? 'var(--erp-violet)' : 'var(--erp-surface-2)',
                              color: message.from_me ? '#fff' : 'var(--erp-text)',
                            }}
                          >
                            {message.text}
                          </div>
                        </div>
                      ))}
                      <div ref={bottomRef} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 border-t p-3" style={{ borderColor: 'var(--erp-border)' }}>
                  <input
                    type="text"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !sending) sendReply(); }}
                    placeholder="Escreva uma resposta..."
                    className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}
                  />
                  <button
                    type="button"
                    onClick={sendReply}
                    disabled={sending || !reply.trim()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: 'var(--erp-violet)', color: '#fff', opacity: sending || !reply.trim() ? 0.6 : 1 }}
                  >
                    {sending ? <Spinner size={16} /> : <Send size={15} />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
