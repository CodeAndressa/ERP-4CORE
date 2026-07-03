import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Flame, Minus, Snowflake, TrendingUp, Users, Trophy } from 'lucide-react';
import { api } from '../services/api';

type Heat = 'hot' | 'warm' | 'cold';
type Stage = 'novo' | 'contato' | 'qualificado' | 'proposta' | 'negociacao' | 'fechado' | 'perdido';

interface Deal {
  id: string;
  name: string;
  value: number;
  contact: string;
  stage: Stage;
  heat: Heat;
  daysInStage: number;
}

const STAGES: { id: Stage; label: string; color: string; bg: string; border: string }[] = [
  { id: 'novo', label: 'Novo lead', color: 'var(--erp-text-muted)', bg: 'rgba(43,22,92,0.13)', border: 'rgba(43,22,92,0.4)' },
  { id: 'contato', label: 'Em contato', color: 'var(--erp-violet)', bg: 'rgba(43,22,92,0.13)', border: 'rgba(43,22,92,0.4)' },
  { id: 'qualificado', label: 'Qualificado', color: 'var(--erp-emerald)', bg: 'rgba(4,120,87,0.13)', border: 'rgba(4,120,87,0.4)' },
  { id: 'proposta', label: 'Proposta', color: 'var(--erp-amber)', bg: 'rgba(180,83,9,0.13)', border: 'rgba(180,83,9,0.4)' },
  { id: 'negociacao', label: 'Em negociação', color: 'var(--erp-cyan)', bg: 'rgba(8,145,178,0.13)', border: 'rgba(8,145,178,0.4)' },
  { id: 'fechado', label: 'Fechado', color: 'var(--erp-emerald)', bg: 'rgba(4,120,87,0.13)', border: 'rgba(4,120,87,0.4)' },
];

function fmt(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function daysSince(iso?: string) {
  if (!iso) return 0;
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / 86400000));
}

function heatFromLead(value: number, nextContact?: string | null): Heat {
  if (value >= 50000) return 'hot';
  if (nextContact) {
    const days = Math.ceil((new Date(nextContact + 'T12:00:00').getTime() - Date.now()) / 86400000);
    if (days <= 2) return 'hot';
  }
  if (value > 0) return 'warm';
  return 'cold';
}

function normalizeStage(value?: string): Stage {
  if (value === 'contato' || value === 'qualificado' || value === 'proposta' || value === 'negociacao' || value === 'fechado' || value === 'perdido') return value;
  return 'novo';
}

function stageToStatus(stage: Stage) {
  if (stage === 'perdido') return 'perdido';
  if (stage === 'qualificado' || stage === 'proposta' || stage === 'negociacao' || stage === 'fechado') return 'qualificado';
  if (stage === 'contato') return 'contato';
  return 'novo';
}

function normalizeDeal(item: Record<string, unknown>): Deal {
  const value = Number(item.value_potential ?? 0);
  return {
    id: String(item.id),
    name: String(item.company || item.name || 'Lead sem nome'),
    value,
    contact: String(item.name || item.email || item.phone || 'Contato não informado'),
    stage: normalizeStage((item.stage as string) || (item.status as string)),
    heat: heatFromLead(value, (item.next_contact_date as string) ?? null),
    daysInStage: daysSince((item.updated_at as string) || (item.created_at as string)),
  };
}

function HeatIcon({ heat }: { heat: Heat }) {
  if (heat === 'hot') return <Flame size={13} style={{ color: 'var(--erp-amber)' }} />;
  if (heat === 'cold') return <Snowflake size={13} style={{ color: 'var(--erp-cyan)' }} />;
  return <Minus size={13} style={{ color: 'var(--erp-text-dim)' }} />;
}

function DealCard({ deal, isDragging = false }: { deal: Deal; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: deal.id });
  const style: CSSProperties = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    background: 'var(--erp-surface)',
    border: '1px solid var(--erp-border)',
    transition: 'border-color 0.15s',
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl p-3 select-none deal-card" {...listeners} {...attributes}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-tight" style={{ color: 'var(--erp-text)' }}>{deal.name}</span>
        <HeatIcon heat={deal.heat} />
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{deal.contact}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold" style={{ color: 'var(--erp-violet-light)' }}>{fmt(deal.value)}</span>
        {deal.daysInStage > 0 && <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'var(--erp-violet-dim)', color: 'var(--erp-text-muted)' }}>{deal.daysInStage}d</span>}
      </div>
    </div>
  );
}

function DealCardOverlay({ deal }: { deal: Deal }) {
  return <div className="w-[220px] rotate-2"><DealCard deal={deal} /></div>;
}

