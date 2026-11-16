import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  ExternalLink,
  Eye,
  Lightbulb,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { api } from '../../services/api';
import { Button, Card, CardHeader, EmptyState, Input } from '../../shared/components/ui';
import { PageHeader } from '../../shared/components/layout';
import { AGENT_SPRITES, SPRITE_H, SPRITE_PALETTE, SPRITE_W } from './agentSprites';

interface Competitor {
  id: number;
  username: string;
  display_name: string;
  notes: string;
  active: boolean;
  followers_count: number;
  media_count: number;
  last_synced_at: string | null;
  last_error: string;
}

interface ProfileMetrics {
  username?: string;
  display_name?: string;
  followers_count?: number;
  media_count?: number;
  posts_analyzed?: number;
  posts_per_week?: number;
  avg_likes?: number;
  avg_comments?: number;
  engagement_rate?: number;
  engagement_from_history?: boolean;
  engagement_sample?: number;
  last_post_at?: string | null;
  days_since_last_post?: number | null;
  is_silent?: boolean;
  top_hashtags?: string[];
  top_posts?: {
    caption: string;
    media_type: string;
    like_count: number;
    comments_count: number;
    permalink: string | null;
  }[];
}

interface CompetitorMetrics extends ProfileMetrics {
  id: number;
  username: string;
  last_error: string;
}

interface Benchmark {
  window_days: number;
  own: ProfileMetrics;
  own_error: string;
  competitors: CompetitorMetrics[];
  market: {
    competitors_tracked: number;
    avg_engagement_rate: number;
    avg_posts_per_week: number;
    own_position: number | null;
    ranking_size: number;
    engagement_gap: number;
    cadence_gap: number;
  };
}

interface Diagnosis {
  leitura: string;
  pontos_fortes: string[];
  lacunas: string[];
  recomendacoes: { acao: string; motivo: string }[];
  pautas: { title: string; pillar: string; objective: string; brief: string; por_que_agora: string }[];
  sem_ia?: boolean;
}

interface Step {
  id: number;
  agent: string;
  sequence: number;
  status: string;
  content_id: number | null;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  images: number;
  cost_usd: number;
  cost_measured: boolean;
  duration_ms: number;
  summary: string;
  error_message: string;
}

interface Costs {
  cost_usd: number;
  // O que o provedor de fato cobra. Groq e Cloudflare dentro da franquia somam
  // custo estimado mas nao geram fatura, por isso os dois numeros existem.
  billed_usd: number;
  free_tier_only: boolean;
  input_tokens: number;
  output_tokens: number;
  images: number;
  fully_measured: boolean;
  duration_ms: number;
}

interface CreatedContent {
  content_id: number;
  title: string;
  status: string;
  // Pilar e nota do revisor so existem na resposta da rodada ao vivo. Ao abrir
  // uma rodada do historico eles nao vem, porque nao ficam gravados na peca.
  pillar?: string;
  error?: string;
  scheduled_at?: string | null;
  review?: { nota: number; aprovado: boolean; problemas: string[] };
}

interface Schedule {
  hour: number;
  measured: boolean;
  cadence_days: number;
  reason: string;
  slots: string[];
}

interface RunResult {
  id: number;
  status: string;
  // "done" diz so que o pipeline terminou de rodar, nao que entregou peca.
  // Quem conta a verdade da rodada e runOutcome(), lendo estes dois campos.
  error_message: string;
  created_content_ids: number[];
  started_at: string | null;
  finished_at: string | null;
  benchmark: Benchmark;
  diagnosis: Diagnosis;
  created: CreatedContent[];
  steps: Step[];
  costs: Costs;
  schedule: Schedule;
}

interface RunSummary {
  id: number;
  status: string;
  trigger: string;
  leitura: string;
  pautas_count: number;
  created_content_ids: number[];
  error_message: string;
  started_at: string | null;
}

interface AgentInfo {
  key: string;
  name: string;
  role: string;
}

/** O saldo da conta que paga a arte.
 *
 *  `posts_left` e a conta que a tela nao fazia: saldo sozinho nao responde
 *  "da para rodar quantas vezes", porque ninguem sabe de cabeca quanto custa
 *  uma peca. */
interface Credits {
  configured: boolean;
  error?: string | null;
  balance_usd?: number;
  total_usd?: number;
  used_usd?: number;
  cost_per_content_usd?: number;
  cost_measured?: boolean;
  posts_left?: number;
}

interface CostDashboard {
  window_days: number;
  total_usd: number;
  runs_done: number;
  content_produced: number;
  cost_per_content_usd: number;
  by_agent: { agent: string; cost_usd: number; calls: number; duration_ms: number; measured: boolean }[];
  roster: AgentInfo[];
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  generating: 'Em produção',
  awaiting_approval: 'Aguardando sua aprovação',
  approved: 'Aprovada',
  scheduled: 'Agendada',
  published: 'Publicada',
  failed: 'Falhou',
};

