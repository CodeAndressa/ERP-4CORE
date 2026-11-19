import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Brain, CalendarClock, Camera, Check, ChevronRight, Clapperboard, Download, ExternalLink, Lightbulb, Loader2, MessageSquarePlus, Plus, RefreshCw, Send, Smartphone, Sparkles, ThumbsDown, ThumbsUp, Trash2, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { Button } from '../../shared/components/ui/Button';
import { Modal } from '../../shared/components/ui/Modal';
import { PageHeader } from '../../shared/components/layout';
import { kindVisual } from '../../shared/scheduleKinds';

type Status = 'draft' | 'generating' | 'awaiting_approval' | 'approved' | 'scheduled' | 'publishing' | 'published' | 'rejected' | 'failed';
type Layout = 'feed' | 'story' | 'reel';
type Content = { id:number; title:string; brief:string; caption:string; headline:string; revision_notes:string; channel:'instagram'|'facebook'|'both'; layout:Layout; status:Status; scheduled_at:string|null; approved_at:string|null; published_at:string|null; art_ready:boolean; error_message:string; updated_at:string };
type ConfigStatus = { api_version?:number; feedback_learning?:boolean; art_generation:boolean; art_provider:string|null; storage:boolean; meta:boolean; scheduler:boolean };
type TopicSuggestion = { title:string; pillar:string; objective:string; brief:string };
type Sentiment = 'liked' | 'disliked';
type Feedback = { id:number; sentiment:Sentiment; aspects:string[]; notes:string; headline:string; created_at:string };
type Learning = { total:number; liked:number; disliked:number; copy_rules:string[]; image_rules:string[]; distilled_at:string|null; pending:number; distill_minimum:number };

// Espelha ASPECT_LABELS do backend — cada tag decide se a lição vai para o prompt
// da imagem ou para o da redação, então os valores precisam bater exatamente.
const aspectList = [['imagem','Imagem'],['cores','Cores'],['texto','Frase'],['tom','Tom'],['legibilidade','Legibilidade'],['marca','Logo e link']] as const;

// Cada status aponta para os tokens semanticos, nao para hex. Antes eram nove
// pares de hex nus que nao existiam em lugar nenhum do sistema: '#b54708' e
// '#b45309' (o token) sao amareis diferentes, e ninguem notava.
const statusInfo: Record<Status, [string, string, string]> = {
  draft: ['Rascunho', 'var(--erp-text-muted)', 'var(--erp-surface-2)'],
  generating: ['Gerando', 'var(--erp-violet)', 'var(--erp-violet-soft)'],
  awaiting_approval: ['Aguardando aprovação', 'var(--erp-amber)', 'var(--erp-amber-soft)'],
  approved: ['Aprovado', 'var(--erp-emerald)', 'var(--erp-emerald-soft)'],
  scheduled: ['Agendado', 'var(--erp-cyan-deep)', 'var(--erp-cyan-soft)'],
  publishing: ['Publicando', 'var(--erp-violet)', 'var(--erp-violet-soft)'],
  published: ['Publicado', 'var(--erp-emerald)', 'var(--erp-emerald-soft)'],
  rejected: ['Ajustes solicitados', 'var(--erp-amber)', 'var(--erp-amber-soft)'],
  failed: ['Falha no envio', 'var(--erp-rose)', 'var(--erp-rose-soft)'],
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
function friendlyError(value:string) {
  if(isBillingError(value))return 'A OpenAI bloqueou a geração porque o limite de cobrança do projeto foi atingido. Regularize os créditos ou aumente o limite e tente novamente.';
  if(value.includes('model_not_found')||value.includes('does not exist'))return 'O modelo de IA configurado foi descontinuado. Atualize o backend e tente gerar novamente.';
  return value;
}
// Reel não entra em scheduleKinds: no Calendário ele conta como post de feed
// (é onde aparece no perfil). Aqui no Estúdio ganha selo próprio porque o fluxo
// é outro: vídeo em vez de imagem.
const REEL_VISUAL = { label: 'Reel', soft: 'var(--erp-rose-soft)', ink: 'var(--erp-rose)' };
function layoutVisual(layout: Layout) { return layout === 'reel' ? REEL_VISUAL : kindVisual(layout); }
const VIDEO_TYPES = ['video/mp4', 'video/quicktime'];
const MAX_VIDEO_MB = 200;

/** Vídeo vai direto do navegador ao Supabase Storage quando há Storage: a API na
 *  Vercel corta uploads acima de ~4,5 MB. Sem Storage (local), sobe pela API. */
async function uploadReelVideo(contentId: number, file: File) {
  if (!VIDEO_TYPES.includes(file.type)) throw { response: { data: { detail: 'Envie o Reel em MP4 ou MOV.' } } };
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) throw { response: { data: { detail: `O vídeo deve ter no máximo ${MAX_VIDEO_MB} MB.` } } };
  const { data } = await api.post<{ mode: 'signed' | 'direct'; upload_url?: string; object_path?: string }>(
    `/marketing/content/${contentId}/video/upload-url`, { content_type: file.type },
  );
  if (data.mode === 'signed' && data.upload_url && data.object_path) {
    const sent = await fetch(data.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type, 'x-upsert': 'false' }, body: file });
    if (!sent.ok) throw { response: { data: { detail: `O Storage recusou o vídeo (${sent.status}). Arquivos muito grandes podem passar do limite do bucket.` } } };
    await api.post(`/marketing/content/${contentId}/video/confirm`, { object_path: data.object_path });
    return;
  }
  const body = new FormData(); body.append('file', file);
  // Sem timeout: o padrão de 30 s do axios cortaria vídeos maiores no meio.
  await api.post(`/marketing/content/${contentId}/video/upload`, body, { timeout: 0 });
}