function KanbanColumn({ stage, deals, activeId }: { stage: (typeof STAGES)[number]; deals: Deal[]; activeId: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = deals.reduce((s, d) => s + d.value, 0);

  return (
    <div className="mobile-snap-item flex w-[86vw] flex-none flex-col rounded-2xl sm:w-64" style={{ background: 'var(--erp-surface)', border: `1px solid ${isOver ? stage.border : 'var(--erp-border)'}`, minWidth: 240 }}>
      <div className="flex items-center gap-2 p-3 pb-2">
        <span className="h-2.5 w-2.5 rounded-full flex-none" style={{ background: stage.color }} />
        <span className="text-sm font-semibold flex-1" style={{ color: 'var(--erp-text)' }}>{stage.label}</span>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: stage.bg, color: stage.color }}>{deals.length}</span>
      </div>
      <div className="px-3 pb-2"><span className="text-[11px] font-medium" style={{ color: 'var(--erp-text-muted)' }}>{fmt(total)}</span></div>
      <div ref={setNodeRef} className="flex flex-1 flex-col gap-2 overflow-y-auto p-3 pt-1" style={{ minHeight: 120, maxHeight: 'calc(100vh - 280px)' }}>
        {deals.length === 0 ? <div className="flex flex-1 items-center justify-center rounded-xl py-8 text-xs" style={{ border: '1.5px dashed var(--erp-border-strong)', color: 'var(--erp-text-dim)' }}>Solte aqui</div> : deals.map((deal) => <DealCard key={deal.id} deal={deal} isDragging={deal.id === activeId} />)}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const activeDeal = activeId ? deals.find((d) => d.id === activeId) ?? null : null;

  useEffect(() => {
    api.get('/leads')
      .then(({ data }) => setDeals((Array.isArray(data) ? data : []).map(normalizeDeal).filter((deal) => deal.stage !== 'perdido')))
      .catch(() => setDeals([]))
      .finally(() => setLoading(false));
  }, []);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const targetStage = over.id as Stage;
    if (!STAGES.find((s) => s.id === targetStage)) return;
    const previous = deals;
    setDeals((prev) => prev.map((d) => (d.id === active.id ? { ...d, stage: targetStage } : d)));
    try {
      await api.patch(`/leads/${active.id}`, { stage: targetStage, status: stageToStatus(targetStage) });
    } catch {
      setDeals(previous);
    }
  }

  const openDeals = deals.filter((d) => d.stage !== 'fechado');
  const totalPipeline = openDeals.reduce((s, d) => s + d.value, 0);
  const topDeal = [...deals].sort((a, b) => b.value - a.value)[0];

  return (
    <div className="flex flex-col gap-6 h-full">
      <style>{`.deal-card:hover { border-color: var(--erp-border-strong) !important; }`}</style>
      <div className="flex items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Comercial</p><h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Pipeline de Vendas</h1><p className="mt-1 text-xs sm:hidden" style={{ color: 'var(--erp-text-muted)' }}>Deslize para ver etapas e arraste cards para atualizar o pipeline.</p></div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}><div className="flex h-9 w-9 items-center justify-center rounded-xl flex-none" style={{ background: 'var(--erp-violet-dim)' }}><TrendingUp size={18} style={{ color: 'var(--erp-violet-light)' }} /></div><div><p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>Total em pipeline</p><p className="text-base font-bold" style={{ color: 'var(--erp-text)' }}>{fmt(totalPipeline)}</p></div></div>
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}><div className="flex h-9 w-9 items-center justify-center rounded-xl flex-none" style={{ background: 'rgba(8,145,178,0.12)' }}><Users size={18} style={{ color: 'var(--erp-cyan)' }} /></div><div><p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>Oportunidades abertas</p><p className="text-base font-bold" style={{ color: 'var(--erp-text)' }}>{openDeals.length}</p></div></div>
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}><div className="flex h-9 w-9 items-center justify-center rounded-xl flex-none" style={{ background: 'rgba(4,120,87,0.12)' }}><Trophy size={18} style={{ color: 'var(--erp-emerald)' }} /></div><div><p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>Maior valor</p><p className="text-base font-bold" style={{ color: 'var(--erp-text)' }}>{topDeal ? fmt(topDeal.value) : '-'}</p>{topDeal && <p className="text-[11px]" style={{ color: 'var(--erp-text-muted)' }}>{topDeal.name}</p>}</div></div>
      </div>
      {loading ? <div className="py-12 text-sm" style={{ color: 'var(--erp-text-muted)' }}>Carregando pipeline...</div> : deals.length === 0 ? <div className="rounded-2xl py-16 text-center text-sm" style={{ border: '1px dashed var(--erp-border)', color: 'var(--erp-text-muted)' }}>Nenhum lead cadastrado para exibir no pipeline.</div> : <div className="mobile-snap-scroll -mx-3 flex-1 overflow-x-auto px-3 pb-4"><DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}><div className="flex h-full gap-3 sm:gap-4" style={{ minWidth: 'max-content' }}>{STAGES.map((stage) => <KanbanColumn key={stage.id} stage={stage} deals={deals.filter((d) => d.stage === stage.id)} activeId={activeId} />)}</div><DragOverlay>{activeDeal ? <DealCardOverlay deal={activeDeal} /> : null}</DragOverlay></DndContext></div>}
    </div>
  );
}

