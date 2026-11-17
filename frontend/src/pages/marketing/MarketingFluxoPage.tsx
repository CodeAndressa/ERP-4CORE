import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CalendarDays,
  Check,
  CheckCircle2,
  ExternalLink,
  Lightbulb,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { PageHeader } from '../../shared/components/layout';
import { Button } from '../../shared/components/ui/Button';
import { SeletorDeData } from '../../shared/components/ui/SeletorDeData';

/** Marketing como um fluxo, e não como dez telas.
 *
 *  Ideias, Esteira, Estúdio e Calendário eram quatro telas separadas que, na
 *  prática, são quatro momentos da mesma coisa: uma ideia vira peça, a peça
 *  espera aprovação, a aprovada vira agendada. Trocar de tela a cada passo
 *  obrigava a pessoa a guardar na cabeça em que ponto cada peça estava.
 *
 *  Aqui as quatro viram colunas, da esquerda para a direita na ordem em que o
 *  trabalho anda, e a peça atravessa o quadro. Aprovar acontece no próprio
 *  quadro, num painel lateral, porque aprovar é o que mais se faz e não deveria
 *  exigir sair do lugar.
 *
 *  As telas antigas continuam existindo e acessíveis pelo menu: esta reúne o
 *  caminho comum, e o que é específico de cada uma (feedback detalhado,
 *  exportar para o Canva, subir arte editada) segue morando lá, com link daqui.
 */

type Status =
  | 'draft' | 'generating' | 'awaiting_approval' | 'approved'
  | 'scheduled' | 'publishing' | 'published' | 'rejected' | 'failed';

type Content = {
  id: number;
  title: string;
  caption: string;
  headline: string;
  layout: 'feed' | 'story';
  status: Status;
  scheduled_at: string | null;
  art_ready: boolean;
  error_message: string;
  revision_notes: string;
  updated_at: string;
};

type Ideia = { title: string; pillar: string; objective: string; brief: string };
type Tema = { key: string; nome: string; ativo: boolean };
type Credits = { configured: boolean; error?: string | null; balance_usd?: number; posts_left?: number };

function erroDe(e: unknown, reserva: string) {
  const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return d || reserva;
}

/** A data no formato que o <input type="datetime-local"> aceita. */
function paraInput(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function dataCurta(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** A miniatura da arte, buscada só quando o cartão entra na tela.
 *
 *  A arte vem como blob autenticado, não como URL pública, então cada miniatura
 *  é uma requisição. Buscar as de todas as colunas de uma vez faria o quadro
 *  abrir disparando trinta downloads de imagem; o IntersectionObserver faz a
 *  coluna carregar conforme a pessoa chega nela. */
function Miniatura({ id, pronta, alt }: { id: number; pronta: boolean; alt: string }) {
  const [url, setUrl] = useState('');
  const caixa = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const alvo = caixa.current;
    if (!alvo || visivel) return;
    const olho = new IntersectionObserver(
      (entradas) => entradas.forEach((e) => e.isIntersecting && setVisivel(true)),
      { rootMargin: '200px' },
    );
    olho.observe(alvo);
    return () => olho.disconnect();
  }, [visivel]);

  useEffect(() => {
    if (!visivel || !pronta) return;
    let ativo = true;
    let criada = '';
    api
      .get(`/marketing/content/${id}/art`, { responseType: 'blob' })
      .then(({ data }) => {
        criada = URL.createObjectURL(data);
        if (ativo) setUrl(criada);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
      if (criada) URL.revokeObjectURL(criada);
    };
  }, [visivel, pronta, id]);

  return (
    <div
      ref={caixa}
      className="aspect-[4/5] w-full overflow-hidden rounded-xl"
      style={{ background: 'var(--erp-surface-2)' }}
    >
      {url ? (
        <img src={url} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center">
          {pronta ? (
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--erp-text-dim)' }} />
          ) : (
            <Sparkles size={16} style={{ color: 'var(--erp-text-dim)' }} />
          )}
        </div>
      )}
    </div>
  );
}

