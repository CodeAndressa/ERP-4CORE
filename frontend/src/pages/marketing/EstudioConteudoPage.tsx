import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CalendarClock, Camera, Check, ChevronRight, Download, ExternalLink, Lightbulb, Loader2, Plus, RefreshCw, Send, Sparkles, Trash2, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';

type Status = 'draft' | 'generating' | 'awaiting_approval' | 'approved' | 'scheduled' | 'publishing' | 'published' | 'rejected' | 'failed';
type Layout = 'feed' | 'story';
type Content = { id:number; title:string; brief:string; caption:string; channel:'instagram'|'facebook'|'both'; layout:Layout; status:Status; scheduled_at:string|null; approved_at:string|null; published_at:string|null; art_ready:boolean; error_message:string; updated_at:string };
type ConfigStatus = { art_generation:boolean; art_provider:string|null; storage:boolean; meta:boolean; scheduler:boolean };
type TopicSuggestion = { title:string; pillar:string; objective:string; brief:string };

const statusInfo: Record<Status, [string,string,string]> = {
  draft:['Rascunho','#667085','#f2f4f7'], generating:['Gerando','#6941c6','#f4f0ff'],
  awaiting_approval:['Aguardando aprovação','#b54708','#fffaeb'], approved:['Aprovado','#027a48','#ecfdf3'],
  scheduled:['Agendado','#3538cd','#eef4ff'], publishing:['Publicando','#6941c6','#f4f0ff'],
  published:['Publicado','#027a48','#ecfdf3'], rejected:['Ajustes solicitados','#b54708','#fffaeb'],
  failed:['Falha no envio','#b42318','#fef3f2'],
};
const filters = [
  ['all','Todos',[]], ['approval','Para aprovar',['awaiting_approval']], ['scheduled','Agendados',['approved','scheduled']],
  ['published','Publicados',['published']], ['attention','Atenção',['rejected','failed']],
] as const;

function localInput(iso?: string|null) {
  if (!iso) return '';
  const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
function tomorrow() { const d=new Date(); d.setDate(d.getDate()+1); d.setHours(10,0,0,0); return localInput(d.toISOString()); }
function isBillingError(value:string) { const text=value.toLowerCase(); return text.includes('billing hard limit')||text.includes('limite de cobrança')||text.includes('insufficient_quota'); }
function friendlyError(value:string) { return isBillingError(value)?'A OpenAI bloqueou a geração porque o limite de cobrança do projeto foi atingido. Regularize os créditos ou aumente o limite e tente novamente.':value; }
function message(error:unknown) { const detail=(error as {response?:{data?:{detail?:string}}}).response?.data?.detail; return friendlyError(detail||'Não foi possível concluir esta ação.'); }
function Pill({status}:{status:Status}) { const [label,color,bg]=statusInfo[status]; return <span className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{color,background:bg}}>{label}</span>; }

