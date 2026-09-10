import { useEffect, useState } from 'react';
import { AlertCircle, Lightbulb, Loader2, RefreshCw, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';

type Area = 'site' | 'instagram' | 'integrado';
type Insight = { area:Area; title:string; reading:string; action:string; priority:'alta'|'media'|'baixa'; confidence:'alta'|'media'|'baixa' };
type Delta = { atual:number; anterior:number; variacao_pct:number|null; direcao:'subindo'|'caindo'|'estavel' };
type Signals = {
  site?:{ visitantes_7d?:Delta; leads_7d?:Delta; conversoes_7d?:Delta; resumo_30d?:Record<string,number>; dias_sem_lead?:number; erro?:string };
  instagram?:{ seguidores?:number; alcance_30d?:number; tendencia_alcance_pct?:number; interacoes_media_por_post?:number;
    taxa_engajamento_media_pct?:number|null; dias_desde_ultima_publicacao?:number|null; posts_analisados?:number; erro?:string };
};
type Payload = { available:boolean; reason?:string; headline?:string; summary?:string; insights?:Insight[]; signals?:Signals; generated_at?:string };

const priorityTone: Record<string,[string,string]> = {
  alta:['#b42318','#fef3f2'], media:['#b54708','#fffaeb'], baixa:['#027a48','#ecfdf3'],
};
const areaLabel: Record<Area,string> = { site:'Site', instagram:'Instagram', integrado:'Site + Instagram' };

function Trend({ label, delta, suffix='' }:{ label:string; delta?:Delta; suffix?:string }) {
  if(!delta) return null;
  const up=delta.direcao==='subindo', flat=delta.direcao==='estavel';
  const color=flat?'var(--erp-text-muted)':up?'#027a48':'#b42318';
  return <div className="rounded-xl p-3" style={{background:'var(--erp-surface-2)'}}>
    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{color:'var(--erp-text-muted)'}}>{label}</p>
    <p className="mt-1 text-lg font-bold">{delta.atual}{suffix}</p>
    <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold" style={{color}}>
      {!flat&&(up?<TrendingUp size={12}/>:<TrendingDown size={12}/>)}
      {delta.variacao_pct===null?'sem base anterior':`${delta.variacao_pct>0?'+':''}${delta.variacao_pct}% vs 7 dias antes`}
    </p>
  </div>;
}

/** Insights sobre as métricas reais de site e Instagram. `focus` filtra os cartões
 *  para a área da página onde o painel está, mas os sinais brutos continuam
 *  aparecendo inteiros, porque a leitura cruzada é parte do valor. */
