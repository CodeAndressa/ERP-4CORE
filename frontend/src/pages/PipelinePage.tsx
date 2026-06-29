import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Flame, Minus, Snowflake, TrendingUp, Users, Trophy } from 'lucide-react';

type Heat = 'hot' | 'warm' | 'cold';
type Stage = 'novo' | 'qualificado' | 'proposta' | 'negociacao' | 'fechado';

interface Deal {
  id: string;
  name: string;
  value: number;
  contact: string;
  stage: Stage;
  heat: Heat;
  daysInStage: number;
}

const STAGES: { id: Stage; label: string; color: string; bgDot: string }[] = [
  { id: 'novo',        label: 'Novo',       color: '#06b6d4', bgDot: 'bg-cyan-400' },
  { id: 'qualificado', label: 'Qualificado', color: '#2b165c', bgDot: 'bg-violet-400' },
  { id: 'proposta',    label: 'Proposta',    color: '#f59e0b', bgDot: 'bg-amber-400' },
  { id: 'negociacao',  label: 'Negociação',  color: '#f97316', bgDot: 'bg-orange-400' },
  { id: 'fechado',     label: 'Fechado',     color: '#10b981', bgDot: 'bg-emerald-400' },
];

const INITIAL_DEALS: Deal[] = [
  { id: 'd1',  name: 'Tecnova Sistemas',    value: 48000,  contact: 'Carlos Mendes',   stage: 'novo',        heat: 'hot',  daysInStage: 2  },
  { id: 'd2',  name: 'Grupo Alphatech',     value: 120000, contact: 'Fernanda Lima',   stage: 'novo',        heat: 'warm', daysInStage: 5  },
  { id: 'd3',  name: 'Solaris Energia',     value: 75000,  contact: 'Rafael Souza',    stage: 'novo',        heat: 'cold', daysInStage: 10 },
  { id: 'd4',  name: 'Nexus Digital',       value: 33000,  contact: 'Ana Carvalho',    stage: 'novo',        heat: 'warm', daysInStage: 3  },
  { id: 'd5',  name: 'Braun & Associados',  value: 90000,  contact: 'Marcos Braun',    stage: 'novo',        heat: 'hot',  daysInStage: 1  },

  { id: 'd6',  name: 'DataSync Br',         value: 62000,  contact: 'Luciana Torres',  stage: 'qualificado', heat: 'hot',  daysInStage: 4  },
  { id: 'd7',  name: 'Prime Soluções',      value: 210000, contact: 'João Figueiredo', stage: 'qualificado', heat: 'hot',  daysInStage: 7  },
  { id: 'd8',  name: 'Omega Indústria',     value: 45000,  contact: 'Cláudia Nunes',   stage: 'qualificado', heat: 'warm', daysInStage: 12 },
  { id: 'd9',  name: 'Startup Visão',       value: 18000,  contact: 'Pedro Alves',     stage: 'qualificado', heat: 'cold', daysInStage: 8  },
  { id: 'd10', name: 'Fortex Construções',  value: 340000, contact: 'Sandra Fortex',   stage: 'qualificado', heat: 'warm', daysInStage: 6  },

  { id: 'd11', name: 'VoxTech Analytics',   value: 55000,  contact: 'Diego Ramos',     stage: 'proposta',    heat: 'hot',  daysInStage: 3  },
  { id: 'd12', name: 'Maplink Logística',   value: 89000,  contact: 'Isabela Costa',   stage: 'proposta',    heat: 'warm', daysInStage: 9  },
  { id: 'd13', name: 'CloudNine Serviços',  value: 175000, contact: 'Thiago Avelar',   stage: 'proposta',    heat: 'hot',  daysInStage: 5  },
  { id: 'd14', name: 'Veritas Consultoria', value: 42000,  contact: 'Renata Veritas',  stage: 'proposta',    heat: 'cold', daysInStage: 14 },
  { id: 'd15', name: 'Helix Software',      value: 67000,  contact: 'Bruno Helix',     stage: 'proposta',    heat: 'warm', daysInStage: 2  },

  { id: 'd16', name: 'Synapse IA',          value: 290000, contact: 'Camila Synapse',  stage: 'negociacao',  heat: 'hot',  daysInStage: 6  },
  { id: 'd17', name: 'Macro Sistemas',      value: 130000, contact: 'Augusto Macro',   stage: 'negociacao',  heat: 'warm', daysInStage: 11 },
  { id: 'd18', name: 'InfraCloud Br',       value: 78000,  contact: 'Viviane Infra',   stage: 'negociacao',  heat: 'hot',  daysInStage: 4  },
  { id: 'd19', name: 'Petros Mineração',    value: 510000, contact: 'Eduardo Petros',  stage: 'negociacao',  heat: 'warm', daysInStage: 18 },
  { id: 'd20', name: 'Quantum Apps',        value: 44000,  contact: 'Letícia Quantum', stage: 'negociacao',  heat: 'cold', daysInStage: 7  },

  { id: 'd21', name: 'Riverbend Tech',      value: 195000, contact: 'Felipe River',    stage: 'fechado',     heat: 'hot',  daysInStage: 0  },
  { id: 'd22', name: 'Grupo Novalink',      value: 88000,  contact: 'Patricia Nova',   stage: 'fechado',     heat: 'warm', daysInStage: 0  },
  { id: 'd23', name: 'Aether Sistemas',     value: 320000, contact: 'Rodrigo Aether',  stage: 'fechado',     heat: 'hot',  daysInStage: 0  },
  { id: 'd24', name: 'BlueSpark Digital',   value: 56000,  contact: 'Natália Spark',   stage: 'fechado',     heat: 'warm', daysInStage: 0  },
  { id: 'd25', name: 'Exactus Finance',     value: 143000, contact: 'Henrique Exact',  stage: 'fechado',     heat: 'hot',  daysInStage: 1  },
];

