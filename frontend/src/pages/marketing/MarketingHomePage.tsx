import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CalendarDays,
  CheckCircle2,
  Lightbulb,
  MessageCircle,
  Send,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { api } from '../../services/api';
import { PageHeader } from '../../shared/components/layout';
import { Button } from '../../shared/components/ui/Button';

/** A visão única de Marketing.
 *
 *  A área tinha dez telas e nenhuma porta de entrada: `/marketing` mandava direto
 *  para Mensagens, que é só uma das dez e nem é a principal. Quem abria a área
 *  caía no meio dela e tinha de lembrar sozinho em qual tela estava o quê.
 *
 *  O que esta tela faz é mostrar a esteira de conteúdo inteira como um caminho:
 *  ideia vira peça, peça espera aprovação, aprovada vira agendada, agendada vira
 *  publicada. Cada etapa é um número clicável que leva à tela daquela etapa, já
 *  no lugar certo. É a mesma informação que já existia, parada em telas
 *  diferentes, posta na ordem em que o trabalho acontece.
 *
 *  Nenhum endpoint novo: tudo aqui já era servido para alguma outra tela.
 */

type Content = { id: number; status: string; title: string; art_ready?: boolean; scheduled_at?: string | null };

type Coverage = {
  level: 'ok' | 'warning' | 'critical';
  message: string;
  in_next_7_days: number;
  awaiting_approval?: number;
  by_kind_next_7_days?: Record<string, number>;
  days_ahead: number;
};

type Credits = {
  configured: boolean;
  error?: string | null;
  balance_usd?: number;
  posts_left?: number;
  cost_per_content_usd?: number;
};

type Unread = { total: number };

function money(valor: number | undefined) {
  if (valor === undefined || valor === null) return '—';
  return `US$ ${valor.toFixed(2).replace('.', ',')}`;
}

/** Uma etapa do caminho do conteúdo.
 *
 *  O número é o conteúdo da célula, não um detalhe do rótulo: é ele que diz se
 *  há trabalho parado ali. Etapa vazia fica apagada em vez de sumir, porque
 *  "zero esperando aprovação" é informação, e some-la esconderia o caminho. */
function Etapa({
  icon,
  label,
  valor,
  detalhe,
  to,
  destaque,
}: {
  icon: React.ReactNode;
  label: string;
  valor: number;
  detalhe: string;
  to: string;
  destaque?: boolean;
}) {
  const vazia = valor === 0;
  return (
    <Link
      to={to}
      className="group flex min-w-0 flex-1 flex-col gap-2 rounded-2xl border px-4 py-4 transition-colors hover:bg-[color:var(--erp-surface-2)]"
      style={{
        borderColor: destaque && !vazia ? 'var(--erp-violet-soft)' : 'var(--erp-border)',
        background: destaque && !vazia ? 'var(--erp-violet-dim)' : 'var(--erp-surface)',
      }}
    >
      <span
        className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-widest"
        style={{ color: destaque && !vazia ? 'var(--erp-violet)' : 'var(--erp-text-dim)' }}
      >
        {icon}
        {label}
      </span>
      <span
        className="text-[2rem] font-bold leading-none tabular-nums tracking-tight"
        style={{ color: vazia ? 'var(--erp-text-dim)' : 'var(--erp-text)' }}
      >
        {valor}
      </span>
      <span className="text-xs leading-snug" style={{ color: 'var(--erp-text-muted)' }}>
        {detalhe}
      </span>
    </Link>
  );
}

