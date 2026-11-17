import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

/** O seletor de data e hora da publicação.
 *
 *  O nativo (`<input type="datetime-local">`) foi trocado por dois motivos, e o
 *  segundo é o que importa:
 *
 *  1. Ele é desenhado pelo sistema operacional, então muda de cara entre
 *     Windows, Mac e Android e ignora a identidade do produto.
 *
 *  2. Ele mostra um calendário vazio. Escolher a data de uma publicação sem ver
 *     o que já está marcado é escolher às cegas: a pessoa marca em cima de
 *     outra peça, ou deixa um buraco de seis dias sem perceber. Aqui os dias que
 *     já têm peça aparecem com um ponto, e o dia sugerido pela cadência vem
 *     destacado.
 *
 *  Os dias ocupados mostrados são os do MESMO formato. Post e story são filas
 *  separadas: ver os stories marcados enquanto se agenda um post só atrapalha.
 */

export type DiaOcupado = { data: string; titulo: string };

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** O valor que o formulário usa: 'YYYY-MM-DDTHH:mm', em hora local. */
function paraValor(data: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

function chaveDoDia(data: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

export function SeletorDeData({
  value,
  onChange,
  ocupados = [],
  sugerido = '',
}: {
  value: string;
  onChange: (valor: string) => void;
  /** Dias que já têm peça do mesmo formato, para não marcar em cima. */
  ocupados?: DiaOcupado[];
  /** O dia que a cadência sugere, destacado no calendário. */
  sugerido?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  const selecionada = useMemo(() => (value ? new Date(value) : null), [value]);
  const [mesVisivel, setMesVisivel] = useState(() => selecionada ?? new Date());

  // Fecha ao clicar fora e no Esc, que é o que se espera de um popover.
  useEffect(() => {
    if (!aberto) return;
    const foraDaCaixa = (evento: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(evento.target as Node)) setAberto(false);
    };
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAberto(false);
    };
    document.addEventListener('mousedown', foraDaCaixa);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', foraDaCaixa);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  const porDia = useMemo(() => {
    const mapa = new Map<string, string[]>();
    ocupados.forEach((item) => {
      if (!item.data) return;
      const chave = chaveDoDia(new Date(item.data));
      mapa.set(chave, [...(mapa.get(chave) ?? []), item.titulo]);
    });
    return mapa;
  }, [ocupados]);

  const chaveSugerida = sugerido ? chaveDoDia(new Date(sugerido)) : '';

  // A grade do mês, começando no domingo da semana do dia 1.
  const grade = useMemo(() => {
    const primeiro = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth(), 1);
    const inicio = new Date(primeiro);
    inicio.setDate(1 - primeiro.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const dia = new Date(inicio);
      dia.setDate(inicio.getDate() + i);
      return dia;
    });
  }, [mesVisivel]);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  function escolherDia(dia: Date) {
    // Mantém a hora que já estava escolhida; trocar o dia não deve zerar o
    // horário que a cadência calculou.
    const base = selecionada ?? new Date(sugerido || Date.now());
    const novo = new Date(dia);
    novo.setHours(base.getHours(), base.getMinutes(), 0, 0);
    onChange(paraValor(novo));
  }

  function escolherHora(texto: string) {
    const [h, m] = texto.split(':').map(Number);
    const base = selecionada ?? new Date();
    const novo = new Date(base);
    novo.setHours(h || 0, m || 0, 0, 0);
    onChange(paraValor(novo));
  }

  const rotulo = selecionada
    ? selecionada.toLocaleString('pt-BR', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : 'Escolher data e hora';

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="field flex min-h-tap items-center gap-2 text-left"
        aria-haspopup="dialog"
        aria-expanded={aberto}
      >
        <CalendarDays size={15} style={{ color: 'var(--erp-violet)' }} aria-hidden="true" />
        <span style={{ color: selecionada ? 'var(--erp-text)' : 'var(--erp-text-dim)' }}>{rotulo}</span>
      </button>

      {aberto && (
        <div
          className="popover absolute left-0 z-popover mt-2 w-[290px] rounded-2xl border p-3"
          role="dialog"
          style={{ borderColor: 'var(--erp-border)', boxShadow: 'var(--erp-shadow-float)' }}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Mês anterior"
              onClick={() => setMesVisivel(new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() - 1, 1))}
              className="grid h-7 w-7 place-items-center rounded-lg hover:bg-[color:var(--erp-surface-2)]"
              style={{ color: 'var(--erp-text-muted)' }}
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-xs font-bold capitalize" style={{ color: 'var(--erp-text)' }}>
              {MESES[mesVisivel.getMonth()]} {mesVisivel.getFullYear()}
            </span>
            <button
              type="button"
              aria-label="Próximo mês"
              onClick={() => setMesVisivel(new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + 1, 1))}
              className="grid h-7 w-7 place-items-center rounded-lg hover:bg-[color:var(--erp-surface-2)]"
              style={{ color: 'var(--erp-text-muted)' }}
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {DIAS_SEMANA.map((letra, i) => (
              <span key={i} className="py-1 text-2xs font-bold" style={{ color: 'var(--erp-text-dim)' }}>
                {letra}
              </span>
            ))}
            {grade.map((dia) => {
              const doMes = dia.getMonth() === mesVisivel.getMonth();
              const chave = chaveDoDia(dia);
              const titulos = porDia.get(chave);
              const eSelecionado = selecionada && chaveDoDia(selecionada) === chave;
              const eSugerido = chave === chaveSugerida && !eSelecionado;
              const passado = dia < hoje;

              return (
                <button
                  key={chave}
                  type="button"
                  disabled={passado}
                  onClick={() => escolherDia(dia)}
                  title={titulos ? `Já marcado: ${titulos.join(', ')}` : undefined}
                  className="relative grid h-8 place-items-center rounded-lg text-xs font-semibold transition-colors disabled:opacity-25"
                  style={{
                    background: eSelecionado ? 'var(--erp-violet)' : eSugerido ? 'var(--erp-violet-dim)' : 'transparent',
                    color: eSelecionado
                      ? '#fff'
                      : eSugerido
                        ? 'var(--erp-violet)'
                        : doMes
                          ? 'var(--erp-text)'
                          : 'var(--erp-text-dim)',
                  }}
                >
                  {dia.getDate()}
                  {/* O ponto diz que já há peça do mesmo formato nesse dia. É o
                      que o calendário nativo não mostra, e é a informação que
                      evita marcar duas publicações no mesmo dia. */}
                  {titulos && !eSelecionado && (
                    <span
                      className="absolute bottom-1 h-1 w-1 rounded-full"
                      style={{ background: 'var(--erp-amber)' }}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div
            className="mt-3 flex items-center gap-2 border-t pt-3"
            style={{ borderColor: 'var(--erp-border)' }}
          >
            <Clock size={14} style={{ color: 'var(--erp-text-muted)' }} aria-hidden="true" />
            <input
              type="time"
              value={selecionada ? paraValor(selecionada).slice(11, 16) : ''}
              onChange={(e) => escolherHora(e.target.value)}
              className="field !w-auto !py-1 text-xs"
              aria-label="Hora da publicação"
            />
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="ml-auto rounded-lg px-3 py-1.5 text-xs font-bold text-white"
              style={{ background: 'var(--erp-violet)' }}
            >
              Pronto
            </button>
          </div>

          {porDia.size > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-2xs" style={{ color: 'var(--erp-text-dim)' }}>
              <span className="h-1 w-1 rounded-full" style={{ background: 'var(--erp-amber)' }} />
              dias com publicação do mesmo formato já marcada
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default SeletorDeData;
