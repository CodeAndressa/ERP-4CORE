/** Vocabulário visual de post x story agendado.
 *
 *  Mora aqui, e não em cada tela, porque a cor só ensina alguma coisa se for a
 *  mesma no Calendário e no alerta de cobertura. Duas telas com paletas próprias
 *  para a mesma distinção obrigariam a reaprender a legenda em cada uma.
 *
 *  A cor codifica o formato (post ou story). A origem (Estúdio ou agendamento
 *  manual) é um eixo separado e continua sendo dita pelo selo "Manual" — são
 *  perguntas diferentes, e resolver as duas com cor viraria sopa de cor. */

export type ScheduleKind = 'feed' | 'story';

export interface KindVisual {
  /** Rótulo curto, para selo e legenda. */
  label: string;
  /** Preenchimento sólido — usado onde a cor carrega texto branco em cima. */
  fill: string;
  /** Mesma cor em versão suave, para selo com texto na cor cheia. */
  soft: string;
  /** Cor do texto sobre `soft`. */
  ink: string;
}

export const SCHEDULE_KINDS: Record<ScheduleKind, KindVisual> = {
  // Story fica com o índigo do sistema: é o formato que o próprio ERP produz e
  // publica, então herda o acento das ações do app.
  story: { label: 'Story', fill: 'var(--erp-violet)', soft: 'var(--erp-violet-soft)', ink: 'var(--erp-violet)' },
  // Post de feed em cyan — a variante -deep no preenchimento porque o cyan
  // padrão não alcança 4.5:1 com texto branco.
  feed: { label: 'Post', fill: 'var(--erp-cyan-deep)', soft: 'rgba(8,145,178,0.12)', ink: 'var(--erp-cyan)' },
};

export function kindOf(layout: string | null | undefined): ScheduleKind {
  return layout === 'story' ? 'story' : 'feed';
}

export function kindVisual(layout: string | null | undefined): KindVisual {
  return SCHEDULE_KINDS[kindOf(layout)];
}

/** Fundo de um dia que tem os dois formatos agendados: corte reto ao meio, sem
 *  degradê. Degradê leria como uma terceira cor em vez de duas coisas juntas. */
export const MIXED_KIND_FILL =
  `linear-gradient(135deg, ${SCHEDULE_KINDS.story.fill} 0 50%, ${SCHEDULE_KINDS.feed.fill} 50% 100%)`;