function formatNumber(value: number | undefined) {
  return (value ?? 0).toLocaleString('pt-BR');
}

function formatUsd(value: number | undefined) {
  const amount = value ?? 0;
  // Centavo de dolar some com duas casas: uma rodada inteira custa menos que US$ 0,05.
  return amount > 0 && amount < 0.01 ? `US$ ${amount.toFixed(4)}` : `US$ ${amount.toFixed(2)}`;
}

function formatDuration(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'nunca';
  return new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function errorMessage(err: unknown, fallback: string) {
  const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return typeof detail === 'string' && detail ? detail : fallback;
}

/** Os quatro estados de um agente na trilha.
 *
 *  Cada estado carrega icone, palavra e cor. A cor nunca anda sozinha: quem nao
 *  distingue verde de vermelho continua lendo "parou" ao lado do triangulo. */
const STEP_STATE = {
  done: { Icon: Check, label: 'concluído', node: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  running: { Icon: Loader2, label: 'rodando', node: 'border-violet-200 bg-violet-50 text-violet-700' },
  failed: { Icon: AlertTriangle, label: 'parou aqui', node: 'border-rose-200 bg-rose-50 text-rose-700' },
  idle: { Icon: Minus, label: 'em espera', node: 'border-[color:var(--erp-border)] bg-[color:var(--erp-surface-2)] text-[color:var(--erp-text-dim)]' },
} as const;

type StepState = keyof typeof STEP_STATE;

function stepState(mine: Step[]): StepState {
  if (mine.some((step) => step.status === 'failed')) return 'failed';
  if (mine.some((step) => step.status === 'running')) return 'running';
  return mine.length > 0 ? 'done' : 'idle';
}

/** O desenho do agente, em pixel art.
 *
 *  Vai num canvas de 20x16 ampliado por CSS com `image-rendering: pixelated`,
 *  e nao num SVG com 320 retangulos por agente: oito agentes em tela dariam
 *  2.560 nos para desenhar o que o canvas resolve em oito bitmaps. */
function AgentSprite({ agentKey, frame, scale = 2 }: { agentKey: string; frame: 0 | 1; scale?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const alvo = canvas.current;
    const ctx = alvo?.getContext('2d');
    if (!alvo || !ctx) return;
    ctx.clearRect(0, 0, SPRITE_W, SPRITE_H);
    const quadros = AGENT_SPRITES[agentKey];
    const linhas = quadros?.[frame] ?? quadros?.[0];
    if (!linhas) return;
    linhas.forEach((linha, y) => {
      for (let x = 0; x < linha.length; x += 1) {
        const cor = SPRITE_PALETTE[linha[x]];
        if (!cor) continue;
        ctx.fillStyle = cor;
        ctx.fillRect(x, y, 1, 1);
      }
    });
  }, [agentKey, frame]);

  return (
    <canvas
      ref={canvas}
      width={SPRITE_W}
      height={SPRITE_H}
      aria-hidden="true"
      style={{ imageRendering: 'pixelated', width: SPRITE_W * scale, height: SPRITE_H * scale }}
    />
  );
}

/** Um no do fluxograma: o desenho do agente, a marca do estado e o nome curto.
 *
 *  O nome completo, o resumo, o tempo e o custo ficam no `title`, porque oito
 *  nos com quatro linhas de texto cada deixam de ser um fluxo e voltam a ser a
 *  lista que isto substituiu. */
function FlowNode({ agent, steps, index }: { agent: AgentInfo; steps: Step[]; index: number }) {
  const mine = steps.filter((step) => step.agent === agent.key);
  const state = stepState(mine);
  const { label, node, Icon } = STEP_STATE[state];

  const cost = mine.reduce((sum, step) => sum + step.cost_usd, 0);
  const duration = mine.reduce((sum, step) => sum + step.duration_ms, 0);

  // O quadro alterna enquanto o agente trabalha; parado, fica no primeiro.
  const [frame, setFrame] = useState<0 | 1>(0);
  useEffect(() => {
    if (state !== 'running') {
      setFrame(0);
      return;
    }
    const relogio = window.setInterval(() => setFrame((atual) => (atual === 0 ? 1 : 0)), 420);
    return () => window.clearInterval(relogio);
  }, [state]);

  const curto = agent.name.split(' ')[0];
  const detalhe = [
    agent.name,
    mine[0]?.summary || agent.role,
    mine.length > 0 ? `${formatDuration(duration)}${cost > 0 ? ` - ${formatUsd(cost)}` : ''}` : label,
  ].join('\n');

  return (
    <li className="flex min-w-0 shrink-0 flex-col items-center gap-1.5" title={detalhe}>
      <div className={`relative grid h-[52px] w-[52px] place-items-center rounded-xl border transition-colors ${node}`}>
        <AgentSprite agentKey={agent.key} frame={frame} />
        <span
          className={`absolute -right-1.5 -top-1.5 grid h-[18px] w-[18px] place-items-center rounded-full border-2 ${node}`}
          style={{ borderColor: 'var(--erp-surface)' }}
        >
          <Icon size={10} className={state === 'running' ? 'animate-spin' : ''} aria-hidden="true" />
        </span>
      </div>
      <p className="max-w-[64px] truncate text-center text-2xs font-semibold" style={{ color: 'var(--erp-text)' }}>
        <span className="tabular-nums" style={{ color: 'var(--erp-text-dim)' }}>{index + 1}</span> {curto}
      </p>
      <span className="sr-only">{label}</span>
    </li>
  );
}

/** O fluxo inteiro numa faixa, com a seta entre um agente e o proximo.
 *
 *  A seta acende quando o passo anterior concluiu: e ela que mostra onde a
 *  rodada chegou, sem precisar de uma barra de progresso separada. */
function AgentFlow({ roster, steps }: { roster: AgentInfo[]; steps: Step[] }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <ol className="m-0 flex list-none items-start gap-1 p-0 lg:gap-0">
        {roster.map((agent, index) => {
          const anterior = index > 0 ? stepState(steps.filter((step) => step.agent === roster[index - 1].key)) : null;
          return (
            <Fragment key={agent.key}>
              {index > 0 && (
                <li aria-hidden="true" className="mt-[26px] flex min-w-[20px] flex-1 items-center lg:min-w-0">
                  <span
                    className="h-px w-full"
                    style={{ background: anterior === 'done' ? 'var(--erp-violet)' : 'var(--erp-border)' }}
                  />
                  <ChevronRight
                    size={12}
                    className="-ml-1 shrink-0"
                    style={{ color: anterior === 'done' ? 'var(--erp-violet)' : 'var(--erp-border-strong)' }}
                  />
                </li>
              )}
              <FlowNode agent={agent} steps={steps} index={index} />
            </Fragment>
          );
        })}
      </ol>
    </div>
  );
}