/** Uma coluna do fluxo. */
function Coluna({
  titulo,
  contagem,
  icone,
  destaque,
  acao,
  children,
}: {
  titulo: string;
  contagem: number;
  icone: React.ReactNode;
  destaque?: boolean;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-[260px] flex-1 flex-col rounded-2xl border" style={{ borderColor: destaque ? 'var(--erp-violet-soft)' : 'var(--erp-border)', background: 'var(--erp-surface)' }}>
      <header
        className="flex items-center justify-between gap-2 border-b px-3 py-2.5"
        style={{ borderColor: 'var(--erp-border)' }}
      >
        <span
          className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-widest"
          style={{ color: destaque ? 'var(--erp-violet)' : 'var(--erp-text-dim)' }}
        >
          {icone}
          {titulo}
        </span>
        <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--erp-text)' }}>
          {contagem}
        </span>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: '58vh' }}>
        {children}
      </div>
      {acao && <div className="border-t p-2" style={{ borderColor: 'var(--erp-border)' }}>{acao}</div>}
    </section>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <p className="px-2 py-6 text-center text-xs leading-relaxed" style={{ color: 'var(--erp-text-dim)' }}>
      {texto}
    </p>
  );
}

export default function MarketingFluxoPage() {
  const [items, setItems] = useState<Content[]>([]);
  const [ideias, setIdeias] = useState<Ideia[]>([]);
  const [temas, setTemas] = useState<Tema[]>([]);
  const [tema, setTema] = useState('');
  const [credits, setCredits] = useState<Credits | null>(null);
  const [ocupado, setOcupado] = useState('');
  const [abertaId, setAbertaId] = useState<number | null>(null);
  const [edicao, setEdicao] = useState({ caption: '', scheduled_at: '' });
  const [motivo, setMotivo] = useState('');
  const [pedindoAjuste, setPedindoAjuste] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const aberta = items.find((i) => i.id === abertaId) || null;

  // O que ja esta marcado no mesmo formato da peca aberta, para o calendario
  // mostrar onde nao cabe outra.
  const diasOcupados = useMemo(
    () =>
      items
        .filter(
          (i) =>
            i.scheduled_at &&
            i.id !== aberta?.id &&
            i.layout === aberta?.layout &&
            ['approved', 'scheduled', 'publishing', 'published', 'awaiting_approval'].includes(i.status),
        )
        .map((i) => ({ data: i.scheduled_at as string, titulo: i.headline || i.title })),
    [items, aberta?.id, aberta?.layout],
  );

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get<{ items: Content[] }>('/marketing/content');
      setItems(data.items ?? []);
    } catch (e) {
      toast.error(erroDe(e, 'Não foi possível carregar as peças.'));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    // Temas e saldo são apoio: falham em silêncio para não segurar o quadro.
    api.get<Tema[]>('/marketing/agent/themes').then((r) => setTemas(r.data)).catch(() => undefined);
    api.get<Credits>('/marketing/agent/credits').then((r) => setCredits(r.data)).catch(() => undefined);
  }, [carregar]);

  useEffect(() => {
    setEdicao({ caption: aberta?.caption || '', scheduled_at: paraInput(aberta?.scheduled_at) });
    setMotivo('');
    setPedindoAjuste(false);
  }, [aberta?.id]);

  const colunas = useMemo(() => {
    const por = (...s: Status[]) => items.filter((i) => s.includes(i.status));
    return {
      producao: por('draft', 'generating'),
      aprovar: por('awaiting_approval'),
      agendada: por('approved', 'scheduled', 'publishing').sort((a, b) =>
        String(a.scheduled_at).localeCompare(String(b.scheduled_at)),
      ),
      publicada: por('published'),
      problema: por('rejected', 'failed'),
    };
  }, [items]);

  async function gerarIdeias() {
    setOcupado('ideias');
    try {
      const { data } = await api.post<{ suggestions: Ideia[] }>('/marketing/content/topic-suggestions');
      setIdeias(data.suggestions ?? []);
      if (!data.suggestions?.length) toast('A IA não devolveu pauta nova desta vez.');
    } catch (e) {
      toast.error(erroDe(e, 'Não foi possível gerar ideias agora.'));
    } finally {
      setOcupado('');
    }
  }

  async function produzir(ideia: Ideia) {
    if (ocupado) return;
    setOcupado(`ideia-${ideia.title}`);
    try {
      await api.post(
        '/marketing/agent/run-from-idea',
        { title: ideia.title, brief: ideia.brief || ideia.title, pillar: ideia.pillar, objective: ideia.objective, theme: tema },
        // A esteira escreve, revisa, dirige a arte e gera a imagem: o padrão de
        // 30s do axios derrubaria a tela com a peça ainda sendo produzida.
        { timeout: 600000 },
      );
      setIdeias((lista) => lista.filter((i) => i.title !== ideia.title));
      await carregar();
      toast.success('Peça pronta, esperando sua aprovação.');
    } catch (e) {
      toast.error(erroDe(e, 'Não foi possível produzir a peça.'));
    } finally {
      setOcupado('');
    }
  }

  async function aprovar() {
    if (!aberta || !edicao.scheduled_at) return;
    setOcupado('aprovar');
    try {
      await api.patch(`/marketing/content/${aberta.id}`, { caption: edicao.caption });
      await api.post(`/marketing/content/${aberta.id}/approve`, {
        scheduled_at: new Date(edicao.scheduled_at).toISOString(),
      });
      setAbertaId(null);
      await carregar();
      toast.success('Aprovada e agendada.');
    } catch (e) {
      toast.error(erroDe(e, 'Não foi possível aprovar.'));
    } finally {
      setOcupado('');
    }
  }

  async function pedirAjuste() {
    if (!aberta || motivo.trim().length < 3) {
      toast.error('Escreva o que precisa mudar: é isso que a IA usa para refazer.');
      return;
    }
    setOcupado('ajuste');
    try {
      await api.post(`/marketing/content/${aberta.id}/reject`, { reason: motivo, aspects: [] });
      setAbertaId(null);
      await carregar();
      toast.success('Ajuste pedido. A peça volta para a fila.');
    } catch (e) {
      toast.error(erroDe(e, 'Não foi possível pedir o ajuste.'));
    } finally {
      setOcupado('');
    }
  }

  const temaAtivo = temas.find((t) => t.ativo);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Marketing"
        description="Da ideia à publicação, no mesmo lugar"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {temas.length > 0 && (
              <select
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                className="field !w-auto !py-1.5 text-xs"
                title="Tema sazonal das peças produzidas aqui. Automático usa a data de hoje."
              >
                <option value="">Tema automático{temaAtivo ? ` (${temaAtivo.nome})` : ''}</option>
                {temas.map((t) => (
                  <option key={t.key} value={t.key}>{t.nome}</option>
                ))}
              </select>
            )}
            <Link to="/marketing/agente">
              <Button variant="outline" size="sm" icon={<Brain size={14} />}>
                Esteira completa
              </Button>
            </Link>
          </div>
        }
      />

      {colunas.problema.length > 0 && (
        <Link
          to="/marketing/estudio"
          className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
          style={{ borderColor: 'var(--erp-rose-border)', background: 'var(--erp-rose-soft)' }}
        >
          <span className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--erp-rose)' }}>
            <AlertTriangle size={15} aria-hidden="true" />
            {colunas.problema.length} peça{colunas.problema.length > 1 ? 's' : ''} com falha ou ajuste pedido
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--erp-rose)' }}>
            Ver no Estúdio <ArrowRight size={13} />
          </span>
        </Link>
      )}

      {/* O quadro. Rola na horizontal no celular, que é o comportamento
          esperado de um fluxo com etapas: espremer quatro colunas em 360px
          deixaria cada cartão ilegível. */}
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        <Coluna
          titulo="Ideias"
          contagem={ideias.length}
          icone={<Lightbulb size={12} />}
          acao={
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              loading={ocupado === 'ideias'}
              onClick={() => void gerarIdeias()}
              icon={<Sparkles size={13} />}
            >
              Gerar ideias
            </Button>
          }
        >
          {ideias.length === 0 ? (
            <Vazio texto="Nenhuma ideia na mesa. Gere abaixo e escolha a que vira peça." />
          ) : (
            ideias.map((ideia) => (
              <div
                key={ideia.title}
                className="rounded-xl border p-2.5"
                style={{ borderColor: 'var(--erp-border)', background: 'var(--erp-surface-2)' }}
              >
                {ideia.pillar && (
                  <span className="text-2xs font-semibold uppercase tracking-wider" style={{ color: 'var(--erp-violet)' }}>
                    {ideia.pillar}
                  </span>
                )}
                <p className="mt-0.5 text-xs font-semibold leading-snug" style={{ color: 'var(--erp-text)' }}>
                  {ideia.title}
                </p>
                {ideia.brief && (
                  <p className="mt-1 line-clamp-2 text-2xs leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}>
                    {ideia.brief}
                  </p>
                )}
                <button
                  type="button"
                  disabled={!!ocupado}
                  onClick={() => void produzir(ideia)}
                  className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-2xs font-bold text-white disabled:opacity-60"
                  style={{ background: 'var(--erp-violet)' }}
                >
                  {ocupado === `ideia-${ideia.title}` ? (
                    <><Loader2 size={11} className="animate-spin" /> Produzindo</>
                  ) : (
                    <><ArrowRight size={11} /> Virar peça</>
                  )}
                </button>
              </div>
            ))
          )}
        </Coluna>

        <Coluna titulo="Em produção" contagem={colunas.producao.length} icone={<Sparkles size={12} />}>
          {colunas.producao.length === 0 ? (
            <Vazio texto="Nada sendo produzido agora." />
          ) : (
            colunas.producao.map((item) => (
              <div key={item.id} className="rounded-xl border p-2.5" style={{ borderColor: 'var(--erp-border)' }}>
                <p className="text-xs font-semibold leading-snug" style={{ color: 'var(--erp-text)' }}>{item.title}</p>
                <p className="mt-1 flex items-center gap-1 text-2xs" style={{ color: 'var(--erp-text-muted)' }}>
                  {item.status === 'generating' && <Loader2 size={10} className="animate-spin" />}
                  {item.status === 'generating' ? 'Gerando' : 'Rascunho'}
                </p>
              </div>
            ))
          )}
        </Coluna>

        <Coluna
          titulo="Para aprovar"
          contagem={colunas.aprovar.length}
          icone={<CheckCircle2 size={12} />}
          destaque
        >
          {colunas.aprovar.length === 0 ? (
            <Vazio texto="Nada esperando por você." />
          ) : (
            colunas.aprovar.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setAbertaId(item.id)}
                className="w-full rounded-xl border p-2 text-left transition-colors hover:bg-[color:var(--erp-surface-2)]"
                style={{ borderColor: abertaId === item.id ? 'var(--erp-violet)' : 'var(--erp-border)' }}
              >
                <Miniatura id={item.id} pronta={item.art_ready} alt={item.title} />
                <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-snug" style={{ color: 'var(--erp-text)' }}>
                  {item.headline || item.title}
                </p>
              </button>
            ))
          )}
        </Coluna>

        <Coluna titulo="Agendadas" contagem={colunas.agendada.length} icone={<CalendarDays size={12} />}>
          {colunas.agendada.length === 0 ? (
            <Vazio texto="Nenhuma peça na fila de publicação." />
          ) : (
            colunas.agendada.map((item) => (
              <div key={item.id} className="rounded-xl border p-2.5" style={{ borderColor: 'var(--erp-border)' }}>
                <p className="text-xs font-semibold leading-snug" style={{ color: 'var(--erp-text)' }}>
                  {item.headline || item.title}
                </p>
                <p className="mt-1 flex items-center gap-1 text-2xs tabular-nums" style={{ color: 'var(--erp-violet)' }}>
                  <CalendarDays size={10} />
                  {dataCurta(item.scheduled_at)}
                </p>
              </div>
            ))
          )}
        </Coluna>

        <Coluna titulo="Publicadas" contagem={colunas.publicada.length} icone={<Send size={12} />}>
          {colunas.publicada.length === 0 ? (
            <Vazio texto="Nada publicado ainda pelo ERP." />
          ) : (
            colunas.publicada.slice(0, 12).map((item) => (
              <div key={item.id} className="rounded-xl border p-2.5" style={{ borderColor: 'var(--erp-border)' }}>
                <p className="line-clamp-2 text-xs leading-snug" style={{ color: 'var(--erp-text-muted)' }}>
                  {item.headline || item.title}
                </p>
              </div>
            ))
          )}
        </Coluna>
      </div>

      {credits?.configured && !credits.error && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}>
          <span className="flex items-center gap-1.5">
            <Wallet size={13} style={{ color: 'var(--erp-violet)' }} />
            Saldo <strong style={{ color: 'var(--erp-text)' }}>US$ {(credits.balance_usd ?? 0).toFixed(2).replace('.', ',')}</strong>
          </span>
          <span>dá para <strong style={{ color: 'var(--erp-text)' }}>{credits.posts_left ?? 0} artes</strong></span>
        </div>
      )}

      {/* O painel de aprovação. Abre sobre o quadro em vez de levar a outra
          tela: aprovar é o que mais se faz, e sair do lugar a cada peça era o
          que tornava o trabalho picado. */}
      {aberta && (
        <div className="fixed inset-0 z-floating flex justify-end" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setAbertaId(null)}
            className="absolute inset-0"
            style={{ background: 'rgb(var(--erp-ink) / 0.45)' }}
          />
          <aside
            className="relative flex h-full w-full max-w-[460px] flex-col overflow-y-auto border-l"
            style={{ borderColor: 'var(--erp-border)', background: 'var(--erp-surface)' }}
          >
            <header
              className="sticky top-0 flex items-start justify-between gap-3 border-b px-4 py-3"
              style={{ borderColor: 'var(--erp-border)', background: 'var(--erp-surface)' }}
            >
              <div className="min-w-0">
                <p className="text-2xs font-semibold uppercase tracking-widest" style={{ color: 'var(--erp-violet)' }}>
                  Para aprovar
                </p>
                <h2 className="mt-0.5 text-sm font-bold leading-snug" style={{ color: 'var(--erp-text)' }}>
                  {aberta.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAbertaId(null)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-xl"
                style={{ color: 'var(--erp-text-muted)' }}
              >
                <X size={16} />
              </button>
            </header>

            <div className="space-y-4 p-4">
              <div className="mx-auto w-full max-w-[280px]">
                <Miniatura id={aberta.id} pronta={aberta.art_ready} alt={aberta.title} />
              </div>

              <label className="block">
                <span className="text-2xs font-semibold uppercase tracking-widest" style={{ color: 'var(--erp-text-muted)' }}>
                  Legenda
                </span>
                <textarea
                  value={edicao.caption}
                  onChange={(e) => setEdicao({ ...edicao, caption: e.target.value })}
                  rows={8}
                  className="field mt-1.5 resize-y"
                />
              </label>

              <label className="block">
                <span className="text-2xs font-semibold uppercase tracking-widest" style={{ color: 'var(--erp-text-muted)' }}>
                  Publicar em
                </span>
                {/* Os dias ocupados sao so os do MESMO formato. Post e story
                    sao filas separadas: ver os stories marcados enquanto se
                    agenda um post so atrapalha a decisao. */}
                <div className="mt-1.5">
                  <SeletorDeData
                    value={edicao.scheduled_at}
                    onChange={(valor) => setEdicao({ ...edicao, scheduled_at: valor })}
                    ocupados={diasOcupados}
                  />
                </div>
              </label>

              {pedindoAjuste ? (
                <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: 'var(--erp-amber-border)', background: 'var(--erp-amber-soft)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--erp-amber)' }}>
                    O que precisa mudar?
                  </p>
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={3}
                    placeholder="Ex.: a pessoa da foto não parece estar usando o aparelho"
                    className="field resize-y"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPedindoAjuste(false)}>
                      Cancelar
                    </Button>
                    <Button size="sm" loading={ocupado === 'ajuste'} onClick={() => void pedirAjuste()}>
                      Enviar o pedido
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    icon={<MessageSquarePlus size={14} />}
                    onClick={() => setPedindoAjuste(true)}
                  >
                    Pedir ajuste
                  </Button>
                  <Button
                    icon={<Check size={14} />}
                    loading={ocupado === 'aprovar'}
                    disabled={!edicao.scheduled_at}
                    onClick={() => void aprovar()}
                  >
                    Aprovar e agendar
                  </Button>
                </div>
              )}

              {/* O que é específico do Estúdio continua lá: feedback detalhado
                  por aspecto, exportar para o Canva, subir arte editada à mão.
                  Duplicar aquilo aqui seria manter duas versões da mesma coisa. */}
              <Link
                to="/marketing/estudio"
                className="flex items-center justify-center gap-1.5 text-xs font-semibold"
                style={{ color: 'var(--erp-violet)' }}
              >
                <ExternalLink size={12} />
                Abrir no Estúdio para editar a arte ou dar feedback
              </Link>
            </div>
          </aside>
        </div>
      )}

      {carregando && (
        <p className="text-center text-xs" style={{ color: 'var(--erp-text-dim)' }}>
          Carregando as peças...
        </p>
      )}
    </div>
  );
}