export default function InsightsPanel({ focus }:{ focus?:Area }) {
  const [data,setData]=useState<Payload|null>(null), [loading,setLoading]=useState(true);

  async function load() {
    setLoading(true);
    try{const {data:payload}=await api.get<Payload>('/marketing/insights');setData(payload);}
    catch(error:any){
      const detail=error?.response?.data?.detail;
      const status=error?.response?.status;
      const reason=typeof detail==='string'&&detail!=='Erro interno na API.'
        ? detail
        : `Não foi possível consultar os insights agora${status?` (erro ${status})`:''}.`;
      setData({available:false,reason});
    }
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);

  const site=data?.signals?.site, instagram=data?.signals?.instagram;
  const shown=(data?.insights||[]).filter(item=>!focus||item.area===focus||item.area==='integrado');

  return <section className="overflow-hidden rounded-2xl border bg-white" style={{borderColor:'var(--erp-border)'}}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5" style={{borderColor:'var(--erp-border)'}}>
      <div>
        <h2 className="flex items-center gap-2 font-semibold"><Lightbulb size={17} style={{color:'var(--erp-violet)'}}/>Insights</h2>
        <p className="mt-1 text-xs" style={{color:'var(--erp-text-muted)'}}>Leitura dos números reais do site e do Instagram, com a ação sugerida para a semana.</p>
      </div>
      <button disabled={loading} onClick={()=>void load()} className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold disabled:opacity-50" style={{color:'var(--erp-violet)'}}>
        <RefreshCw size={14} className={loading?'animate-spin':''}/>Atualizar
      </button>
    </div>

    {loading&&<div className="flex min-h-40 items-center justify-center gap-2 text-sm" style={{color:'var(--erp-text-muted)'}}><Loader2 size={18} className="animate-spin"/>Lendo métricas do site e do Instagram...</div>}

    {!loading&&data&&<div className="space-y-4 p-4 sm:p-5">
      {(site&&!site.erro)||(instagram&&!instagram.erro)?<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {site&&!site.erro&&<><Trend label="Visitantes (7d)" delta={site.visitantes_7d}/><Trend label="Leads (7d)" delta={site.leads_7d}/></>}
        {instagram&&!instagram.erro&&<>
          <div className="rounded-xl p-3" style={{background:'var(--erp-surface-2)'}}>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{color:'var(--erp-text-muted)'}}>Seguidores</p>
            <p className="mt-1 text-lg font-bold">{instagram.seguidores ?? '-'}</p>
            <p className="mt-0.5 text-[11px]" style={{color:'var(--erp-text-muted)'}}>{instagram.taxa_engajamento_media_pct!=null?`${instagram.taxa_engajamento_media_pct}% de engajamento médio`:'engajamento indisponível'}</p>
          </div>
          <div className="rounded-xl p-3" style={{background:'var(--erp-surface-2)'}}>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{color:'var(--erp-text-muted)'}}>Alcance (30d)</p>
            <p className="mt-1 text-lg font-bold">{instagram.alcance_30d ?? '-'}</p>
            <p className="mt-0.5 text-[11px]" style={{color:'var(--erp-text-muted)'}}>{instagram.dias_desde_ultima_publicacao!=null?`último post há ${instagram.dias_desde_ultima_publicacao} dia(s)`:'sem data do último post'}</p>
          </div>
        </>}
      </div>:null}

      {data.available?<>
        {data.headline&&<div className="rounded-xl p-4" style={{background:'var(--erp-violet-dim)'}}>
          <p className="flex items-center gap-2 font-semibold" style={{color:'var(--erp-violet)'}}><Sparkles size={15}/>{data.headline}</p>
          {data.summary&&<p className="mt-1.5 text-sm leading-relaxed" style={{color:'var(--erp-violet)'}}>{data.summary}</p>}
        </div>}
        {shown.length?<ul className="space-y-2">{shown.map((item,index)=>{
          const [color,bg]=priorityTone[item.priority]||priorityTone.media;
          return <li key={index} className="rounded-xl border p-3.5" style={{borderColor:'var(--erp-border)'}}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{color,background:bg}}>{item.priority}</span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{background:'var(--erp-surface-2)',color:'var(--erp-text-muted)'}}>{areaLabel[item.area]||item.area}</span>
              {item.confidence!=='alta'&&<span className="text-[10px] font-semibold uppercase tracking-wide" style={{color:'var(--erp-text-dim)'}}>confiança {item.confidence}</span>}
            </div>
            <p className="mt-2 text-sm font-semibold leading-snug">{item.title}</p>
            <p className="mt-1 text-xs leading-relaxed" style={{color:'var(--erp-text-muted)'}}>{item.reading}</p>
            {item.action&&<p className="mt-2 rounded-lg px-3 py-2 text-xs font-medium leading-relaxed" style={{background:'var(--erp-surface-2)'}}>Fazer esta semana: {item.action}</p>}
          </li>;
        })}</ul>:<p className="text-xs" style={{color:'var(--erp-text-muted)'}}>Nenhum insight para esta área nesta leitura.</p>}
      </>:<div className="flex items-start gap-2 rounded-xl border p-3 text-xs" style={{borderColor:'#fedf89',background:'#fffaeb',color:'#93370d'}}>
        <AlertCircle size={15} className="mt-0.5 shrink-0"/><span>{data.reason||'Insights indisponíveis agora.'}</span>
      </div>}
    </div>}
  </section>;
}