/** Um numero da esteira em pilula, no lugar do cartao de metrica.
 *
 *  O detalhe que o cartao mostrava embaixo vira `title`, e a comparacao com o
 *  mercado continua visivel na propria pilula quando existe. */
function StatPill({
  label,
  value,
  detail,
  icon,
  trend,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: ReactNode;
  trend?: number;
  tone?: 'neutral' | 'emerald' | 'rose' | 'cyan';
}) {
  const cor =
    tone === 'emerald'
      ? 'var(--erp-emerald)'
      : tone === 'rose'
        ? 'var(--erp-rose)'
        : tone === 'cyan'
          ? 'var(--erp-cyan)'
          : 'var(--erp-violet)';

  return (
    <div
      className="pill border !py-1.5 !pl-2.5 !pr-3"
      style={{ borderColor: 'var(--erp-border)', background: 'var(--erp-surface)' }}
      title={detail}
    >
      {icon && <span style={{ color: cor }}>{icon}</span>}
      <span className="font-medium" style={{ color: 'var(--erp-text-muted)' }}>{label}</span>
      <span className="font-bold tabular-nums" style={{ color: 'var(--erp-text)' }}>{value}</span>
      {typeof trend === 'number' && trend !== 0 && (
        <span
          className="inline-flex items-center gap-0.5 tabular-nums"
          style={{ color: trend > 0 ? 'var(--erp-emerald)' : 'var(--erp-rose)' }}
        >
          {trend > 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
          {Math.abs(trend)}
        </span>
      )}
    </div>
  );
}

/** O que a rodada de fato entregou.
 *
 *  A rodada se marca como "done" mesmo quando um agente falhou e nenhuma peca
 *  saiu, porque o pipeline terminou de rodar. Repetir essa palavra na tela fazia
 *  a esteira parecer bem-sucedida numa rodada que nao produziu nada. */
function runOutcome(result: RunResult | null, agentNames: Record<string, string>) {
  if (!result) return null;
  const steps = result.steps ?? [];
  const broke = steps.find((step) => step.status === 'failed');
  const pieces = result.created_content_ids?.length ?? 0;

  if (broke) {
    const name = agentNames[broke.agent] ?? broke.agent;
    return {
      tone: 'rose' as const,
      title: pieces > 0 ? `Parou no ${name}, com ${pieces} peça${pieces > 1 ? 's' : ''} salva${pieces > 1 ? 's' : ''}` : `Parou no ${name}`,
      detail: broke.error_message || 'O passo não foi concluído.',
    };
  }
  if (pieces === 0) {
    return {
      tone: 'amber' as const,
      title: 'Rodada sem peça nova',
      detail: 'A leitura e as pautas foram geradas, mas nenhuma peça chegou ao fim.',
    };
  }
  return {
    tone: 'emerald' as const,
    title: `${pieces} peça${pieces > 1 ? 's' : ''} esperando sua aprovação`,
    detail: 'A esteira não publica. Revise o texto e a arte antes de liberar.',
  };
}

export default function AgenteIaPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [roster, setRoster] = useState<AgentInfo[]>([]);
  const [dashboard, setDashboard] = useState<CostDashboard | null>(null);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  // Pecas que esperam aprovacao, de qualquer rodada. A esteira produz e para
  // aqui; sem este numero a tela nao dizia onde o trabalho dela foi parar.
  const [awaiting, setAwaiting] = useState(0);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [running, setRunning] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [newHandle, setNewHandle] = useState('');

  const [contentLimit, setContentLimit] = useState(3);
  const [withArt, setWithArt] = useState(true);
  const [cadenceDays, setCadenceDays] = useState(2);

  const loadAll = useCallback(async () => {
    setError('');
    try {
      const [competitorsRes, benchmarkRes, runsRes, rosterRes, costsRes, contentRes] = await Promise.all([
        api.get<Competitor[]>('/marketing/agent/competitors'),
        api.get<Benchmark>('/marketing/agent/benchmark'),
        api.get<RunSummary[]>('/marketing/agent/runs', { params: { limit: 10 } }),
        api.get<AgentInfo[]>('/marketing/agent/roster'),
        api.get<CostDashboard>('/marketing/agent/costs'),
        // Contador de apoio: se o Estudio estiver fora, a esteira continua
        // abrindo. Por isso ele absorve o proprio erro em vez de entrar no
        // Promise.all cru, que derrubaria a tela toda.
        api
          .get<{ items: { status: string }[] }>('/marketing/content')
          .then((res) => res.data.items ?? [])
          .catch(() => [] as { status: string }[]),
      ]);
      setCompetitors(competitorsRes.data);
      setBenchmark(benchmarkRes.data);
      setRuns(runsRes.data);
      setRoster(rosterRes.data);
      setDashboard(costsRes.data);
      setAwaiting(contentRes.filter((item) => item.status === 'awaiting_approval').length);
      // O saldo vem depois e por fora: o OpenRouter estar fora do ar nao pode
      // impedir a esteira de abrir, so de mostrar quanto sobrou.
      api
        .get<Credits>('/marketing/agent/credits')
        .then((res) => setCredits(res.data))
        .catch(() => setCredits(null));
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível carregar o painel da esteira.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function addCompetitor() {
    if (!newHandle.trim()) return;
    setAdding(true);
    setError('');
    try {
      const { data } = await api.post<Competitor>('/marketing/agent/competitors', { username: newHandle });
      setNewHandle('');
      await api.post(`/marketing/agent/competitors/${data.id}/sync`);
      await loadAll();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível adicionar esse perfil.'));
    } finally {
      setAdding(false);
    }
  }

  async function removeCompetitor(id: number) {
    try {
      await api.delete(`/marketing/agent/competitors/${id}`);
      await loadAll();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível remover esse perfil.'));
    }
  }

  async function syncCompetitors() {
    setSyncing(true);
    setError('');
    try {
      await api.post('/marketing/agent/competitors/sync');
      await loadAll();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível atualizar os concorrentes.'));
    } finally {
      setSyncing(false);
    }
  }

  async function runPipeline() {
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const { data } = await api.post<RunResult>(
        '/marketing/agent/run',
        { content_limit: contentLimit, with_art: withArt, layout: 'feed', cadence_days: cadenceDays },
        // Sete agentes em sequência, com geração de imagem no meio. O timeout padrão
        // de 30s do axios derrubaria a tela com a esteira ainda rodando no backend.
        { timeout: 600000 },
      );
      setResult(data);
      setBenchmark(data.benchmark);
      await loadAll();
    } catch (err) {
      setError(errorMessage(err, 'A esteira não pôde ser concluída.'));
      await loadAll();
    } finally {
      setRunning(false);
    }
  }

  async function openRun(runId: number) {
    try {
      const { data } = await api.get<RunResult>(`/marketing/agent/runs/${runId}`);
      setResult(data);
      if (data.benchmark) setBenchmark(data.benchmark);
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível abrir essa rodada.'));
    }
  }

  const own = benchmark?.own;
  const market = benchmark?.market;
  const steps = result?.steps ?? [];

  const ranked = useMemo(() => {
    if (!benchmark) return [];
    const rows: (ProfileMetrics & { id: string; isOwn: boolean; error?: string })[] = benchmark.competitors.map((item) => ({
      ...item,
      id: `c-${item.id}`,
      isOwn: false,
      error: item.last_error,
    }));
    if (own?.username) rows.push({ ...own, id: 'own', isOwn: true });
    return rows.sort((a, b) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0));
  }, [benchmark, own]);

  const agentNames = useMemo(
    () => Object.fromEntries(roster.map((agent) => [agent.key, agent.name])),
    [roster],
  );

  const outcome = useMemo(() => runOutcome(result, agentNames), [result, agentNames]);
  const quebras = useMemo(
    () => steps.filter((step) => step.status === 'failed' && step.error_message),
    [steps],
  );

  if (loading) {
    return <p className="p-6 text-sm text-[color:var(--erp-text-muted)]">Carregando a área de marketing...</p>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Marketing"
        title="Esteira de conteúdo"
        description="Sete agentes em sequência, da leitura dos concorrentes à peça agendada"
        aiModule="Esteira de marketing"
        action={
          <Button icon={<Bot size={14} />} loading={running} onClick={runPipeline} disabled={!competitors.length}>
            Rodar esteira
          </Button>
        }
      />

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {benchmark?.own_error && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            {benchmark.own_error}{' '}
            <Link to="/marketing/conexoes" className="font-semibold underline">Abrir Conexões</Link>
          </span>
        </div>
      )}

      {/* A esteira fica no topo porque e o que a pessoa quer olhar enquanto roda. */}
      <Card padding="lg">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>
              {result ? `Execução ${result.id}` : 'Esteira de conteúdo'}
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--erp-text-muted)' }}>
              {result
                ? `${formatDate(result.started_at)} · ${formatDuration(result.costs?.duration_ms ?? 0)}`
                : 'Sete agentes em sequência. Nenhuma rodada ainda.'}
            </p>
          </div>
          {result && (
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--erp-text)' }}>
                {formatUsd(result.costs?.cost_usd)}
              </p>
              <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                {result.costs?.fully_measured ? 'custo medido' : 'custo estimado'}
              </p>
            </div>
          )}
        </div>

        {outcome && (
          <div
            className={`mb-5 rounded-xl border px-4 py-3 ${
              outcome.tone === 'emerald'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : outcome.tone === 'amber'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            <p className="text-sm font-semibold">{outcome.title}</p>
            <p className="mt-0.5 text-sm">{outcome.detail}</p>
          </div>
        )}

        {running && (
          <p className="mb-4 flex items-center gap-2 text-sm" style={{ color: 'var(--erp-text-muted)' }}>
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            Produzindo. Cada peça passa por redação, revisão, direção de arte e ilustração.
          </p>
        )}

        <AgentFlow roster={roster} steps={steps} />

        {/* O motivo da parada fica inteiro, fora do no. Dentro do quadradinho de
            52px ele viraria texto de 9px, que e onde ninguem ia ler. */}
        {quebras.length > 0 && (
          <ul className="mt-4 m-0 list-none space-y-1.5 p-0">
            {quebras.map((quebra) => (
              <li key={quebra.agent} className="flex gap-2 text-sm text-rose-700">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  <strong>{agentNames[quebra.agent] ?? quebra.agent}:</strong> {quebra.error_message}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Onde o trabalho da esteira foi parar. Fica no fim da trilha de proposito:
            o ultimo agente agenda, e a peca passa a esperar uma pessoa. Sem esta
            linha a tela terminava sem dizer para onde ir. */}
        {awaiting > 0 && (
          <div
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
            style={{ borderColor: 'var(--erp-border)', background: 'var(--erp-surface-2)' }}
          >
            <p className="text-sm" style={{ color: 'var(--erp-text)' }}>
              <strong>{awaiting} peça{awaiting > 1 ? 's' : ''}</strong> esperando sua aprovação.{' '}
              <span style={{ color: 'var(--erp-text-muted)' }}>
                A esteira não publica: revise texto e arte antes de liberar.
              </span>
            </p>
            <Link to="/marketing/estudio">
              <Button variant="outline" size="sm" iconRight={<ArrowRight size={14} />}>
                Abrir Estúdio
              </Button>
            </Link>
          </div>
        )}

        {result?.schedule?.reason && (
          <p
            className="mt-4 border-t pt-4 text-sm"
            style={{ borderColor: 'var(--erp-border)', color: 'var(--erp-text-muted)' }}
          >
            <span className="font-semibold" style={{ color: 'var(--erp-text)' }}>Agendamento. </span>
            {result.schedule.reason}
            {!result.schedule.measured && ' O horário ainda é o padrão, não medido no seu histórico.'}
          </p>
        )}
      </Card>

      {own?.is_silent && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            <strong>O @{own.username} está sem publicar há {own.days_since_last_post} dias.</strong>{' '}
            A última publicação foi em {formatDate(own.last_post_at)}. Enquanto isso, cadência aparece como zero
            e a taxa de engajamento vem das {own.engagement_sample} publicações anteriores, como referência
            histórica, não como desempenho atual.
          </span>
        </div>
      )}

      {/* Cinco numeros curtos numa linha, nao numa grade de cinco caixas. O que
          o cartao mostrava embaixo (a janela, a base, a media do mercado) virou
          o title de cada pilula, e a comparacao ficou na propria pilula. */}
      <div className="flex flex-wrap items-center gap-2">
        {credits?.configured && !credits.error && (
          <StatPill
            label="Saldo"
            value={formatUsd(credits.balance_usd)}
            detail={`De US$ ${(credits.total_usd ?? 0).toFixed(2)} comprados, US$ ${(credits.used_usd ?? 0).toFixed(2)} já usados.`}
            icon={<Wallet size={13} />}
            tone={(credits.posts_left ?? 0) <= 5 ? 'rose' : 'emerald'}
          />
        )}
        {credits?.configured && !credits.error && (credits.posts_left ?? 0) >= 0 && (
          <StatPill
            label="Dá para"
            value={`${credits.posts_left ?? 0} peça${(credits.posts_left ?? 0) === 1 ? '' : 's'}`}
            detail={
              credits.cost_measured
                ? `A ${formatUsd(credits.cost_per_content_usd)} por arte, que é o que o OpenRouter cobrou nas artes já geradas. Os agentes de texto rodam no Groq e não consomem este saldo.`
                : `A ${formatUsd(credits.cost_per_content_usd)} por arte, pela tabela de preços: nenhuma arte foi gerada no OpenRouter ainda para medir.`
            }
            icon={<Bot size={13} />}
            tone={(credits.posts_left ?? 0) <= 5 ? 'rose' : 'neutral'}
          />
        )}
        <StatPill
          label="Custo no período"
          value={formatUsd(dashboard?.total_usd)}
          detail={`${dashboard?.runs_done ?? 0} rodadas em ${dashboard?.window_days ?? 90} dias`}
          icon={<DollarSign size={13} />}
          tone="emerald"
        />
        <StatPill
          label="Por peça"
          value={formatUsd(dashboard?.cost_per_content_usd)}
          detail={`${dashboard?.content_produced ?? 0} peças produzidas. A arte costuma pesar mais que todos os agentes de texto somados.`}
          tone="cyan"
        />
        <StatPill
          label="Engajamento"
          value={`${own?.engagement_rate ?? 0}%`}
          detail={
            own?.engagement_from_history
              ? `Histórico, sem posts na janela. Média do mercado: ${market?.avg_engagement_rate ?? 0}%`
              : `Média do mercado: ${market?.avg_engagement_rate ?? 0}%`
          }
          trend={market?.engagement_gap}
          icon={<TrendingUp size={13} />}
          tone={(market?.engagement_gap ?? 0) >= 0 ? 'emerald' : 'rose'}
        />
        <StatPill
          label="Posts por semana"
          value={String(own?.posts_per_week ?? 0)}
          detail={
            own?.is_silent
              ? `Parado há ${own.days_since_last_post} dias. Média do mercado: ${market?.avg_posts_per_week ?? 0}`
              : `Média do mercado: ${market?.avg_posts_per_week ?? 0}`
          }
          trend={market?.cadence_gap}
          tone={(market?.cadence_gap ?? 0) >= 0 ? 'emerald' : 'rose'}
        />
        <StatPill
          label="Ranking"
          value={market?.own_position ? `${market.own_position}º` : '-'}
          detail={`Entre ${market?.ranking_size ?? 0} perfis observados`}
        />
      </div>

      {!!dashboard?.by_agent.length && (
        <Card>
          <CardHeader title="Custo por agente" subtitle="Onde o dinheiro vai dentro da esteira" />
          <div className="space-y-2">
            {dashboard.by_agent.map((row) => {
              const share = dashboard.total_usd > 0 ? (row.cost_usd / dashboard.total_usd) * 100 : 0;
              return (
                <div key={row.agent} className="flex items-center gap-3">
                  <p className="w-40 shrink-0 truncate text-xs text-[color:var(--erp-text)]">{agentNames[row.agent] ?? row.agent}</p>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(share, row.cost_usd > 0 ? 2 : 0)}%`, background: 'var(--erp-violet)' }} />
                  </div>
                  <p className="w-24 shrink-0 text-right text-xs tabular-nums text-[color:var(--erp-text)]">
                    {formatUsd(row.cost_usd)}{!row.measured && row.cost_usd > 0 && '*'}
                  </p>
                  <p className="w-16 shrink-0 text-right text-xs tabular-nums text-[color:var(--erp-text-muted)]">{row.calls}x</p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-[color:var(--erp-text-muted)]">
            O asterisco marca custo estimado pela tabela de preços. Com OPENROUTER_API_KEY configurada, o provedor
            devolve o valor real de cada chamada e o número deixa de ser estimativa.
          </p>
        </Card>
      )}

      {!!result?.created?.length && (
        <Card>
          <CardHeader
            title="Peças desta rodada"
            subtitle="Aguardando sua aprovação no Estúdio, com data e hora já sugeridas"
            action={
              <Link to="/marketing/estudio">
                <Button variant="outline" size="sm" iconRight={<ArrowRight size={14} />}>Abrir Estúdio</Button>
              </Link>
            }
          />
          <ul className="space-y-2">
            {result.created.map((item) => (
              <li key={item.content_id} className="rounded-xl border border-violet-50 px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[color:var(--erp-text-muted)]">
                      {item.pillar && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">{item.pillar}</span>}
                      <span>{STATUS_LABEL[item.status] ?? item.status}</span>
                      {item.scheduled_at && <span className="inline-flex items-center gap-1"><Clock size={11} />{formatDate(item.scheduled_at)}</span>}
                    </p>
                  </div>
                  {item.review?.nota != null && (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{
                        background: item.review.nota >= 8 ? '#ecfdf5' : '#fffbeb',
                        color: item.review.nota >= 8 ? '#065f46' : '#92400e',
                      }}
                      title="Nota dada pelo revisor de texto"
                    >
                      revisão {item.review.nota.toFixed(0)}/10
                    </span>
                  )}
                </div>
                {!!item.review?.problemas?.length && (
                  <p className="mt-1.5 text-xs text-[color:var(--erp-text-muted)]">
                    Corrigido pelo revisor: {item.review.problemas.join('. ')}
                  </p>
                )}
                {item.error && <p className="mt-1 text-xs text-rose-600">{item.error}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {result?.diagnosis && (
        <Card>
          <CardHeader title="Leitura do estrategista" />
          {result.diagnosis.sem_ia && (
            <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Sem chave de modelo de texto configurada. A esteira entrega os números, mas não a leitura nem as pautas.
            </p>
          )}
          {result.diagnosis.leitura && <p className="mb-4 text-sm leading-relaxed text-[color:var(--erp-text)]">{result.diagnosis.leitura}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            {!!result.diagnosis.pontos_fortes?.length && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">Pontos fortes</p>
                <ul className="space-y-1.5">
                  {result.diagnosis.pontos_fortes?.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-[color:var(--erp-text)]">
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!!result.diagnosis.lacunas?.length && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-700">Lacunas</p>
                <ul className="space-y-1.5">
                  {result.diagnosis.lacunas?.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-[color:var(--erp-text)]">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {!!result.diagnosis.recomendacoes?.length && (
            <div className="mt-4 border-t border-violet-50 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-violet-700">Recomendações</p>
              <ul className="space-y-2">
                {result.diagnosis.recomendacoes?.map((item) => (
                  <li key={item.acao} className="text-sm">
                    <span className="font-medium text-slate-900">{item.acao}</span>
                    {item.motivo && <span className="text-[color:var(--erp-text-muted)]">. {item.motivo}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!!result.diagnosis.pautas?.length && (
            <div className="mt-4 border-t border-violet-50 pt-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[color:var(--erp-text-muted)]">
                <Lightbulb size={13} className="text-amber-500" />Pautas propostas
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {result.diagnosis.pautas?.map((pauta) => (
                  <div key={pauta.title} className="rounded-xl border border-violet-50 p-3">
                    <p className="text-sm font-semibold text-slate-900">{pauta.title}</p>
                    <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-[color:var(--erp-text-muted)]">{pauta.brief}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <Card>
        <CardHeader
          title="Concorrentes observados"
          subtitle="Contas Comercial ou Criador de conteúdo, lidas pela Business Discovery do Instagram"
          action={
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} loading={syncing} onClick={syncCompetitors} disabled={!competitors.length}>
              Atualizar
            </Button>
          }
        />
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Adicionar perfil"
              placeholder="@perfildoconcorrente"
              value={newHandle}
              onChange={(event) => setNewHandle(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void addCompetitor(); }}
              hint="Perfil pessoal o Instagram não abre para terceiros, só Comercial ou Criador de conteúdo."
            />
          </div>
          <Button icon={<Plus size={14} />} loading={adding} onClick={addCompetitor}>Adicionar</Button>
        </div>

        {!competitors.length ? (
          <EmptyState
            icon={<Users size={22} />}
            title="Nenhum concorrente cadastrado"
            description="A esteira precisa de pelo menos um perfil para o analista comparar."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-violet-100 text-left text-xs uppercase tracking-wider text-[color:var(--erp-text-muted)]">
                  <th className="pb-2 pr-3 font-semibold">Perfil</th>
                  <th className="pb-2 pr-3 text-right font-semibold">Seguidores</th>
                  <th className="pb-2 pr-3 text-right font-semibold">Posts/semana</th>
                  <th className="pb-2 pr-3 text-right font-semibold">Engajamento</th>
                  <th className="pb-2 pr-3 font-semibold">Atualizado</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {ranked.map((row) => {
                  const competitor = competitors.find((item) => `c-${item.id}` === row.id);
                  return (
                    <tr key={row.id} className="border-b border-violet-50 last:border-0">
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${row.isOwn ? 'text-violet-700' : 'text-slate-800'}`}>@{row.username}</span>
                          {row.isOwn && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">4Core</span>}
                        </div>
                        {row.error && <p className="mt-0.5 text-xs text-rose-600">{row.error}</p>}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-[color:var(--erp-text)]">{formatNumber(row.followers_count)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-[color:var(--erp-text)]">{row.posts_per_week ?? 0}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums font-semibold text-slate-900">{row.engagement_rate ?? 0}%</td>
                      <td className="py-2.5 pr-3 text-xs text-[color:var(--erp-text-muted)]">{formatDate(competitor?.last_synced_at)}</td>
                      <td className="py-2.5 text-right">
                        {competitor && (
                          <button
                            type="button"
                            onClick={() => removeCompetitor(competitor.id)}
                            className="rounded-lg p-1.5 text-[color:var(--erp-text-muted)] transition-colors hover:bg-rose-50 hover:text-rose-600"
                            title={`Remover @${competitor.username}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-violet-50 pt-4 text-sm text-[color:var(--erp-text)]">
          <label className="flex items-center gap-2">
            Peças por rodada
            <select value={contentLimit} onChange={(event) => setContentLimit(Number(event.target.value))} className="rounded-lg border border-violet-100 px-2 py-1 text-sm">
              {[0, 1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>{value === 0 ? 'só analisar' : value}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            Uma a cada
            <select value={cadenceDays} onChange={(event) => setCadenceDays(Number(event.target.value))} className="rounded-lg border border-violet-100 px-2 py-1 text-sm">
              {[1, 2, 3, 4, 7].map((value) => <option key={value} value={value}>{value} {value === 1 ? 'dia' : 'dias'}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={withArt} onChange={(event) => setWithArt(event.target.checked)} className="h-4 w-4 accent-violet-600" />
            Gerar a arte do feed
          </label>
        </div>
      </Card>

      {!!benchmark?.competitors.some((item) => item.top_posts?.length) && (
        <Card>
          <CardHeader title="O que mais engajou nos concorrentes" subtitle="Referência de ângulo e formato, nunca de legenda" />
          <div className="space-y-4">
            {benchmark.competitors.map((competitor) => (
              !!competitor.top_posts?.length && (
                <div key={competitor.id}>
                  <p className="mb-2 text-xs font-semibold text-[color:var(--erp-text)]">@{competitor.username}</p>
                  <div className="space-y-1.5">
                    {competitor.top_posts.slice(0, 3).map((post, index) => (
                      <div key={`${competitor.id}-${index}`} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                        <p className="line-clamp-2 text-xs text-[color:var(--erp-text-muted)]">{post.caption || 'Publicação sem legenda'}</p>
                        <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-[color:var(--erp-text-muted)]">
                          <span>{formatNumber(post.like_count)} curtidas</span>
                          <span>{formatNumber(post.comments_count)} coment.</span>
                          {post.permalink && (
                            <a href={post.permalink} target="_blank" rel="noreferrer" className="text-violet-600 hover:text-violet-800">
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        </Card>
      )}

      {!!runs.length && (
        <Card>
          <CardHeader title="Rodadas anteriores" subtitle="Clique para ver a esteira daquela rodada" />
          <ul className="space-y-2">
            {runs.map((run) => (
              <li key={run.id} className="flex items-start justify-between gap-3 border-b border-violet-50 pb-2 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-xs text-[color:var(--erp-text-muted)]">
                    {formatDate(run.started_at)} · {run.trigger === 'cron' ? 'automática' : 'manual'} · {run.pautas_count} pautas · {run.created_content_ids.length} peças
                  </p>
                  {run.leitura && <p className="mt-0.5 line-clamp-2 text-sm text-[color:var(--erp-text)]">{run.leitura}</p>}
                  {run.error_message && <p className="mt-0.5 text-xs text-rose-600">{run.error_message}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${run.status === 'done' ? 'bg-emerald-50 text-emerald-700' : run.status === 'failed' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-[color:var(--erp-text-muted)]'}`}>
                    {run.status === 'done' ? 'concluída' : run.status === 'failed' ? 'falhou' : 'rodando'}
                  </span>
                  <button
                    type="button"
                    onClick={() => openRun(run.id)}
                    className="rounded-lg p-1.5 text-[color:var(--erp-text-muted)] transition-colors hover:bg-violet-50 hover:text-violet-700"
                    title="Ver a esteira desta rodada"
                  >
                    <Eye size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
