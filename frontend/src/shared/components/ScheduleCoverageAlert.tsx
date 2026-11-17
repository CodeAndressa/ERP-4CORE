import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarCheck, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';
import type { ScheduleKind } from '../scheduleKinds';

type Level = 'ok' | 'warning' | 'critical';
type Upcoming = { id:number; title:string; kind:ScheduleKind; source:'erp'|'externo'; scheduled_at:string };
export type Coverage = {
  level:Level; message:string; covered_until:string|null; days_ahead:number;
  next_at:string|null; days_to_next:number|null; total_upcoming:number;
  in_next_7_days:number;
  partial?:boolean; errors?:Record<string,string>;
  by_kind:Record<string,number>; by_source:Record<string,number>; upcoming:Upcoming[];
  // Post e story separados, so nos proximos sete dias: story vence em 24h e
  // post fica, entao somar os dois esconde o que importa na leitura da semana.
  by_kind_next_7_days?:Record<string,number>;
  // Pecas produzidas pela esteira, com data marcada, que ainda dependem de
  // alguem aprovar. Nao sao agendadas, mas tambem nao sao nada.
  awaiting_approval?:number;
};

// Vermelho só quando a fila realmente vai secar. Alerta que grita em situação
// normal deixa de ser lido, e aí não serve pra nada.
//
// As três derivam dos tokens semânticos do sistema (rose/amber/emerald) no formato
// que o DESIGN.md define para estado: fundo suave da mesma cor, borda intermediária
// e texto na variante cheia.
const tone: Record<Level,{border:string;bg:string;text:string;label:string}> = {
  critical:{border:'rgba(190,18,60,0.24)',bg:'rgba(190,18,60,0.07)',text:'var(--erp-rose)',label:'Sem cobertura'},
  warning:{border:'rgba(180,83,9,0.24)',bg:'rgba(180,83,9,0.07)',text:'var(--erp-amber)',label:'Cobertura curta'},
  ok:{border:'rgba(4,120,87,0.24)',bg:'rgba(4,120,87,0.07)',text:'var(--erp-emerald)',label:'Agendamento em dia'},
};

function longDate(iso:string|null) {
  if(!iso) return null;
  return new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'long',hour:'2-digit',minute:'2-digit'});
}

/** Alerta de cobertura de agendamento das redes. `compact` é a versão da Visão
 *  geral, sem a lista das próximas peças. `coverage` deixa quem já buscou o dado
 *  repassar em vez de disparar a mesma rota de novo na mesma tela. */
// A prop `compact` saiu: o aviso agora e sempre curto, entao nao havia mais uma
// versao longa para ela escolher.
export default function ScheduleCoverageAlert({ coverage }:{ coverage?:Coverage|null }) {
  const [fetched,setFetched]=useState<Coverage|null>(null), [failed,setFailed]=useState(false);
  const provided = coverage !== undefined;

  useEffect(()=>{
    if(provided) return;
    let active=true;
    api.get<Coverage>('/marketing/schedule-coverage')
      .then(({data:payload})=>{if(active)setFetched(payload);})
      .catch(()=>{if(active)setFailed(true);});
    return()=>{active=false;};
  },[provided]);

  const data = provided ? coverage : fetched;
  if(failed||!data) return null;
  const style=tone[data.level];
  const until=longDate(data.covered_until);
  const Icon=data.level==='ok'?CalendarCheck:AlertTriangle;

  // Quando esta tudo coberto, o aviso vira uma linha. Um bloco de quatro linhas
  // dizendo "esta tudo certo" tomava o topo de toda tela de Marketing e do
  // painel, acima do conteudo que a pessoa veio ver. Alerta so merece area
  // quando ha o que resolver.
  if(data.level==='ok') return <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{color:'var(--erp-text-muted)'}}>
    <Icon size={14} className="shrink-0" style={{color:'var(--erp-emerald)'}}/>
    <span>Agendado até {until}.</span>
    <span style={{opacity:.75}}>{data.total_upcoming} na fila.</span>
    <Link to="/marketing/calendario" className="font-semibold underline underline-offset-2" style={{color:'var(--erp-violet)'}}>Ver calendário</Link>
  </div>;

  return <section className="rounded-2xl border p-4" style={{borderColor:style.border,background:style.bg}}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon size={18} className="mt-0.5 shrink-0" style={{color:style.text}}/>
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{color:style.text}}>
            {until?<>Agendado até {until}</>:data.partial?'Agenda parcialmente verificada':'Nenhuma publicação agendada'}
          </p>
          <p className="mt-1 text-xs leading-relaxed" style={{color:style.text,opacity:.85}}>{data.message}</p>
          {data.total_upcoming>0&&<p className="mt-1 text-xs" style={{color:style.text,opacity:.7}}>
            {data.total_upcoming} na fila{data.by_source?.externo?` · ${data.by_source.externo} manual`:''}
          </p>}
        </div>
      </div>
      <Link to="/marketing/calendario" className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl px-3 text-xs font-semibold" style={{color:style.text,background:'var(--erp-surface)',border:`1px solid ${style.border}`}}>
        {/* Aqui o nivel nunca e ok: esse caso ja retornou como uma linha acima. */}
        Agendar agora<ChevronRight size={14}/>
      </Link>
    </div>

    {/* A lista das proximas publicacoes saiu daqui. Ela repetia, em quatro
        linhas no topo de toda tela, o que o Calendario mostra inteiro a um
        clique de distancia; o aviso so precisa dizer que ha um vazio a cobrir. */}
  </section>;
}
