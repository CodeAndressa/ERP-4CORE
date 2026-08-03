import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarCheck, CalendarClock, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';

type Level = 'ok' | 'warning' | 'critical';
type Upcoming = { id:number; title:string; kind:'story'|'feed'|'externo'; scheduled_at:string };
export type Coverage = {
  level:Level; message:string; covered_until:string|null; days_ahead:number;
  next_at:string|null; days_to_next:number|null; total_upcoming:number;
  by_kind:Record<string,number>; upcoming:Upcoming[];
};

// Vermelho só quando a fila realmente vai secar. Alerta que grita em situação
// normal deixa de ser lido, e aí não serve pra nada.
const tone: Record<Level,{border:string;bg:string;text:string;label:string}> = {
  critical:{border:'#fecdca',bg:'#fef3f2',text:'#b42318',label:'Sem cobertura'},
  warning:{border:'#fedf89',bg:'#fffaeb',text:'#93370d',label:'Cobertura curta'},
  ok:{border:'#a6f4c5',bg:'#ecfdf3',text:'#027a48',label:'Agendamento em dia'},
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
          {data.total_upcoming>0&&<p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{color:style.text,opacity:.7}}>
            {data.total_upcoming} na fila · {data.by_kind.story||0} story · {data.by_kind.feed||0} feed{data.by_kind.externo?` · ${data.by_kind.externo} externo`:''}
          </p>}
        </div>
      </div>
      <Link to="/marketing/calendario" className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl px-3 text-xs font-semibold" style={{color:style.text,background:'#ffffffaa'}}>
        {data.level==='ok'?'Ver calendário':'Agendar agora'}<ChevronRight size={14}/>
      </Link>
    </div>

    {!compact&&data.upcoming.length>0&&<ul className="mt-3 space-y-1.5 border-t pt-3" style={{borderColor:style.border}}>
      {data.upcoming.slice(0,4).map(item=><li key={`${item.kind}-${item.id}`} className="flex items-center gap-2 text-xs" style={{color:style.text}}>
        <CalendarClock size={12} className="shrink-0" style={{opacity:.7}}/>
        <span className="shrink-0 font-semibold">{new Date(item.scheduled_at).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
        <span className="truncate" style={{opacity:.85}}>{item.title}</span>
        <span className="ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase" style={{background:'#ffffff99'}}>{item.kind}</span>
      </li>)}
    </ul>}
  </section>;
}
