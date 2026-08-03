import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarCheck, CalendarClock, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';
import { SCHEDULE_KINDS, type ScheduleKind } from '../scheduleKinds';

type Level = 'ok' | 'warning' | 'critical';
type Upcoming = { id:number; title:string; kind:ScheduleKind; source:'erp'|'externo'; scheduled_at:string };
export type Coverage = {
  level:Level; message:string; covered_until:string|null; days_ahead:number;
  next_at:string|null; days_to_next:number|null; total_upcoming:number;
  by_kind:Record<string,number>; by_source:Record<string,number>; upcoming:Upcoming[];
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
 *  geral, sem a lista das próximas peças. */
export default function ScheduleCoverageAlert({ compact=false }:{ compact?:boolean }) {
  const [data,setData]=useState<Coverage|null>(null), [failed,setFailed]=useState(false);

  useEffect(()=>{
    let active=true;
    api.get<Coverage>('/marketing/schedule-coverage')
      .then(({data:payload})=>{if(active)setData(payload);})
      .catch(()=>{if(active)setFailed(true);});
    return()=>{active=false;};
  },[]);

  if(failed||!data) return null;
  const style=tone[data.level];
  const until=longDate(data.covered_until);
  const Icon=data.level==='ok'?CalendarCheck:AlertTriangle;

  return <section className="rounded-2xl border p-4" style={{borderColor:style.border,background:style.bg}}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon size={18} className="mt-0.5 shrink-0" style={{color:style.text}}/>
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{color:style.text}}>
            {until?<>Agendado até {until}</>:'Nenhuma publicação agendada'}
          </p>
          <p className="mt-1 text-xs leading-relaxed" style={{color:style.text,opacity:.85}}>{data.message}</p>
          {data.total_upcoming>0&&<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold">
            {/* Os pontos coloridos repetem a paleta do Calendário de propósito: a
                mesma cor tem que significar a mesma coisa nas duas telas. */}
            {(['story','feed'] as ScheduleKind[]).map((kind)=>
              <span key={kind} className="flex items-center gap-1.5" style={{color:style.text}}>
                <span className="h-2 w-2 rounded-full" style={{background:SCHEDULE_KINDS[kind].fill}}/>
                {data.by_kind[kind]||0} {SCHEDULE_KINDS[kind].label.toLowerCase()}{(data.by_kind[kind]||0)===1?'':'s'}
              </span>
            )}
            <span className="uppercase tracking-wide" style={{color:style.text,opacity:.6}}>
              {data.total_upcoming} na fila{data.by_source?.externo?` · ${data.by_source.externo} manual`:''}
            </span>
          </div>}
        </div>
      </div>
      <Link to="/marketing/calendario" className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl px-3 text-xs font-semibold" style={{color:style.text,background:'var(--erp-surface)',border:`1px solid ${style.border}`}}>
        {data.level==='ok'?'Ver calendário':'Agendar agora'}<ChevronRight size={14}/>
      </Link>
    </div>

    {!compact&&data.upcoming.length>0&&<ul className="mt-3 space-y-1.5 border-t pt-3" style={{borderColor:style.border}}>
      {data.upcoming.slice(0,4).map(item=><li key={`${item.source}-${item.id}`} className="flex items-center gap-2 text-xs" style={{color:style.text}}>
        <CalendarClock size={12} className="shrink-0" style={{opacity:.7}}/>
        <span className="shrink-0 font-semibold">{new Date(item.scheduled_at).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
        <span className="truncate" style={{opacity:.85}}>{item.title}</span>
        <span className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{background:SCHEDULE_KINDS[item.kind].soft,color:SCHEDULE_KINDS[item.kind].ink}}>
          {SCHEDULE_KINDS[item.kind].label}
        </span>
      </li>)}
    </ul>}
  </section>;
}