function message(error:unknown) { const detail=(error as {response?:{data?:{detail?:string}}}).response?.data?.detail; return friendlyError(detail||'Não foi possível concluir esta ação.'); }
function Pill({status}:{status:Status}) { const [label,color,bg]=statusInfo[status]; return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={{color,background:bg}}>{label}</span>; }

export default function EstudioConteudoPage() {
  const [items,setItems]=useState<Content[]>([]), [selectedId,setSelectedId]=useState<number|null>(null);
  const [loading,setLoading]=useState(true), [busy,setBusy]=useState(''), [filter,setFilter]=useState('all'), [creating,setCreating]=useState(false);
  const [artUrl,setArtUrl]=useState('');
  const [config,setConfig]=useState<ConfigStatus|null>(null);
  const [suggestions,setSuggestions]=useState<TopicSuggestion[]>([]), [showSuggestions,setShowSuggestions]=useState(false), [suggesting,setSuggesting]=useState(false);
  const [form,setForm]=useState({title:'',brief:'',channel:'instagram',layout:'feed' as 'feed'|'reel',scheduled_at:tomorrow()});
  const [newArtFile,setNewArtFile]=useState<File|null>(null);
  const [edit,setEdit]=useState({caption:'',brief:'',scheduled_at:''});
  const videoRef=useRef<HTMLInputElement>(null);
  const [captionRef,setCaptionRef]=useState('');
  const [editingScheduled,setEditingScheduled]=useState(false);
  const [composer,setComposer]=useState<''|Sentiment|'reject'>('');
  const [notes,setNotes]=useState(''), [aspects,setAspects]=useState<string[]>([]);
  const [feedback,setFeedback]=useState<Feedback[]>([]);
  const [learning,setLearning]=useState<Learning|null>(null), [showLearning,setShowLearning]=useState(false);
  const uploadRef=useRef<HTMLInputElement>(null);
  const newArtRef=useRef<HTMLInputElement>(null);
  const selected=items.find(x=>x.id===selectedId)||null;
  const activeStatuses=filters.find(x=>x[0]===filter)?.[2]||[];
  const visible=useMemo(()=>items.filter(x=>!activeStatuses.length||(activeStatuses as readonly string[]).includes(x.status)),[items,activeStatuses]);
  const feedbackEnabled=config?.feedback_learning===true;

  async function load(id?:number) {
    try { const [{data},{data:ready}]=await Promise.all([api.get<{items:Content[]}>('/marketing/content'),api.get<ConfigStatus>('/marketing/content/config/status')]); setItems(data.items); setConfig(ready); setSelectedId(v=>id??(v&&data.items.some(item=>item.id===v)?v:null)??data.items[0]?.id??null); if(ready.feedback_learning)void loadLearning(); }
    catch(e){toast.error(message(e));} finally{setLoading(false);}
  }
  async function loadLearning() {
    try{const {data}=await api.get<Learning>('/marketing/content/learning');setLearning(data);}catch{/* aprendizado nunca bloqueia a tela */}
  }
  useEffect(()=>{void load();},[]);
  useEffect(()=>{
    setEdit({caption:selected?.caption||'',brief:selected?.brief||'',scheduled_at:localInput(selected?.scheduled_at)}); setArtUrl(''); setCaptionRef(''); setEditingScheduled(false);
    setComposer(''); setNotes(''); setAspects([]); setFeedback([]);
    if(selected&&config?.feedback_learning)api.get<{items:Feedback[]}>(`/marketing/content/${selected.id}/feedback`).then(({data})=>setFeedback(data.items)).catch(()=>undefined);
    if(!selected?.art_ready)return; let active=true,url='';
    const blob=()=>api.get(`/marketing/content/${selected.id}/art`,{responseType:'blob'}).then(({data})=>{url=URL.createObjectURL(data);if(active)setArtUrl(url);});
    // Reel no Storage toca direto da URL assinada: a API na Vercel não devolve
    // um vídeo inteiro. Sem Storage (local) cai no /art como as imagens.
    if(selected.layout==='reel')api.get<{url:string|null}>(`/marketing/content/${selected.id}/video-url`).then(({data})=>data.url?(active&&setArtUrl(data.url)):blob()).catch(()=>undefined);
    else blob().catch(()=>undefined);
    return()=>{active=false;if(url)URL.revokeObjectURL(url);};
  },[selected?.id,selected?.art_ready,selected?.updated_at,config?.feedback_learning]);

  async function create() {
    if(form.title.trim().length<3)return toast.error('Informe um título curto para identificar a publicação.');
    const reel=form.layout==='reel';
    // Reel pode nascer só com o roteiro: o vídeo costuma ser gravado depois.
    if(!reel&&!newArtFile)return toast.error('Selecione a imagem que deseja publicar.');
    setBusy('create');
    try {
      const {data}=await api.post<Content>('/marketing/content',{title:form.title,brief:reel?form.brief:'',channel:reel?'instagram':form.channel,layout:form.layout,scheduled_at:null});
      if(reel&&newArtFile) await uploadReelVideo(data.id,newArtFile);
      else if(newArtFile){ const body=new FormData(); body.append('file',newArtFile); await api.post(`/marketing/content/${data.id}/art/upload`,body); }
      setCreating(false); setForm({title:'',brief:'',channel:'instagram',layout:'feed',scheduled_at:tomorrow()}); setNewArtFile(null);
      await load(data.id); toast.success(reel?(newArtFile?'Vídeo enviado. Sugira a legenda e escolha a data.':'Reel criado. Envie o vídeo quando estiver pronto.'):'Imagem enviada. Sugira a legenda e escolha a data.');
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
  async function uploadVideo(file?:File) {
    if(!selected||!file)return; setBusy('video');
    try{await uploadReelVideo(selected.id,file);await load(selected.id);toast.success('Vídeo recebido e enviado para aprovação.');}
    catch(e){toast.error(message(e),{duration:6000});}finally{setBusy('');if(videoRef.current)videoRef.current.value='';}
  }
  async function suggestCaption() {
    if(!selected)return; setBusy('caption');
    try{await api.post(`/marketing/content/${selected.id}/generate-caption`,{caption_reference:captionRef});await load(selected.id);toast.success('Legenda sugerida.');}
    catch(e){toast.error(message(e),{duration:6000});}finally{setBusy('');}
  }
  function openComposer(mode:''|Sentiment|'reject') { setComposer(mode); setNotes(''); setAspects([]); }
  function toggleAspect(value:string) { setAspects(list=>list.includes(value)?list.filter(x=>x!==value):[...list,value]); }
  async function sendFeedback() {
    if(!selected)return;
    if(!feedbackEnabled)return toast.error('O aprendizado requer a versão atualizada do backend.');
    if(!notes.trim()&&!aspects.length)return toast.error('Escreva o que achou ou marque ao menos um aspecto.');
    setBusy('feedback');
    try {
      if(composer==='reject'){
        await api.post(`/marketing/content/${selected.id}/reject`,{reason:notes,aspects});
        toast.success('Ajustes registrados. A IA já aprendeu e vai aplicar na próxima versão.');
      } else {
        await api.post(`/marketing/content/${selected.id}/feedback`,{sentiment:composer||'disliked',notes,aspects});
        toast.success(composer==='liked'?'Anotado. A IA vai manter esse padrão.':'Anotado. A IA não vai repetir isso.');
      }
      openComposer(''); await load(selected.id); await loadLearning();
      const {data}=await api.get<{items:Feedback[]}>(`/marketing/content/${selected.id}/feedback`); setFeedback(data.items);
    } catch(e){toast.error(message(e),{duration:6000});} finally{setBusy('');}
  }
  async function removeFeedback(id:number) {
    if(!feedbackEnabled)return toast.error('O aprendizado requer a versão atualizada do backend.');
    setBusy(`fb-${id}`);
    try{await api.delete(`/marketing/content/learning/feedback/${id}`);setFeedback(list=>list.filter(x=>x.id!==id));await loadLearning();toast.success('Feedback removido do aprendizado.');}
    catch(e){toast.error(message(e));}finally{setBusy('');}
  }
  async function run(name:string, request:()=>Promise<unknown>, success:string) {
    if(!selected)return; setBusy(name);
    try{await request();await load(selected.id);toast.success(success);}catch(e){await load(selected.id);toast.error(message(e),{duration:6000});}finally{setBusy('');}
  }

  const canModify=!!selected&&!['generating','publishing','published'].includes(selected.status);
  const canApprove=!!selected?.art_ready&&['awaiting_approval','rejected'].includes(selected.status);
  const canPublish=!!selected?.approved_at&&['approved','scheduled','failed'].includes(selected.status);
  const locked=selected?.status==='scheduled'&&!editingScheduled;
  const canEdit=canModify&&!locked;

  return <div className="space-y-5">
    {/* O cabecalho vem do sistema, como nas outras telas. Antes era um <h1> na
        mao, com eyebrow, tamanho e espacamento proprios, e por isso ficava fora
        de qualquer acerto feito no componente compartilhado. A largura maxima
        tambem saiu daqui: quem define isso agora e o container do AppLayout. */}
    <PageHeader
      eyebrow="Marketing"
      title="Estúdio de conteúdo"
      description="Crie, aprove e agende publicações sem sair do 4Core"
      aiModule="Estúdio de conteúdo"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" icon={<Brain size={15} />} onClick={() => setShowLearning(true)}>
            {learning?.total ? `Aprendizado (${learning.total})` : 'Aprendizado'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Lightbulb size={15} />}
            onClick={() => (suggestions.length ? setShowSuggestions(true) : void loadSuggestions())}
          >
            Ideias da IA
          </Button>
          <Button size="sm" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
            Nova publicação
          </Button>
        </div>
      }
    />

    <Modal open={showLearning} onClose={() => setShowLearning(false)} title="O que a IA aprendeu" description="As licoes que o seu feedback ja virou regra." size="lg">
      <div>
      {!learning?.total?<div className="p-8 text-center"><Brain className="mx-auto mb-3" size={24} style={{color:'var(--erp-text-dim)'}}/><p className="text-sm font-medium">Nenhum feedback ainda</p><p className="mx-auto mt-1 max-w-md text-xs" style={{color:'var(--erp-text-muted)'}}>Use os botões Gostei e Não gostei embaixo de cada arte de story. A partir do primeiro feedback a próxima geração já sai diferente.</p></div>:<div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full px-2.5 py-1 font-semibold" style={{background:'var(--erp-violet-dim)',color:'var(--erp-violet)'}}>{learning.total} feedback{learning.total>1?'s':''}</span><span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">{learning.liked} aprovado{learning.liked===1?'':'s'}</span><span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">{learning.disliked} reprovado{learning.disliked===1?'':'s'}</span>{learning.total<learning.distill_minimum&&<span className="rounded-full px-2.5 py-1" style={{background:'var(--erp-surface-2)',color:'var(--erp-text-muted)'}}>Regras condensadas a partir de {learning.distill_minimum} feedbacks</span>}</div>
        {(learning.copy_rules.length||learning.image_rules.length)?<div className="grid gap-4 md:grid-cols-2">
          <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{color:'var(--erp-text-muted)'}}>Regras de frase e tom</p><ul className="space-y-1.5">{learning.copy_rules.map((rule,i)=><li key={i} className="rounded-xl px-3 py-2 text-xs leading-relaxed" style={{background:'var(--erp-surface-2)'}}>{rule}</li>)}{!learning.copy_rules.length&&<li className="text-xs" style={{color:'var(--erp-text-dim)'}}>Nada consolidado ainda.</li>}</ul></div>
          <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{color:'var(--erp-text-muted)'}}>Regras de imagem</p><ul className="space-y-1.5">{learning.image_rules.map((rule,i)=><li key={i} className="rounded-xl px-3 py-2 text-xs leading-relaxed" style={{background:'var(--erp-surface-2)'}}>{rule}</li>)}{!learning.image_rules.length&&<li className="text-xs" style={{color:'var(--erp-text-dim)'}}>Nada consolidado ainda.</li>}</ul></div>
        </div>:<p className="rounded-xl p-3 text-xs" style={{background:'var(--erp-violet-dim)',color:'var(--erp-violet)'}}>Seus {learning.total} feedback{learning.total>1?'s':''} já estão valendo nas gerações, na íntegra. A partir de {learning.distill_minimum} a IA condensa tudo em regras curtas e elas aparecem aqui.</p>}
      </div>}
      </div>
    </Modal>

    {config&&(!config.art_generation||!config.scheduler)&&<div className="flex items-start gap-2 rounded-xl border p-3 text-xs" style={{borderColor:'var(--erp-amber-border)',background:'var(--erp-amber-soft)',color:'var(--erp-amber)'}}><AlertCircle size={15} className="mt-.5 shrink-0"/><span>{!config.art_generation&&<>Para gerar as artes, configure as credenciais do <b>Cloudflare Workers AI</b> ou <b>OPENAI_API_KEY</b> no backend. </>}{!config.scheduler&&<>Para o envio automático, use o mesmo <b>MARKETING_CRON_SECRET</b> no backend e nos Secrets do GitHub.</>} Os briefings ficam salvos como rascunho enquanto a configuração estiver incompleta.</span></div>}

    <Modal open={showSuggestions} onClose={() => setShowSuggestions(false)} title="Ideias da IA" description="Pautas sugeridas a partir do que ja foi publicado." size="lg">
      <div>
      {suggesting?<div className="flex min-h-48 items-center justify-center gap-2 text-sm" style={{color:'var(--erp-text-muted)'}}><Loader2 size={18} className="animate-spin"/>Analisando pautas e evitando repetições...</div>:<div className="divide-y" style={{borderColor:'var(--erp-border)'}}>{suggestions.map((idea,index)=><article key={`${idea.title}-${index}`} className="grid gap-3 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"><div className="min-w-0"><span className="inline-flex rounded-full px-2 py-1 text-xs font-semibold" style={{background:'var(--erp-violet-dim)',color:'var(--erp-violet)'}}>{idea.pillar}</span><h3 className="mt-2 font-semibold">{idea.title}</h3><p className="mt-1 text-sm" style={{color:'var(--erp-text-muted)'}}>{idea.objective}</p></div><button disabled={!!busy} onClick={()=>void developIdea(idea)} className="flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-white disabled:opacity-50" style={{background:'var(--erp-violet)'}}>{busy==='create'?<Loader2 size={14} className="animate-spin"/>:<Sparkles size={14}/>}Gerar story</button></article>)}</div>}
      </div>
    </Modal>

    {/* `min-w-max` evita que os chips se espremam abaixo do alvo de toque quando
        a tela e estreita: eles passam a rolar, que e o comportamento esperado. */}
    <div className="flex gap-1 overflow-x-auto rounded-xl border bg-white p-1" role="tablist" style={{borderColor:'var(--erp-border)'}}>{filters.map(([id,label,statuses])=>{
      const count=id==='all'?items.length:items.filter(x=>(statuses as readonly string[]).includes(x.status)).length, active=filter===id;
      return <button key={id} onClick={()=>setFilter(id)} className="flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold" style={{background:active?'var(--erp-violet-dim)':'transparent',color:active?'var(--erp-violet)':'var(--erp-text-muted)'}}>{label}<span className="rounded-full bg-white px-1.5 py-.5 text-xs" style={{border:'1px solid var(--erp-border)'}}>{count}</span></button>;
    })}</div>

    <Modal open={creating} onClose={() => setCreating(false)} title="Nova publicação" description={form.layout==='reel'?'Envie o vídeo agora ou só o roteiro; a legenda a IA sugere depois.':'Envie a imagem pronta; a legenda a IA sugere depois.'} size="lg">
      <div>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Formato">{([['feed','Post de feed','Imagem 4:5',Camera],['reel','Reel','Vídeo 9:16',Clapperboard]] as const).map(([value,label,hint,Icon])=>{const on=form.layout===value;return <button key={value} type="button" role="radio" aria-checked={on} onClick={()=>{setForm({...form,layout:value});setNewArtFile(null);}} className="flex min-h-14 items-center gap-2.5 rounded-xl border px-3 text-left" style={{borderColor:on?'var(--erp-violet)':'var(--erp-border)',background:on?'var(--erp-violet-dim)':'#fff'}}><Icon size={18} style={{color:on?'var(--erp-violet)':'var(--erp-text-muted)'}}/><span><b className="block text-sm">{label}</b><span className="text-xs" style={{color:'var(--erp-text-muted)'}}>{hint}</span></span></button>;})}</div>
        <label className="space-y-1.5 text-xs font-medium"><span>Título (uso interno, não aparece no post)</span><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder={form.layout==='reel'?'Ex.: Reel — Portaria 671 em 30 segundos':'Ex.: Post sobre controle de acesso'} className="min-h-11 w-full rounded-xl border px-3 text-sm outline-none" style={{borderColor:'var(--erp-border)'}}/></label>
        {form.layout==='reel'&&<label className="space-y-1.5 text-xs font-medium"><span>Roteiro (opcional)</span><textarea rows={5} value={form.brief} onChange={e=>setForm({...form,brief:e.target.value})} placeholder="Gancho, cenas e chamada final — a IA usa o roteiro para sugerir a legenda." className="w-full resize-none rounded-xl border p-3 text-sm outline-none" style={{borderColor:'var(--erp-border)'}}/></label>}
        <label className="block space-y-1.5 text-xs font-medium"><span>{form.layout==='reel'?'Vídeo do Reel (pode enviar depois)':'Imagem da publicação'}</span><button type="button" onClick={()=>newArtRef.current?.click()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed px-3 text-sm font-semibold" style={{borderColor:'var(--erp-border)',color:'var(--erp-violet)'}}><Upload size={15}/>{newArtFile?newArtFile.name:form.layout==='reel'?`Selecionar vídeo (MP4 ou MOV, 9:16, até ${MAX_VIDEO_MB} MB)`:'Selecionar imagem (PNG, JPG ou WEBP, 4:5)'}</button><input key={form.layout} ref={newArtRef} type="file" accept={form.layout==='reel'?VIDEO_TYPES.join(','):'image/png,image/jpeg,image/webp'} className="hidden" onChange={e=>setNewArtFile(e.target.files?.[0]||null)}/></label>
      </div><div className="mt-4 flex justify-end"><button disabled={!!busy} onClick={()=>void create()} className="flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60" style={{background:'var(--erp-violet)'}}>{busy==='create'?<Loader2 size={16} className="animate-spin"/>:<Upload size={16}/>}{form.layout==='reel'?(newArtFile?'Criar Reel e enviar vídeo':'Criar Reel'):'Enviar imagem'}</button></div>
      </div>
    </Modal>

    <div className="grid overflow-hidden rounded-2xl border bg-white lg:min-h-[620px] lg:grid-cols-[370px_minmax(0,1fr)]" style={{borderColor:'var(--erp-border)'}}>
      <section className="border-b lg:border-b-0 lg:border-r" style={{borderColor:'var(--erp-border)'}}>
        <div className="flex h-14 items-center justify-between border-b px-4" style={{borderColor:'var(--erp-border)'}}><b className="text-sm">Fila editorial</b><button onClick={()=>{setLoading(true);void load();}} className="flex h-10 w-10 items-center justify-center"><RefreshCw size={15} className={loading?'animate-spin':''}/></button></div>
        <div className="lg:max-h-[560px] lg:overflow-y-auto">{loading&&<div className="space-y-2 p-3">{[1,2,3,4].map(i=><div key={i} className="h-[88px] animate-pulse rounded-xl" style={{background:'var(--erp-surface-2)'}}/>)}</div>}{!loading&&!visible.length&&<div className="p-10 text-center"><Sparkles className="mx-auto mb-3" size={24} style={{color:'var(--erp-text-dim)'}}/><p className="text-sm font-medium">Nada neste filtro</p></div>}{!loading&&visible.map(item=><button key={item.id} onClick={()=>setSelectedId(item.id)} className="flex min-h-[104px] w-full items-center gap-3 border-b px-4 py-3 text-left" style={{borderColor:'var(--erp-border)',background:item.id===selectedId?'var(--erp-violet-dim)':'#fff'}}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{background:layoutVisual(item.layout).soft,color:layoutVisual(item.layout).ink}}>{item.layout==='story'?<Smartphone size={18}/>:item.layout==='reel'?<Clapperboard size={18}/>:<Camera size={18}/>}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{item.title}</b><span className="mt-1.5 flex items-center gap-1.5"><Pill status={item.status}/><span className="rounded-full px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide" style={{background:layoutVisual(item.layout).soft,color:layoutVisual(item.layout).ink}}>{layoutVisual(item.layout).label}</span></span>{item.scheduled_at&&<small className="mt-1.5 flex items-center gap-1" style={{color:'var(--erp-text-muted)'}}><CalendarClock size={11}/>{new Date(item.scheduled_at).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</small>}</span><ChevronRight size={15}/></button>)}</div>
      </section>

      <section className="min-w-0">{!selected?<div className="flex h-full min-h-[520px] flex-col items-center justify-center text-center"><Sparkles size={30} style={{color:'var(--erp-text-dim)'}}/><p className="mt-4 font-semibold">Selecione uma publicação</p></div>:<>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4 sm:p-5" style={{borderColor:'var(--erp-border)'}}><div className="min-w-0"><Pill status={selected.status}/><h2 className="mt-2 text-lg font-bold">{selected.title}</h2><p className="text-xs" style={{color:'var(--erp-text-muted)'}}>{selected.layout==='story'?'Story 9:16':selected.layout==='reel'?'Reel 9:16 (vídeo)':'Retrato 4:5'} · {selected.channel}</p></div><div className="flex shrink-0 flex-wrap items-center gap-2">
          {canApprove&&<>
            <button onClick={()=>openComposer('reject')} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold" style={{borderColor:'var(--erp-border)',color:'var(--erp-text)'}}><MessageSquarePlus size={15}/>Pedir ajuste</button>
            <button disabled={!edit.scheduled_at} title={!edit.scheduled_at?'Escolha a data de publicacao antes de aprovar':'Aprova a peca e agenda para a data escolhida'} onClick={()=>run('approve',async()=>{await api.patch(`/marketing/content/${selected.id}`,{caption:edit.caption});return api.post(`/marketing/content/${selected.id}/approve`,{scheduled_at:new Date(edit.scheduled_at).toISOString()});},'Aprovado e agendado.')} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold text-white disabled:opacity-50" style={{background:'var(--erp-emerald)'}}><Check size={15}/>Aprovar e agendar</button>
          </>}
          {canModify&&<button onClick={()=>run('delete',()=>api.delete(`/marketing/content/${selected.id}`),'Publicação excluída.').then(()=>load())} className="flex h-10 w-10 items-center justify-center rounded-xl border text-red-700" style={{borderColor:'var(--erp-border)'}}><Trash2 size={15}/></button>}
        </div></div>
        {selected.revision_notes&&<div className="m-4 rounded-xl border p-3 sm:m-5" style={{borderColor:'var(--erp-amber-border)',background:'var(--erp-amber-soft)'}}><p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-800"><MessageSquarePlus size={13}/>Ajustes pedidos nesta peça</p><p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-amber-900">{selected.revision_notes}</p><p className="mt-2 text-xs text-amber-700">A próxima versão gerada precisa resolver todos eles.</p></div>}
        {selected.error_message&&<div className="m-4 flex items-start gap-2 rounded-xl border p-3 text-xs text-red-700 sm:m-5" style={{borderColor:'var(--erp-rose-border)',background:'var(--erp-rose-soft)'}}><AlertCircle size={15} className="mt-0.5 shrink-0"/><span>{friendlyError(selected.error_message)}{isBillingError(selected.error_message)&&<a href="https://platform.openai.com/settings/organization/billing" target="_blank" rel="noreferrer" className="mt-1 block font-semibold underline">Abrir cobrança da OpenAI</a>}</span></div>}
        <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-[minmax(280px,440px)_1fr]">
          <div><div className="mb-2 flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wider" style={{color:'var(--erp-text-muted)'}}>{selected.layout==='reel'?'Vídeo':'Arte'}</p>{canEdit&&selected.layout==='story'&&<button disabled={!!busy} onClick={()=>run('generate',()=>api.post(`/marketing/content/${selected.id}/generate`),'Nova versão pronta para aprovação.')} className="flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-white disabled:opacity-60" style={{background:'var(--erp-violet)'}}>{busy==='generate'?<Loader2 size={15} className="animate-spin"/>:<Sparkles size={15}/>}Gerar {selected.art_ready?'nova versão':'story'}</button>}</div><div className={`mx-auto w-full overflow-hidden rounded-2xl border ${selected.layout==='feed'?'aspect-[4/5] max-w-[300px]':'aspect-[9/16] max-w-[230px]'}`} style={{borderColor:'var(--erp-border)',background:'var(--erp-surface-2)'}}>{artUrl?(selected.layout==='reel'?<video key={artUrl} src={artUrl} controls playsInline preload="metadata" className="h-full w-full bg-black object-contain"/>:<img src={artUrl} alt={selected.title} className="h-full w-full object-cover"/>):<div className="flex h-full flex-col items-center justify-center px-4 text-center">{selected.layout==='reel'?<Clapperboard size={28}/>:<Sparkles size={28}/>}<p className="mt-3 text-sm font-medium">{selected.layout==='reel'?(selected.art_ready?'Carregando vídeo…':'Vídeo ainda não enviado'):'Arte ainda não gerada'}</p><p className="mt-1 text-xs" style={{color:'var(--erp-text-muted)'}}>Formato {selected.layout==='feed'?'retrato 4:5':selected.layout==='reel'?'Reel 9:16 · MP4 ou MOV':'story 9:16'}</p></div>}</div>
            {selected.layout==='reel'&&<div className="mt-3 space-y-3 border-t pt-3" style={{borderColor:'var(--erp-border)'}}>
              {canEdit&&<><button disabled={!!busy} onClick={()=>videoRef.current?.click()} className={`flex min-h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-semibold disabled:opacity-50 ${selected.art_ready?'border':'text-white'}`} style={selected.art_ready?{borderColor:'var(--erp-border)'}:{background:'var(--erp-violet)'}}>{busy==='video'?<Loader2 size={14} className="animate-spin"/>:<Upload size={14}/>}{busy==='video'?'Enviando vídeo…':selected.art_ready?'Trocar vídeo':'Enviar vídeo do Reel'}</button><input ref={videoRef} type="file" accept={VIDEO_TYPES.join(',')} className="hidden" onChange={event=>void uploadVideo(event.target.files?.[0])}/><p className="text-xs" style={{color:'var(--erp-text-dim)'}}>MP4 ou MOV em 9:16 · recomendado 1080 × 1920 px, de 5 s a 90 s · até {MAX_VIDEO_MB} MB. Trocar o vídeo volta o Reel para aprovação.</p></>}
              {composer==='reject'&&<div className="space-y-2 rounded-xl border p-3" style={{borderColor:'var(--erp-amber-border)',background:'var(--erp-amber-soft)'}}><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">O que precisa mudar neste Reel?</p><button aria-label="Cancelar" onClick={()=>openComposer('')} className="flex h-8 w-8 items-center justify-center"><X size={14}/></button></div><textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Ex.: cortar o gancho para 2 s e trocar a música" className="w-full resize-none rounded-xl border bg-white p-3 text-xs leading-relaxed" style={{borderColor:'var(--erp-border)'}}/><button disabled={!!busy||!notes.trim()} onClick={()=>void sendFeedback()} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white disabled:opacity-60" style={{background:'var(--erp-amber)'}}>{busy==='feedback'?<Loader2 size={14} className="animate-spin"/>:<MessageSquarePlus size={14}/>}Registrar ajustes</button></div>}
              <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-wider" style={{color:'var(--erp-text-muted)'}}>Roteiro</span><textarea disabled={!canEdit} rows={9} value={edit.brief} onChange={e=>setEdit({...edit,brief:e.target.value})} placeholder="Gancho, cenas e chamada final." className="w-full resize-y rounded-xl border p-3 text-xs leading-relaxed disabled:bg-slate-50" style={{borderColor:'var(--erp-border)'}}/></label>
            </div>}{selected.layout==='story'&&selected.art_ready&&<div className="mt-3 space-y-3 border-t pt-3" style={{borderColor:'var(--erp-border)'}}>
            {selected.headline&&<div><p className="text-xs font-semibold uppercase tracking-wider" style={{color:'var(--erp-text-muted)'}}>Frase na arte</p><p className="mt-1 text-sm font-semibold leading-snug">{selected.headline}</p></div>}
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">O que você achou desta arte?</p><p className="mt-1 text-xs leading-relaxed" style={{color:'var(--erp-text-muted)'}}>Vale para todos os próximos stories, não só para este. A IA aprende a cada feedback.</p></div></div>
            {!composer&&<div className="grid gap-2 sm:grid-cols-2"><button disabled={!!busy} onClick={()=>openComposer('liked')} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border text-xs font-semibold text-emerald-700 disabled:opacity-50" style={{borderColor:'var(--erp-border)'}}><ThumbsUp size={14}/>Gostei</button><button disabled={!!busy} onClick={()=>openComposer('disliked')} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border text-xs font-semibold text-amber-700 disabled:opacity-50" style={{borderColor:'var(--erp-border)'}}><ThumbsDown size={14}/>Não gostei</button></div>}
            {!!composer&&<div className="space-y-3 rounded-xl border p-3" style={{borderColor:'var(--erp-border)',background:'var(--erp-surface-2)'}}>
              <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">{composer==='liked'?'O que funcionou bem?':composer==='reject'?'O que precisa mudar nesta peça?':'O que não funcionou?'}</p><button aria-label="Cancelar" onClick={()=>openComposer('')} className="flex h-8 w-8 items-center justify-center"><X size={14}/></button></div>
              <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-wider" style={{color:'var(--erp-text-muted)'}}>Onde exatamente</p><div className="flex flex-wrap gap-1.5">{aspectList.map(([value,label])=>{const on=aspects.includes(value);return <button key={value} onClick={()=>toggleAspect(value)} className="min-h-9 rounded-full border px-3 text-xs font-semibold" style={on?{borderColor:'var(--erp-violet)',background:'var(--erp-violet)',color:'#fff'}:{borderColor:'var(--erp-border)',background:'#fff',color:'var(--erp-text-muted)'}}>{label}</button>;})}</div></div>
              <textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder={composer==='liked'?'Ex.: a foto ficou realista e a frase curta funcionou bem':'Ex.: a pessoa ficou com cara de boneco e o fundo puxou pro azul'} className="w-full resize-none rounded-xl border p-3 text-xs leading-relaxed" style={{borderColor:'var(--erp-border)'}}/>
              <button disabled={!!busy} onClick={()=>void sendFeedback()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white disabled:opacity-60" style={{background:'var(--erp-violet)'}}>{busy==='feedback'?<Loader2 size={14} className="animate-spin"/>:<Brain size={14}/>}{composer==='reject'?'Registrar ajustes e ensinar a IA':'Ensinar a IA'}</button>
            </div>}
            {!!feedback.length&&<div className="space-y-1.5"><p className="text-xs font-semibold uppercase tracking-wider" style={{color:'var(--erp-text-muted)'}}>Feedback desta arte</p>{feedback.map(item=><div key={item.id} className="flex items-start gap-2 rounded-xl px-3 py-2" style={{background:'var(--erp-surface-2)'}}>{item.sentiment==='liked'?<ThumbsUp size={13} className="mt-0.5 shrink-0 text-emerald-700"/>:<ThumbsDown size={13} className="mt-0.5 shrink-0 text-amber-700"/>}<span className="min-w-0 flex-1"><span className="block text-xs leading-relaxed">{item.notes||'Sem comentário'}</span>{!!item.aspects.length&&<span className="mt-1 block text-xs font-semibold uppercase tracking-wide" style={{color:'var(--erp-text-dim)'}}>{item.aspects.join(' · ')}</span>}</span><button aria-label="Remover feedback" disabled={!!busy} onClick={()=>void removeFeedback(item.id)} className="flex h-7 w-7 shrink-0 items-center justify-center disabled:opacity-40">{busy===`fb-${item.id}`?<Loader2 size={12} className="animate-spin"/>:<Trash2 size={12} style={{color:'var(--erp-text-dim)'}}/>}</button></div>)}</div>}
          </div>}{canEdit&&selected.layout==='feed'&&<div className="mt-3 border-t pt-3" style={{borderColor:'var(--erp-border)'}}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{selected.art_ready?'Editar no Canva ou enviar outra arte':'Envie a imagem da publicação'}</p><p className="mt-1 text-xs leading-relaxed" style={{color:'var(--erp-text-muted)'}}>{selected.art_ready?'Baixe o PPTX 4:5, edite no Canva e reenvie — ou suba direto uma nova arte.':'PNG, JPG ou WEBP no formato retrato 4:5.'}</p></div>{selected.art_ready&&<a href="https://www.canva.com/" target="_blank" rel="noreferrer" className="flex min-h-9 shrink-0 items-center gap-1.5 text-xs font-semibold" style={{color:'var(--erp-violet)'}}>Abrir Canva<ExternalLink size={13}/></a>}</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{selected.art_ready&&<button disabled={!!busy} onClick={()=>void downloadCanva()} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border text-xs font-semibold disabled:opacity-50" style={{borderColor:'var(--erp-border)'}}>{busy==='canva'?<Loader2 size={14} className="animate-spin"/>:<Download size={14}/>}Baixar editável</button>}<button disabled={!!busy} onClick={()=>uploadRef.current?.click()} className={`flex min-h-10 items-center justify-center gap-2 rounded-xl text-xs font-semibold disabled:opacity-50 ${selected.art_ready?'border':'text-white'} ${!selected.art_ready&&'sm:col-span-2'}`} style={selected.art_ready?{borderColor:'var(--erp-border)'}:{background:'var(--erp-violet)'}}>{busy==='upload'?<Loader2 size={14} className="animate-spin"/>:<Upload size={14}/>}{selected.art_ready?'Enviar arte editada':'Enviar arte pronta'}</button></div><input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event=>void uploadEditedArt(event.target.files?.[0])}/><p className="mt-2 text-xs" style={{color:'var(--erp-text-dim)'}}>Envie PNG, JPG ou WEBP em 4:5 · recomendado: 1080 × 1350 px · até 15 MB.</p></div>}</div>
          <div className="space-y-4">
            {locked&&<div className="space-y-2 rounded-xl border p-4" style={{borderColor:'var(--erp-border)',background:'var(--erp-surface-2)'}}><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{color:'var(--erp-text-muted)'}}><CalendarClock size={13}/>Agendado para</span><button onClick={()=>setEditingScheduled(true)} className="text-xs font-semibold" style={{color:'var(--erp-violet)'}}>Editar agendamento</button></div><p className="text-sm font-semibold">{selected.scheduled_at?new Date(selected.scheduled_at).toLocaleString('pt-BR',{dateStyle:'long',timeStyle:'short'}):'-'}</p>{selected.layout!=='story'&&selected.caption&&<p className="whitespace-pre-wrap text-xs leading-relaxed" style={{color:'var(--erp-text-muted)'}}>{selected.caption}</p>}</div>}
            {!locked&&<>
            {selected.layout!=='story'&&canEdit&&<label className="block space-y-2"><span className="text-xs font-semibold uppercase tracking-wider" style={{color:'var(--erp-text-muted)'}}>Legenda modelo (opcional)</span><textarea rows={3} value={captionRef} onChange={e=>setCaptionRef(e.target.value)} placeholder="Cole uma legenda de outra empresa/post pra IA imitar o estilo — o nome da empresa é sempre trocado por 4Core." className="w-full resize-none rounded-xl border p-3 text-xs leading-relaxed" style={{borderColor:'var(--erp-border)'}}/><button disabled={!!busy} onClick={()=>void suggestCaption()} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border text-xs font-semibold disabled:opacity-50" style={{borderColor:'var(--erp-border)',color:'var(--erp-violet)'}}>{busy==='caption'?<Loader2 size={14} className="animate-spin"/>:<Sparkles size={14}/>}Sugerir legenda{captionRef.trim()?' com base no modelo':' pra esta publicação'}</button></label>}
            {selected.layout!=='story'&&<label className="block space-y-2"><span className="text-xs font-semibold uppercase tracking-wider" style={{color:'var(--erp-text-muted)'}}>Legenda</span><textarea disabled={!canEdit} rows={11} value={edit.caption} onChange={e=>setEdit({...edit,caption:e.target.value})} className="w-full resize-none rounded-xl border p-3 text-sm leading-relaxed disabled:bg-slate-50" style={{borderColor:'var(--erp-border)'}}/></label>}
            {selected.layout==='story'&&<p className="rounded-xl p-3 text-xs" style={{background:'var(--erp-violet-dim)',color:'var(--erp-violet)'}}>Stories não têm legenda na Meta. A frase, o endereço <b>4core.site</b> e a logo já vêm desenhados na própria arte, porque a API da Meta não permite anexar sticker de link em story publicado por aplicativo.</p>}
            <label className="block space-y-2"><span className="text-xs font-semibold uppercase tracking-wider" style={{color:'var(--erp-text-muted)'}}>Publicar em</span><input disabled={!canEdit} type="datetime-local" value={edit.scheduled_at} onChange={e=>setEdit({...edit,scheduled_at:e.target.value})} className="min-h-11 w-full rounded-xl border px-3 text-sm disabled:bg-slate-50" style={{borderColor:'var(--erp-border)'}}/></label>
            {canEdit&&<button onClick={()=>run('save',()=>api.patch(`/marketing/content/${selected.id}`,{caption:edit.caption,...(selected.layout==='reel'?{brief:edit.brief}:{}),scheduled_at:edit.scheduled_at?new Date(edit.scheduled_at).toISOString():null}),'Alterações salvas.')} className="min-h-11 w-full rounded-xl border text-sm font-semibold" style={{borderColor:'var(--erp-border)'}}>Salvar alterações</button>}
            </>}
            {/* Aprovar e pedir ajuste subiram para o cabecalho do painel. Aqui
                embaixo eles ficavam depois da arte, do bloco de feedback e de
                todos os campos: aprovar exigia rolar o painel inteiro para
                executar a acao que e o motivo de a tela existir. */}
            {canPublish&&<button onClick={()=>run('publish',()=>api.post(`/marketing/content/${selected.id}/publish`),selected.layout==='reel'?'Reel enviado. A Meta processa o vídeo e o 4Core conclui a publicação.':'Publicação enviada para a Meta.')} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white" style={{background:'var(--erp-violet)'}}>{busy==='publish'?<Loader2 size={16} className="animate-spin"/>:<Send size={16}/>}Publicar agora</button>}
            {selected.status==='scheduled'&&<p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800">O 4Core enviará automaticamente no horário aprovado.</p>}
            {selected.status==='publishing'&&selected.layout==='reel'&&<p className="rounded-xl p-3 text-xs" style={{background:'var(--erp-violet-dim)',color:'var(--erp-violet)'}}>A Meta está processando o vídeo. O 4Core conclui a publicação sozinho em alguns minutos — não precisa reenviar.</p>}
            {selected.status==='published'&&<p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800"><Check size={14} className="mr-1 inline"/>Publicado em {selected.published_at?new Date(selected.published_at).toLocaleString('pt-BR'):'agora'}.</p>}
          </div>
        </div>
      </>}</section>
    </div>
  </div>;
}
