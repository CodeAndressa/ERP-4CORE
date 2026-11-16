import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AtSign, ExternalLink, MessageCircle, RefreshCw, Send, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../../shared/components/ui/Button';
import { Card } from '../../shared/components/ui/Card';
import { PageHeader } from '../../shared/components/layout';
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

const INTERVALO_MS = 15000;

/** A hora da mensagem. Uma caixa de entrada sem hora não diz se a pessoa está
 *  esperando há dois minutos ou há dois dias, que é a única coisa que define o
 *  que responder primeiro. */
function hora(iso: string | null) {
  if (!iso) return '';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** O rótulo do dia, usado no separador entre blocos de mensagem. */
function dia(iso: string | null) {
  if (!iso) return '';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '';
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mesmoDia(data, hoje)) return 'Hoje';
  if (mesmoDia(data, ontem)) return 'Ontem';
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

/** O tempo desde a última mensagem, do jeito curto que cabe na lista. */
function desde(iso: string | null) {
  if (!iso) return '';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '';
  const minutos = Math.floor((Date.now() - data.getTime()) / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `${dias} d`;
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function erroDe(err: unknown, fallback: string) {
  const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return typeof detail === 'string' && detail ? detail : fallback;
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

/** A inicial de quem escreveu, no tom da marca.
 *
 *  O gradiente do Instagram ficava no avatar de cada conversa e era a única cor
 *  da tela fora da identidade. O canal já está dito no título e no cabeçalho da
 *  conversa; repeti-lo em cada linha só tirava a lista do lugar. */
function Avatar({ username, size = 36 }: { username: string | null; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold uppercase"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: 'var(--erp-violet-dim)',
        color: 'var(--erp-violet)',
      }}
      aria-hidden="true"
    >
      {(username || '?').slice(0, 2)}
    </div>
  );
}

export default function MensagensPage() {
  const navigate = useNavigate();
  const [conexao, setConexao] = useState<{ healthy: boolean; configured: boolean; token_error?: string | null } | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState('');
  // O que o webhook recebeu e ninguem abriu, por conversa. Vem do backend, e
  // nao de comparacao em memoria: assim a marca sobrevive a recarregar a pagina
  // e nao discorda entre duas abas abertas.
  const [novas, setNovas] = useState<Record<string, number>>({});

  const painelRef = useRef<HTMLDivElement>(null);
  // Quantas mensagens o painel ja mostrava, para distinguir "chegou algo" de
  // "a lista foi recriada igual pela atualizacao de quinze segundos".
  const contagemRef = useRef(0);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const selectedRef = useRef<Conversation | null>(null);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const loadMessages = useCallback((conversationId: string, silent = false) => {
    if (!silent) {
      setLoadingMessages(true);
      setMessages([]);
    }
    return api
      .get<{ messages: Message[] }>(`/marketing/meta/instagram/conversations/${conversationId}/messages`)
      .then(({ data }) => setMessages(data.messages ?? []))
      .catch((err) => {
        if (!silent) {
          setMessages([]);
          setError(erroDe(err, 'Não foi possível abrir esta conversa.'));
        }
      })
      .finally(() => {
        if (!silent) setLoadingMessages(false);
      });
  }, []);

  const loadUnread = useCallback(() => {
    return api
      .get<{ total: number; conversations: Record<string, number> }>(
        '/marketing/meta/instagram/unread',
      )
      .then(({ data }) => setNovas(data.conversations ?? {}))
      .catch(() => {
        // Sem o não lido a caixa continua funcionando, só sem a marca. Não vale
        // derrubar a tela por causa do aviso.
      });
  }, []);

  const loadConversations = useCallback((silent = false) => {
    if (!silent) {
      setLoadingConversations(true);
      setError('');
    }
    return api
      .get<{ configured: boolean; healthy: boolean; token_error?: string | null }>(
        '/marketing/meta/instagram-login/status',
      )
      .then(({ data }) => {
        setConexao({ configured: data.configured, healthy: data.healthy, token_error: data.token_error });
        if (!data.configured || !data.healthy) return;
        return api
          .get<{ conversations: Conversation[] }>('/marketing/meta/instagram/conversations')
          .then(({ data: lista }) => setConversations(lista.conversations ?? []));
      })
      .catch((err) => {
        if (!silent) setError(erroDe(err, 'Não foi possível carregar as conversas.'));
      })
      .finally(() => {
        if (!silent) setLoadingConversations(false);
      });
  }, []);

  useEffect(() => {
    loadConversations();
    loadUnread();
  }, [loadConversations, loadUnread]);

  // Recarrega a lista e a conversa aberta, para não depender só do webhook, que
  // pode não estar assinado. Para quando a aba sai da frente: quinze segundos
  // de chamada para uma tela que ninguém está olhando é cota da Graph API jogada
  // fora, e a Meta conta por hora.
  useEffect(() => {
    if (!conexao?.healthy) return;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      loadConversations(true);
      loadUnread();
      if (selectedRef.current) loadMessages(selectedRef.current.id, true);
    };
    const relogio = window.setInterval(tick, INTERVALO_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(relogio);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [conexao?.healthy, loadConversations, loadMessages, loadUnread]);

  function openConversation(conversation: Conversation) {
    setSelected(conversation);
    contagemRef.current = 0;
    setSendError('');
    setReply('');
    loadMessages(conversation.id);

    // Visto de verdade, no banco. O webhook identifica a conversa pelo
    // participante e a Graph API pelo id da thread, então os dois são enviados:
    // a rota aceita qualquer um dos dois e marca o que encontrar.
    setNovas(({ [conversation.id]: _aberta, ...resto }) => resto);
    const alvos = [conversation.id, conversation.participant_id].filter(Boolean) as string[];
    Promise.all(
      alvos.map((alvo) =>
        api.post(`/marketing/meta/instagram/conversations/${alvo}/seen`).catch(() => null),
      ),
    ).then(() => loadUnread());
  }

  // Rola o painel da conversa, e só ele. `scrollIntoView` rola todos os
  // containers acima do elemento, inclusive a página: era isso que arrastava a
  // tela para baixo a cada atualização, mesmo quando nada havia mudado.
  useEffect(() => {
    const painel = painelRef.current;
    if (!painel) return;

    const chegaram = messages.length > contagemRef.current;
    const primeiraCarga = contagemRef.current === 0 && messages.length > 0;
    contagemRef.current = messages.length;
    if (!chegaram) return;

    // Quem subiu para ler uma mensagem antiga não quer ser trazido de volta
    // porque chegou algo novo. A folga de 120px é o "ainda estou no fim".
    const noFim = painel.scrollHeight - painel.scrollTop - painel.clientHeight < 120;
    if (!primeiraCarga && !noFim) return;

    painel.scrollTo({
      top: painel.scrollHeight,
      behavior: primeiraCarga ? 'auto' : 'smooth',
    });
  }, [messages]);

  async function sendReply() {
    const text = reply.trim();
    if (!text || sending) return;
    if (!selected?.participant_id) {
      setSendError('O Instagram não devolveu o identificador desta pessoa, então não é possível responder por aqui.');
      return;
    }
    setSending(true);
    setSendError('');
    try {
      await api.post(`/marketing/meta/instagram/conversations/${selected.id}/reply`, {
        recipient_id: selected.participant_id,
        text,
      });
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, text, created_at: new Date().toISOString(), from_me: true },
      ]);
      setReply('');
    } catch (err) {
      setSendError(erroDe(err, 'Não foi possível enviar a resposta.'));
    } finally {
      setSending(false);
    }
  }

  /** Pede um rascunho e põe no campo. Nunca envia: quem lê e decide é a pessoa. */
  async function draftReply() {
    if (!selected || drafting) return;
    setDrafting(true);
    setSendError('');
    try {
      const { data } = await api.post<{ text: string }>(
        `/marketing/meta/instagram/conversations/${selected.id}/suggest-reply`,
      );
      setReply(data.text);
      campoRef.current?.focus();
    } catch (err) {
      setSendError(erroDe(err, 'Não foi possível escrever um rascunho agora.'));
    } finally {
      setDrafting(false);
    }
  }

  // As mensagens agrupadas por dia, para o separador sair uma vez por bloco.
  const blocos = useMemo(() => {
    const saida: { dia: string; itens: Message[] }[] = [];
    messages.forEach((mensagem) => {
      const rotulo = dia(mensagem.created_at);
      const ultimo = saida[saida.length - 1];
      if (ultimo && ultimo.dia === rotulo) ultimo.itens.push(mensagem);
      else saida.push({ dia: rotulo, itens: [mensagem] });
    });
    return saida;
  }, [messages]);

  const semResposta = conversations.filter((c) => !c.last_from_me).length;
  const totalNovas = Object.values(novas).reduce((soma, valor) => soma + valor, 0);

  async function marcarTudoVisto() {
    const alvos = Object.keys(novas);
    setNovas({});
    await Promise.all(
      alvos.map((alvo) =>
        api.post(`/marketing/meta/instagram/conversations/${alvo}/seen`).catch(() => null),
      ),
    );
    loadUnread();
  }

  // Token ausente e token vencido mandam para o mesmo lugar, mas nao dizem a
  // mesma coisa. Antes a tela so olhava `configured`, entao com o token vencido
  // ela mostrava a caixa de entrada vazia, sem explicar por que estava vazia.
  if (conexao && !conexao.healthy) {
    return (
      <div className="space-y-4">
        <PageHeader title="Mensagens" description="Conversas diretas do Instagram" />
        <EmptyState
          icon={<MessageCircle size={28} />}
          title={conexao.configured ? 'O token das mensagens não vale mais' : 'Conecte o Instagram para ver as mensagens'}
          description={
            conexao.token_error ||
            (conexao.configured
              ? 'A Meta recusou o token guardado. Gere outro no painel de desenvolvedor e cole em Conexões.'
              : 'Cole o token de mensagens diretas na tela de Conexões antes de acessar sua caixa de entrada.')
          }
          action={{ label: 'Ir para Conexões', onClick: () => navigate('/marketing/conexoes') }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mensagens"
        description={
          semResposta > 0
            ? `${semResposta} conversa${semResposta > 1 ? 's' : ''} com a última palavra do cliente`
            : 'Conversas diretas do Instagram'
        }
        aiModule="Mensagens do Instagram"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadConversations()}
            icon={<RefreshCw size={14} className={loadingConversations ? 'animate-spin' : ''} />}
          >
            Atualizar
          </Button>
        }
      />

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <MessageCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {totalNovas > 0 && (
        <button
          type="button"
          onClick={() => void marcarTudoVisto()}
          className="flex w-full items-center gap-2 rounded-2xl border px-4 py-3 text-left text-sm font-semibold"
          style={{ borderColor: 'var(--erp-violet-soft)', background: 'var(--erp-violet-dim)', color: 'var(--erp-violet)' }}
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--erp-violet)' }} />
          {totalNovas === 1 ? 'Chegou uma mensagem nova' : `Chegaram ${totalNovas} mensagens novas`}
        </button>
      )}

      <Card padding="sm" className="overflow-hidden !p-0">
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] md:divide-x" style={{ borderColor: 'var(--erp-border)' }}>
          {/* A lista. No celular ela sai de cena quando uma conversa abre: duas
              áreas de rolagem empilhadas davam uma tela de 130vh em que nem a
              lista nem a conversa cabiam. */}
          <div className={`max-h-[70vh] overflow-y-auto ${selected ? 'hidden md:block' : ''}`}>
            {loadingConversations && conversations.length === 0 ? (
              <ConversationSkeleton />
            ) : conversations.length === 0 ? (
              <div className="p-6">
                {/* A API devolve lista vazia, sem erro nenhum, quando a conta esta
                    com "Permitir acesso a mensagens" desligado nas ferramentas
                    conectadas do Instagram. Token valido, conta comercial, caixa
                    vazia: sem esta frase nao ha como distinguir isso de "ninguem
                    escreveu ainda", e e de longe a causa mais comum. */}
                <EmptyState
                  icon={<MessageCircle size={24} />}
                  title="Nenhuma conversa chegou aqui"
                  description={
                    'Se você tem mensagens no Instagram e elas não aparecem, a conta provavelmente está com o acesso às mensagens desligado. ' +
                    'No aplicativo do Instagram: Configurações, Mensagens e respostas a stories, Ferramentas conectadas, e ligue "Permitir acesso a mensagens".'
                  }
                />
              </div>
            ) : (
              <div className="space-y-0.5 p-2">
                {conversations.map((conversation) => {
                  const active = selected?.id === conversation.id;
                  const quantas =
                    (novas[conversation.id] ?? 0) +
                    (conversation.participant_id ? novas[conversation.participant_id] ?? 0 : 0);
                  const nova = quantas > 0;
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => openConversation(conversation)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[color:var(--erp-surface-2)]"
                      style={{ background: active ? 'var(--erp-violet-dim)' : 'transparent' }}
                    >
                      <Avatar username={conversation.participant_username} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <p
                            className="min-w-0 flex-1 truncate text-sm font-semibold"
                            style={{ color: active ? 'var(--erp-violet)' : 'var(--erp-text)' }}
                          >
                            @{conversation.participant_username || conversation.participant_id || 'desconhecido'}
                          </p>
                          <span className="shrink-0 text-2xs tabular-nums" style={{ color: 'var(--erp-text-dim)' }}>
                            {desde(conversation.last_message_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <p
                            className="min-w-0 flex-1 truncate text-xs"
                            style={{ color: nova ? 'var(--erp-text)' : 'var(--erp-text-muted)', fontWeight: nova ? 600 : 400 }}
                          >
                            {conversation.last_from_me ? 'Você: ' : ''}
                            {conversation.last_message || 'Sem mensagens'}
                          </p>
                          {nova && (
                            <span
                              className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full px-1 text-2xs font-bold tabular-nums text-white"
                              style={{ background: 'var(--erp-violet)' }}
                              aria-label={`${quantas} mensagem${quantas > 1 ? 's' : ''} nova${quantas > 1 ? 's' : ''}`}
                            >
                              {quantas > 9 ? '9+' : quantas}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* A conversa. */}
          <div className={`flex max-h-[70vh] min-h-[320px] flex-col ${selected ? '' : 'hidden md:flex'}`}>
            {!selected ? (
              <div className="flex flex-1 items-center justify-center p-10">
                <p className="text-sm" style={{ color: 'var(--erp-text-muted)' }}>
                  Selecione uma conversa para ver as mensagens.
                </p>
              </div>
            ) : (
              <>
                {/* Quem é esta conversa. Sem este cabeçalho, no celular a tela
                    virava um balão de texto sem dono depois que a lista saía. */}
                <div
                  className="flex items-center gap-2 border-b px-3 py-2.5"
                  style={{ borderColor: 'var(--erp-border)' }}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    aria-label="Voltar para a lista"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-colors hover:bg-[color:var(--erp-surface-2)] md:hidden"
                    style={{ color: 'var(--erp-text-muted)' }}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <Avatar username={selected.participant_username} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>
                      @{selected.participant_username || selected.participant_id || 'desconhecido'}
                    </p>
                    <p className="flex items-center gap-1 text-2xs" style={{ color: 'var(--erp-text-dim)' }}>
                      <AtSign size={10} aria-hidden="true" />
                      mensagem direta
                    </p>
                  </div>
                  {selected.participant_username && (
                    <a
                      href={`https://instagram.com/${selected.participant_username}`}
                      target="_blank"
                      rel="noreferrer"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-colors hover:bg-[color:var(--erp-surface-2)]"
                      style={{ color: 'var(--erp-text-muted)' }}
                      title="Abrir o perfil no Instagram"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>

                <div ref={painelRef} className="flex-1 overflow-y-auto">
                  {loadingMessages ? (
                    <MessagesSkeleton />
                  ) : messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center p-8">
                      <p className="text-sm" style={{ color: 'var(--erp-text-muted)' }}>
                        Esta conversa está sem mensagens.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 p-4">
                      {blocos.map((bloco) => (
                        <div key={bloco.dia} className="space-y-1.5">
                          {bloco.dia && (
                            <p
                              className="text-center text-2xs font-semibold uppercase tracking-widest"
                              style={{ color: 'var(--erp-text-dim)' }}
                            >
                              {bloco.dia}
                            </p>
                          )}
                          {bloco.itens.map((message) => (
                            <div key={message.id} className={`flex ${message.from_me ? 'justify-end' : 'justify-start'}`}>
                              <div
                                className="max-w-[78%] rounded-2xl px-3.5 py-2"
                                style={{
                                  background: message.from_me ? 'var(--erp-violet)' : 'var(--erp-surface-2)',
                                  color: message.from_me ? '#fff' : 'var(--erp-text)',
                                }}
                              >
                                <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>
                                <p
                                  className="mt-0.5 text-right text-2xs tabular-nums"
                                  style={{ color: message.from_me ? 'rgba(255,255,255,0.65)' : 'var(--erp-text-dim)' }}
                                >
                                  {hora(message.created_at)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t p-3" style={{ borderColor: 'var(--erp-border)' }}>
                  {/* O erro do envio fica junto do campo. No topo da página, atrás
                      de uma conversa rolada, ninguém via por que não enviou. */}
                  {sendError && <p className="mb-2 text-sm text-rose-700">{sendError}</p>}
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={campoRef}
                      value={reply}
                      rows={1}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendReply();
                        }
                      }}
                      placeholder="Escreva uma resposta. Enter envia, Shift+Enter quebra linha."
                      className="field max-h-32 flex-1 resize-none"
                      style={{ minHeight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={draftReply}
                      disabled={drafting}
                      title="Escrever um rascunho com a IA, para você revisar antes de enviar"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors hover:bg-[color:var(--erp-surface-2)] disabled:opacity-60"
                      style={{ borderColor: 'var(--erp-border)', color: 'var(--erp-violet)' }}
                    >
                      {drafting ? <Spinner size={16} /> : <Sparkles size={15} />}
                    </button>
                    <button
                      type="button"
                      onClick={sendReply}
                      disabled={sending || !reply.trim()}
                      aria-label="Enviar resposta"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl disabled:opacity-60"
                      style={{ background: 'var(--erp-violet)', color: '#fff' }}
                    >
                      {sending ? <Spinner size={16} /> : <Send size={15} />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