export default function EstudioConteudoPage() {
  const [items,setItems]=useState<Content[]>([]), [selectedId,setSelectedId]=useState<number|null>(null);
  const [loading,setLoading]=useState(true), [busy,setBusy]=useState(''), [filter,setFilter]=useState('all'), [creating,setCreating]=useState(false);
  const [artUrl,setArtUrl]=useState('');
  const [config,setConfig]=useState<ConfigStatus|null>(null);
  const [suggestions,setSuggestions]=useState<TopicSuggestion[]>([]), [showSuggestions,setShowSuggestions]=useState(false), [suggesting,setSuggesting]=useState(false);
  const [form,setForm]=useState({title:'',brief:'',channel:'instagram',scheduled_at:tomorrow()});
  const [newArtFile,setNewArtFile]=useState<File|null>(null);
  const [edit,setEdit]=useState({caption:'',scheduled_at:''});
  const [captionRef,setCaptionRef]=useState('');
  const uploadRef=useRef<HTMLInputElement>(null);
  const newArtRef=useRef<HTMLInputElement>(null);
  const selected=items.find(x=>x.id===selectedId)||null;
  const activeStatuses=filters.find(x=>x[0]===filter)?.[2]||[];
  const visible=useMemo(()=>items.filter(x=>!activeStatuses.length||(activeStatuses as readonly string[]).includes(x.status)),[items,activeStatuses]);

  async function load(id?:number) {
    try { const [{data},{data:ready}]=await Promise.all([api.get<{items:Content[]}>('/marketing/content'),api.get<ConfigStatus>('/marketing/content/config/status')]); setItems(data.items); setConfig(ready); setSelectedId(v=>id??v??data.items[0]?.id??null); }
    catch(e){toast.error(message(e));} finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  useEffect(()=>{
    setEdit({caption:selected?.caption||'',scheduled_at:localInput(selected?.scheduled_at)}); setArtUrl(''); setCaptionRef('');
    if(!selected?.art_ready)return; let active=true,url='';
    api.get(`/marketing/content/${selected.id}/art`,{responseType:'blob'}).then(({data})=>{url=URL.createObjectURL(data);if(active)setArtUrl(url);}).catch(()=>undefined);
    return()=>{active=false;if(url)URL.revokeObjectURL(url);};
  },[selected?.id,selected?.art_ready,selected?.updated_at]);

  async function create() {
    if(form.title.trim().length<3)return toast.error('Informe um título curto para identificar a publicação.');
    if(!newArtFile)return toast.error('Selecione a imagem que deseja publicar.');
    setBusy('create');
    try {
      const {data}=await api.post<Content>('/marketing/content',{title:form.title,brief:'',channel:form.channel,layout:'feed',scheduled_at:null});
      const body=new FormData(); body.append('file',newArtFile);
      await api.post(`/marketing/content/${data.id}/art/upload`,body);
      setCreating(false); setForm({title:'',brief:'',channel:'instagram',scheduled_at:tomorrow()}); setNewArtFile(null);
      await load(data.id); toast.success('Imagem enviada. Sugira a legenda e escolha a data.');
    } catch(e){await load();toast.error(message(e),{duration:6000});} finally{setBusy('');}
  }
  async function developIdea(idea:TopicSuggestion) {
    setBusy('create');
    try {
      const {data}=await api.post<Content>('/marketing/content',{title:idea.title,brief:idea.brief,channel:'instagram',layout:'story',scheduled_at:null});
      setShowSuggestions(false); await load(data.id); setBusy('generate');
      await api.post(`/marketing/content/${data.id}/generate`); await load(data.id); toast.success('Story pronto para aprovação.');
    } catch(e){await load();toast.error(message(e),{duration:6000});} finally{setBusy('');}
  }
  async function loadSuggestions() {
    setShowSuggestions(true); setSuggesting(true);
    try{const {data}=await api.post<{suggestions:TopicSuggestion[]}>('/marketing/content/topic-suggestions');setSuggestions(data.suggestions);}
    catch(e){toast.error(message(e),{duration:6000});}finally{setSuggesting(false);}
  }
  async function downloadCanva() {
    if(!selected)return; setBusy('canva');
    try{const {data}=await api.get(`/marketing/content/${selected.id}/canva-export`,{responseType:'blob'});const url=URL.createObjectURL(data);const link=document.createElement('a');link.href=url;link.download=`4core-conteudo-${selected.id}-canva-editavel.pptx`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);toast.success('Arquivo editável baixado. Importe-o no Canva.');}
    catch(e){toast.error(message(e),{duration:6000});}finally{setBusy('');}
  }
  async function uploadEditedArt(file?:File) {
    if(!selected||!file)return; setBusy('upload');
    try{const body=new FormData();body.append('file',file);await api.post(`/marketing/content/${selected.id}/art/upload`,body);await load(selected.id);toast.success('Arte recebida e enviada para aprovação.');}
    catch(e){toast.error(message(e),{duration:6000});}finally{setBusy('');if(uploadRef.current)uploadRef.current.value='';}
  }
  async function suggestCaption() {
    if(!selected)return; setBusy('caption');
    try{await api.post(`/marketing/content/${selected.id}/generate-caption`,{caption_reference:captionRef});await load(selected.id);toast.success('Legenda sugerida.');}
    catch(e){toast.error(message(e),{duration:6000});}finally{setBusy('');}
  }
  async function run(name:string, request:()=>Promise<unknown>, success:string) {
    if(!selected)return; setBusy(name);
    try{await request();await load(selected.id);toast.success(success);}catch(e){await load(selected.id);toast.error(message(e),{duration:6000});}finally{setBusy('');}
  }

  const canEdit=!!selected&&!['generating','publishing','published'].includes(selected.status);
  const canApprove=!!selected?.art_ready&&['awaiting_approval','rejected'].includes(selected.status);
  const canPublish=!!selected?.approved_at&&['approved','scheduled','failed'].includes(selected.status);

  return <div className="mx-auto max-w-[1500px] space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-5" style={{borderColor:'var(--erp-border)'}}>
      <div><p className="mb-1 text-xs font-semibold uppercase tracking-[.18em]" style={{color:'var(--erp-violet)'}}>Marketing</p><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">Estúdio de conteúdo</h1>{config?.art_provider&&<span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Arte por {config.art_provider}</span>}</div><p className="mt-1 text-sm" style={{color:'var(--erp-text-muted)'}}>Crie, aprove e agende publicações sem sair do 4Core.</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={()=>suggestions.length?setShowSuggestions(v=>!v):void loadSuggestions()} className="flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold" style={{borderColor:'var(--erp-border)',color:'var(--erp-violet)'}}><Lightbulb size={16}/>Ideias da IA</button><button onClick={()=>setCreating(true)} className="flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white" style={{background:'var(--erp-violet)'}}><Plus size={16}/>Nova publicação</button></div>
    </div>

    {config&&(!config.art_generation||!config.scheduler)&&<div className="flex items-start gap-2 rounded-xl border p-3 text-xs" style={{borderColor:'#fedf89',background:'#fffaeb',color:'#93370d'}}><AlertCircle size={15} className="mt-.5 shrink-0"/><span>{!config.art_generation&&<>Para gerar as artes, configure as credenciais do <b>Cloudflare Workers AI</b> ou <b>OPENAI_API_KEY</b> no backend. </>}{!config.scheduler&&<>Para o envio automático, use o mesmo <b>MARKETING_CRON_SECRET</b> no backend e nos Secrets do GitHub.</>} Os briefings ficam salvos como rascunho enquanto a configuração estiver incompleta.</span></div>}

    {showSuggestions&&<section className="overflow-hidden rounded-2xl border bg-white" style={{borderColor:'var(--erp-border)'}}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5" style={{borderColor:'var(--erp-border)'}}><div><h2 className="flex items-center gap-2 font-semibold"><Lightbulb size={17} style={{color:'var(--erp-violet)'}}/>Sugestões de Stories</h2><p className="mt-1 text-xs" style={{color:'var(--erp-text-muted)'}}>Baseadas no histórico do Instagram — a IA gera a arte (9:16) e a legenda pra você aprovar.</p></div><div className="flex items-center gap-1"><button disabled={suggesting||!!busy} onClick={()=>void loadSuggestions()} className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold disabled:opacity-50" style={{color:'var(--erp-violet)'}}><RefreshCw size={14} className={suggesting?'animate-spin':''}/>Novas ideias</button><button aria-label="Fechar sugestões" onClick={()=>setShowSuggestions(false)} className="flex h-10 w-10 items-center justify-center"><X size={16}/></button></div></div>
      {suggesting?<div className="flex min-h-48 items-center justify-center gap-2 text-sm" style={{color:'var(--erp-text-muted)'}}><Loader2 size={18} className="animate-spin"/>Analisando pautas e evitando repetições...</div>:<div className="divide-y" style={{borderColor:'var(--erp-border)'}}>{suggestions.map((idea,index)=><article key={`${idea.title}-${index}`} className="grid gap-3 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"><div className="min-w-0"><span className="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold" style={{background:'var(--erp-violet-dim)',color:'var(--erp-violet)'}}>{idea.pillar}</span><h3 className="mt-2 font-semibold">{idea.title}</h3><p className="mt-1 text-sm" style={{color:'var(--erp-text-muted)'}}>{idea.objective}</p></div><button disabled={!!busy} onClick={()=>void developIdea(idea)} className="flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-white disabled:opacity-50" style={{background:'var(--erp-violet)'}}>{busy==='create'?<Loader2 size={14} className="animate-spin"/>:<Sparkles size={14}/>}Gerar story</button></article>)}</div>}
    </section>}

    <div className="flex gap-1 overflow-x-auto rounded-xl border bg-white p-1" style={{borderColor:'var(--erp-border)'}}>{filters.map(([id,label,statuses])=>{
      const count=id==='all'?items.length:items.filter(x=>(statuses as readonly string[]).includes(x.status)).length, active=filter===id;
      return <button key={id} onClick={()=>setFilter(id)} className="flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold" style={{background:active?'var(--erp-violet-dim)':'transparent',color:active?'var(--erp-violet)':'var(--erp-text-muted)'}}>{label}<span className="rounded-full bg-white px-1.5 py-.5 text-[10px]" style={{border:'1px solid var(--erp-border)'}}>{count}</span></button>;
    })}</div>

    {creating&&<div className="rounded-2xl border bg-white p-4 sm:p-5" style={{borderColor:'var(--erp-border)'}}>
      <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Nova publicação</h2><p className="text-xs" style={{color:'var(--erp-text-muted)'}}>Envie a imagem pronta — depois é só sugerir a legenda e escolher quando publicar.</p></div><button aria-label="Fechar" onClick={()=>{setCreating(false);setNewArtFile(null);}} className="flex h-10 w-10 items-center justify-center"><X size={17}/></button></div>
      <div className="grid gap-4">
        <label className="space-y-1.5 text-xs font-medium"><span>Título (uso interno, não aparece no post)</span><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ex.: Post sobre controle de acesso" className="min-h-11 w-full rounded-xl border px-3 text-sm outline-none" style={{borderColor:'var(--erp-border)'}}/></label>
        <label className="block space-y-1.5 text-xs font-medium"><span>Imagem da publicação</span><button type="button" onClick={()=>newArtRef.current?.click()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed px-3 text-sm font-semibold" style={{borderColor:'var(--erp-border)',color:'var(--erp-violet)'}}><Upload size={15}/>{newArtFile?newArtFile.name:'Selecionar imagem (PNG, JPG ou WEBP, 4:5)'}</button><input ref={newArtRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>setNewArtFile(e.target.files?.[0]||null)}/></label>
      </div><div className="mt-4 flex justify-end"><button disabled={!!busy} onClick={()=>void create()} className="flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60" style={{background:'var(--erp-violet)'}}>{busy==='create'?<Loader2 size={16} className="animate-spin"/>:<Upload size={16}/>}Enviar imagem</button></div>
    </div>}

    <div className="grid min-h-[620px] overflow-hidden rounded-2xl border bg-white lg:grid-cols-[370px_minmax(0,1fr)]" style={{borderColor:'var(--erp-border)'}}>
      <section className="border-b lg:border-b-0 lg:border-r" style={{borderColor:'var(--erp-border)'}}>
        <div className="flex h-14 items-center justify-between border-b px-4" style={{borderColor:'var(--erp-border)'}}><b className="text-sm">Fila editorial</b><button onClick={()=>{setLoading(true);void load();}} className="flex h-10 w-10 items-center justify-center"><RefreshCw size={15} className={loading?'animate-spin':''}/></button></div>
        <div className="max-h-[560px] overflow-y-auto">{loading&&<div className="space-y-2 p-3">{[1,2,3,4].map(i=><div key={i} className="h-[88px] animate-pulse rounded-xl" style={{background:'var(--erp-surface-2)'}}/>)}</div>}{!loading&&!visible.length&&<div className="p-10 text-center"><Sparkles className="mx-auto mb-3" size={24} style={{color:'var(--erp-text-dim)'}}/><p className="text-sm font-medium">Nada neste filtro</p></div>}{!loading&&visible.map(item=><button key={item.id} onClick={()=>setSelectedId(item.id)} className="flex min-h-[104px] w-full items-center gap-3 border-b px-4 py-3 text-left" style={{borderColor:'var(--erp-border)',background:item.id===selectedId?'var(--erp-violet-dim)':'#fff'}}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-pink-600"><Camera size={18}/></span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{item.title}</b><span className="mt-1.5 flex items-center gap-1.5"><Pill status={item.status}/><span className="text-[10px] font-semibold uppercase tracking-wide" style={{color:'var(--erp-text-dim)'}}>{item.layout==='story'?'Story':'Feed'}</span></span>{item.scheduled_at&&<small className="mt-1.5 flex items-center gap-1" style={{color:'var(--erp-text-muted)'}}><CalendarClock size={11}/>{new Date(item.scheduled_at).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</small>}</span><ChevronRight size={15}/></button>)}</div>
      </section>

      <section className="min-w-0">{!selected?<div className="flex h-full min-h-[520px] flex-col items-center justify-center text-center"><Sparkles size={30} style={{color:'var(--erp-text-dim)'}}/><p className="mt-4 font-semibold">Selecione uma publicação</p></div>:<>
        <div className="flex items-start justify-between gap-3 border-b p-4 sm:p-5" style={{borderColor:'var(--erp-border)'}}><div><Pill status={selected.status}/><h2 className="mt-2 text-lg font-bold">{selected.title}</h2><p className="text-xs" style={{color:'var(--erp-text-muted)'}}>{selected.layout==='story'?'Story 9:16':'Retrato 4:5'} · {selected.channel}</p></div>{canEdit&&<button onClick={()=>run('delete',()=>api.delete(`/marketing/content/${selected.id}`),'Rascunho excluído.').then(()=>load())} className="flex h-10 w-10 items-center justify-center rounded-xl border text-red-700" style={{borderColor:'var(--erp-border)'}}><Trash2 size={15}/></button>}</div>
        {selected.error_message&&<div className="m-4 flex items-start gap-2 rounded-xl border p-3 text-xs text-red-700 sm:m-5" style={{borderColor:'#fecdca',background:'#fef3f2'}}><AlertCircle size={15} className="mt-0.5 shrink-0"/><span>{friendlyError(selected.error_message)}{isBillingError(selected.error_message)&&<a href="https://platform.openai.com/settings/organization/billing" target="_blank" rel="noreferrer" className="mt-1 block font-semibold underline">Abrir cobrança da OpenAI</a>}</span></div>}
        <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-[minmax(280px,440px)_1fr]">
          <div><div className="mb-2 flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wider" style={{color:'var(--erp-text-muted)'}}>Arte</p>{canEdit&&selected.layout==='story'&&<button disabled={!!busy} onClick={()=>run('generate',()=>api.post(`/marketing/content/${selected.id}/generate`),'Nova versão pronta para aprovação.')} className="flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-white disabled:opacity-60" style={{background:'var(--erp-violet)'}}>{busy==='generate'?<Loader2 size={15} className="animate-spin"/>:<Sparkles size={15}/>}Gerar {selected.art_ready?'nova versão':'story'}</button>}</div><div className={`overflow-hidden rounded-2xl border ${selected.layout==='story'?'aspect-[9/16]':'aspect-[4/5]'}`} style={{borderColor:'var(--erp-border)',background:'var(--erp-surface-2)'}}>{artUrl?<img src={artUrl} alt={selected.title} className="h-full w-full object-cover"/>:<div className="flex h-full flex-col items-center justify-center text-center"><Sparkles size={28}/><p className="mt-3 text-sm font-medium">Arte ainda não gerada</p><p className="mt-1 text-xs" style={{color:'var(--erp-text-muted)'}}>Formato {selected.layout==='story'?'story 9:16':'retrato 4:5'}</p></div>}</div>{canEdit&&selected.layout==='feed'&&<div className="mt-3 border-t pt-3" style={{borderColor:'var(--erp-border)'}}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{selected.art_ready?'Editar no Canva ou enviar outra arte':'Envie a imagem da publicação'}</p><p className="mt-1 text-xs leading-relaxed" style={{color:'var(--erp-text-muted)'}}>{selected.art_ready?'Baixe o PPTX 4:5, edite no Canva e reenvie — ou suba direto uma nova arte.':'PNG, JPG ou WEBP no formato retrato 4:5.'}</p></div>{selected.art_ready&&<a href="https://www.canva.com/" target="_blank" rel="noreferrer" className="flex min-h-9 shrink-0 items-center gap-1.5 text-xs font-semibold" style={{color:'var(--erp-violet)'}}>Abrir Canva<ExternalLink size={13}/></a>}</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{selected.art_ready&&<button disabled={!!busy} onClick={()=>void downloadCanva()} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border text-xs font-semibold disabled:opacity-50" style={{borderColor:'var(--erp-border)'}}>{busy==='canva'?<Loader2 size={14} className="animate-spin"/>:<Download size={14}/>}Baixar editável</button>}<button disabled={!!busy} onClick={()=>uploadRef.current?.click()} className={`flex min-h-10 items-center justify-center gap-2 rounded-xl text-xs font-semibold disabled:opacity-50 ${selected.art_ready?'border':'text-white'} ${!selected.art_ready&&'sm:col-span-2'}`} style={selected.art_ready?{borderColor:'var(--erp-border)'}:{background:'var(--erp-violet)'}}>{busy==='upload'?<Loader2 size={14} className="animate-spin"/>:<Upload size={14}/>}{selected.art_ready?'Enviar arte editada':'Enviar arte pronta'}</button></div><input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event=>void uploadEditedArt(event.target.files?.[0])}/><p className="mt-2 text-[11px]" style={{color:'var(--erp-text-dim)'}}>Envie PNG, JPG ou WEBP em 4:5 · recomendado: 1080 × 1350 px · até 15 MB.</p></div>}</div>
          <div className="space-y-4">
            {canEdit&&<label className="block space-y-2"><span className="text-xs font-semibold uppercase tracking-wider" style={{color:'var(--erp-text-muted)'}}>Legenda modelo (opcional)</span><textarea rows={3} value={captionRef} onChange={e=>setCaptionRef(e.target.value)} placeholder="Cole uma legenda de outra empresa/post pra IA imitar o estilo — o nome da empresa é sempre trocado por 4Core." className="w-full resize-none rounded-xl border p-3 text-xs leading-relaxed" style={{borderColor:'var(--erp-border)'}}/><button disabled={!!busy} onClick={()=>void suggestCaption()} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border text-xs font-semibold disabled:opacity-50" style={{borderColor:'var(--erp-border)',color:'var(--erp-violet)'}}>{busy==='caption'?<Loader2 size={14} className="animate-spin"/>:<Sparkles size={14}/>}Sugerir legenda{captionRef.trim()?' com base no modelo':' pra esta publicação'}</button></label>}
            <label className="block space-y-2"><span className="text-xs font-semibold uppercase tracking-wider" style={{color:'var(--erp-text-muted)'}}>Legenda</span><textarea disabled={!canEdit} rows={11} value={edit.caption} onChange={e=>setEdit({...edit,caption:e.target.value})} className="w-full resize-none rounded-xl border p-3 text-sm leading-relaxed disabled:bg-slate-50" style={{borderColor:'var(--erp-border)'}}/></label>
            <label className="block space-y-2"><span className="text-xs font-semibold uppercase tracking-wider" style={{color:'var(--erp-text-muted)'}}>Publicar em</span><input disabled={!canEdit} type="datetime-local" value={edit.scheduled_at} onChange={e=>setEdit({...edit,scheduled_at:e.target.value})} className="min-h-11 w-full rounded-xl border px-3 text-sm disabled:bg-slate-50" style={{borderColor:'var(--erp-border)'}}/></label>
            {canEdit&&<button onClick={()=>run('save',()=>api.patch(`/marketing/content/${selected.id}`,{caption:edit.caption,scheduled_at:edit.scheduled_at?new Date(edit.scheduled_at).toISOString():null}),'Alterações salvas.')} className="min-h-11 w-full rounded-xl border text-sm font-semibold" style={{borderColor:'var(--erp-border)'}}>Salvar alterações</button>}
            {canApprove&&<div className="grid gap-2 sm:grid-cols-2"><button onClick={()=>run('reject',()=>api.post(`/marketing/content/${selected.id}/reject`,{reason:'Ajustes solicitados na revisão.'}),'Peça devolvida para ajustes.')} className="min-h-11 rounded-xl border text-sm font-semibold" style={{borderColor:'var(--erp-border)'}}>Solicitar ajustes</button><button disabled={!edit.scheduled_at} onClick={()=>run('approve',async()=>{await api.patch(`/marketing/content/${selected.id}`,{caption:edit.caption});return api.post(`/marketing/content/${selected.id}/approve`,{scheduled_at:new Date(edit.scheduled_at).toISOString()});},'Aprovado e agendado.')} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-semibold text-white disabled:opacity-50"><Check size={15}/>Aprovar e agendar</button></div>}
            {canPublish&&<button onClick={()=>run('publish',()=>api.post(`/marketing/content/${selected.id}/publish`),'Publicação enviada para a Meta.')} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white" style={{background:'var(--erp-violet)'}}>{busy==='publish'?<Loader2 size={16} className="animate-spin"/>:<Send size={16}/>}Publicar agora</button>}
            {selected.status==='scheduled'&&<p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800">O 4Core enviará automaticamente no horário aprovado.</p>}
            {selected.status==='published'&&<p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800"><Check size={14} className="mr-1 inline"/>Publicado em {selected.published_at?new Date(selected.published_at).toLocaleString('pt-BR'):'agora'}.</p>}
          </div>
        </div>
      </>}</section>
    </div>
  </div>;
}