export default function MarketingHomePage() {
  const [items, setItems] = useState<Content[]>([]);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [unread, setUnread] = useState<Unread | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    // Cada fonte cai sozinha. Uma tela que reúne seis origens não pode ficar em
    // branco porque a sexta falhou: o que respondeu já serve para decidir.
    const pega = <T,>(url: string, aoFalhar: T) =>
      api
        .get<T>(url)
        .then((r) => r.data)
        .catch(() => aoFalhar);

    const [conteudo, cobertura, saldo, naoLido] = await Promise.all([
      pega<{ items: Content[] }>('/marketing/content', { items: [] }),
      pega<Coverage | null>('/marketing/schedule-coverage', null),
      pega<Credits | null>('/marketing/agent/credits', null),
      pega<Unread | null>('/marketing/meta/instagram/unread', null),
    ]);

    setItems(conteudo.items ?? []);
    setCoverage(cobertura);
    setCredits(saldo);
    setUnread(naoLido);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const contagem = useMemo(() => {
    const por = (...status: string[]) => items.filter((item) => status.includes(item.status)).length;
    return {
      rascunho: por('draft', 'generating'),
      aprovar: por('awaiting_approval'),
      agendada: por('approved', 'scheduled', 'publishing'),
      publicada: por('published'),
      problema: por('rejected', 'failed'),
    };
  }, [items]);

  const pendencias = useMemo(() => {
    const lista: { tom: 'rose' | 'amber' | 'violet'; texto: string; acao: string; to: string }[] = [];

    if (contagem.aprovar > 0) {
      lista.push({
        tom: 'violet',
        texto: `${contagem.aprovar} peça${contagem.aprovar > 1 ? 's' : ''} pronta${contagem.aprovar > 1 ? 's' : ''} esperando sua aprovação`,
        acao: 'Abrir o Estúdio',
        to: '/marketing/estudio',
      });
    }
    if (contagem.problema > 0) {
      lista.push({
        tom: 'rose',
        texto: `${contagem.problema} peça${contagem.problema > 1 ? 's' : ''} com falha ou com ajuste pedido`,
        acao: 'Ver o que houve',
        to: '/marketing/estudio',
      });
    }
    if ((unread?.total ?? 0) > 0) {
      lista.push({
        tom: 'violet',
        texto: `${unread!.total} mensagem${unread!.total > 1 ? 's' : ''} nova${unread!.total > 1 ? 's' : ''} no direct`,
        acao: 'Responder',
        to: '/marketing/mensagens',
      });
    }
    if (coverage && coverage.level !== 'ok') {
      lista.push({ tom: 'amber', texto: coverage.message, acao: 'Ver o calendário', to: '/marketing/calendario' });
    }
    if (credits?.configured && !credits.error && (credits.posts_left ?? 0) <= 5) {
      lista.push({
        tom: 'amber',
        texto: `O saldo paga só mais ${credits.posts_left ?? 0} arte${(credits.posts_left ?? 0) === 1 ? '' : 's'}`,
        acao: 'Ver custos',
        to: '/marketing/agente',
      });
    }
    return lista;
  }, [contagem, unread, coverage, credits]);

  const tons = {
    rose: { borda: 'var(--erp-rose-border)', fundo: 'var(--erp-rose-soft)', texto: 'var(--erp-rose)' },
    amber: { borda: 'var(--erp-amber-border)', fundo: 'var(--erp-amber-soft)', texto: 'var(--erp-amber)' },
    violet: { borda: 'var(--erp-violet-soft)', fundo: 'var(--erp-violet-dim)', texto: 'var(--erp-violet)' },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing"
        description="Da ideia à publicação, numa leitura só"
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/marketing/planejamento">
              <Button variant="outline" size="sm" icon={<Lightbulb size={14} />}>
                Gerar ideias
              </Button>
            </Link>
            <Link to="/marketing/agente">
              <Button size="sm" icon={<Brain size={14} />}>
                Rodar a esteira
              </Button>
            </Link>
          </div>
        }
      />

      {/* O que exige uma pessoa agora, antes de qualquer número. Quem abre a área
          quer saber se tem algo parado esperando por ela, e isso estava
          espalhado por quatro telas diferentes. */}
      {pendencias.length > 0 && (
        <div className="space-y-2">
          {pendencias.map((item, i) => {
            const tom = tons[item.tom];
            return (
              <Link
                key={i}
                to={item.to}
                className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-opacity hover:opacity-90"
                style={{ borderColor: tom.borda, background: tom.fundo }}
              >
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium" style={{ color: tom.texto }}>
                  <AlertTriangle size={15} className="shrink-0" aria-hidden="true" />
                  {item.texto}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold" style={{ color: tom.texto }}>
                  {item.acao}
                  <ArrowRight size={13} />
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {pendencias.length === 0 && !carregando && (
        <div
          className="flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm"
          style={{ borderColor: 'var(--erp-emerald-border)', background: 'var(--erp-emerald-soft)', color: 'var(--erp-emerald)' }}
        >
          <CheckCircle2 size={15} aria-hidden="true" />
          Nada parado esperando você. A fila segue sozinha.
        </div>
      )}

      {/* O caminho do conteúdo, na ordem em que o trabalho acontece. */}
      <div>
        <p className="mb-3 text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>
          O caminho do conteúdo
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {/* Não há etapa de "ideias no banco": o Banco de Ideias não guarda
              nada, ele gera sob demanda. Um contador ali mostraria zero para
              sempre e sugeriria uma fila que não existe. Gerar ideia é ação, e
              está no botão do cabeçalho. */}
          <Etapa
            icon={<Sparkles size={12} />}
            label="Em produção"
            valor={contagem.rascunho}
            detalhe="Rascunho ou sendo gerada"
            to="/marketing/estudio"
          />
          <Etapa
            icon={<CheckCircle2 size={12} />}
            label="Para aprovar"
            valor={contagem.aprovar}
            detalhe="Depende de você para seguir"
            to="/marketing/estudio"
            destaque
          />
          <Etapa
            icon={<CalendarDays size={12} />}
            label="Agendadas"
            valor={contagem.agendada}
            detalhe={
              coverage
                ? `Agenda coberta por ${coverage.days_ahead.toFixed(0)} dia${coverage.days_ahead >= 2 ? 's' : ''}`
                : 'Aprovadas e na fila'
            }
            to="/marketing/calendario"
          />
          <Etapa
            icon={<Send size={12} />}
            label="Publicadas"
            valor={contagem.publicada}
            detalhe="Já foram ao ar"
            to="/marketing/posts"
          />
        </div>
      </div>

      {/* A conta, em uma linha. Ela mora na Esteira, que é a tela de rodar, não a
          de decidir se dá para rodar. */}
      {credits?.configured && !credits.error && (
        <div
          className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border px-4 py-3 text-sm"
          style={{ borderColor: 'var(--erp-border)', background: 'var(--erp-surface-2)' }}
        >
          <span className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--erp-text-muted)' }}>
            <Wallet size={14} style={{ color: 'var(--erp-violet)' }} aria-hidden="true" />
            Saldo
          </span>
          <span className="font-bold tabular-nums" style={{ color: 'var(--erp-text)' }}>
            {money(credits.balance_usd)}
          </span>
          <span style={{ color: 'var(--erp-text-muted)' }}>
            dá para <strong style={{ color: 'var(--erp-text)' }}>{credits.posts_left ?? 0} artes</strong>, a{' '}
            {money(credits.cost_per_content_usd)} cada
          </span>
          <Link
            to="/marketing/conexoes"
            className="ml-auto flex items-center gap-1 text-xs font-semibold"
            style={{ color: 'var(--erp-violet)' }}
          >
            <MessageCircle size={12} />
            Conexões
          </Link>
        </div>
      )}
    </div>
  );
}