function fmt(value: number) {
  return 'R$ ' + value.toLocaleString('pt-BR');
}

function HeatIcon({ heat }: { heat: Heat }) {
  if (heat === 'hot')  return <Flame   size={13} className="text-amber-400"  />;
  if (heat === 'cold') return <Snowflake size={13} className="text-cyan-400" />;
  return <Minus size={13} className="text-slate-400" />;
}

function DealCard({ deal, isDragging = false }: { deal: Deal; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: deal.id });

  const style: React.CSSProperties = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px) scale(${isDragging ? 1 : 1})` : undefined,
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    background: 'var(--erp-surface)',
    border: '1px solid var(--erp-border)',
    transition: 'border-color 0.15s',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl p-3 select-none deal-card"
      {...listeners}
      {...attributes}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-tight" style={{ color: 'var(--erp-text)' }}>
          {deal.name}
        </span>
        <HeatIcon heat={deal.heat} />
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{deal.contact}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold" style={{ color: 'var(--erp-violet-light)' }}>
          {fmt(deal.value)}
        </span>
        {deal.daysInStage > 0 && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: 'var(--erp-violet-dim)', color: 'var(--erp-text-muted)' }}
          >
            {deal.daysInStage}d
          </span>
        )}
      </div>
    </div>
  );
}

function DealCardOverlay({ deal }: { deal: Deal }) {
  return (
    <div
      className="rounded-xl p-3 select-none rotate-2"
      style={{
        background: 'var(--erp-surface)',
        border: '1px solid var(--erp-border-strong)',
        width: 220,
        cursor: 'grabbing',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-tight" style={{ color: 'var(--erp-text)' }}>
          {deal.name}
        </span>
        <HeatIcon heat={deal.heat} />
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{deal.contact}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold" style={{ color: 'var(--erp-violet-light)' }}>
          {fmt(deal.value)}
        </span>
        {deal.daysInStage > 0 && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: 'var(--erp-violet-dim)', color: 'var(--erp-text-muted)' }}
          >
            {deal.daysInStage}d
          </span>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({
  stage,
  deals,
  activeId,
}: {
  stage: (typeof STAGES)[number];
  deals: Deal[];
  activeId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = deals.reduce((s, d) => s + d.value, 0);

  return (
    <div
      className="flex w-64 flex-none flex-col rounded-2xl"
      style={{
        background: 'var(--erp-surface)',
        border: `1px solid ${isOver ? stage.color + '44' : 'var(--erp-border)'}`,
        transition: 'border-color 0.15s',
        minWidth: 240,
      }}
    >
      <div className="flex items-center gap-2 p-3 pb-2">
        <span className="h-2.5 w-2.5 rounded-full flex-none" style={{ background: stage.color }} />
        <span className="text-sm font-semibold flex-1" style={{ color: 'var(--erp-text)' }}>
          {stage.label}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: stage.color + '22', color: stage.color }}
        >
          {deals.length}
        </span>
      </div>
      <div className="px-3 pb-2">
        <span className="text-[11px] font-medium" style={{ color: 'var(--erp-text-muted)' }}>
          {fmt(total)}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto p-3 pt-1"
        style={{ minHeight: 120, maxHeight: 'calc(100vh - 280px)' }}
      >
        {deals.length === 0 ? (
          <div
            className="flex flex-1 items-center justify-center rounded-xl py-8 text-xs"
            style={{
              border: '1.5px dashed var(--erp-border-strong)',
              color: 'var(--erp-text-dim)',
            }}
          >
            Solte aqui
          </div>
        ) : (
          deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} isDragging={deal.id === activeId} />
          ))
        )}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const [deals, setDeals] = useState<Deal[]>(INITIAL_DEALS);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) ?? null : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragOver(_event: DragOverEvent) {}

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const targetStage = over.id as Stage;
    if (!STAGES.find((s) => s.id === targetStage)) return;
    setDeals((prev) =>
      prev.map((d) => (d.id === active.id ? { ...d, stage: targetStage } : d))
    );
  }

  const openDeals = deals.filter((d) => d.stage !== 'fechado');
  const totalPipeline = openDeals.reduce((s, d) => s + d.value, 0);
  const topDeal = [...deals].sort((a, b) => b.value - a.value)[0];

  return (
    <div className="flex flex-col gap-6 h-full">
      <style>{`
        .deal-card:hover {
          border-color: var(--erp-border-strong) !important;

        }
      `}</style>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>
            Comercial
          </p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>
            Pipeline de Vendas
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl flex-none"
            style={{ background: 'var(--erp-violet-dim)' }}
          >
            <TrendingUp size={18} style={{ color: 'var(--erp-violet-light)' }} />
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>Total em pipeline</p>
            <p className="text-base font-bold" style={{ color: 'var(--erp-text)' }}>{fmt(totalPipeline)}</p>
          </div>
        </div>

        <div
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl flex-none"
            style={{ background: 'rgba(6,182,212,0.12)' }}
          >
            <Users size={18} className="text-cyan-400" />
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>Oportunidades abertas</p>
            <p className="text-base font-bold" style={{ color: 'var(--erp-text)' }}>{openDeals.length}</p>
          </div>
        </div>

        <div
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl flex-none"
            style={{ background: 'rgba(16,185,129,0.12)' }}
          >
            <Trophy size={18} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>Maior valor</p>
            <p className="text-base font-bold" style={{ color: 'var(--erp-text)' }}>
              {topDeal ? fmt(topDeal.value) : '—'}
            </p>
            {topDeal && (
              <p className="text-[11px]" style={{ color: 'var(--erp-text-muted)' }}>{topDeal.name}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full" style={{ minWidth: 'max-content' }}>
            {STAGES.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                deals={deals.filter((d) => d.stage === stage.id)}
                activeId={activeId}
              />
            ))}
          </div>

          <DragOverlay>
            {activeDeal ? <DealCardOverlay deal={activeDeal} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
