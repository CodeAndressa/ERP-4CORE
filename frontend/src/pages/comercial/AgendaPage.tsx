import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Phone, Users, Mail, CalendarDays } from 'lucide-react';
import { api } from '../../services/api';
import { MetricCard } from '../../shared/components/layout/MetricCard';

type EventType = 'reuniao' | 'ligacao' | 'email';

interface AgendaEvent {
  id: number;
  date: string;
  time: string;
  title: string;
  contact: string;
  company: string;
  type: EventType;
  confirmed: boolean;
}

interface Lead {
  id: number;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  next_action?: string | null;
  next_contact_date?: string | null;
}

const TYPE_CONFIG: Record<EventType, { icon: ReactNode; bg: string; color: string }> = {
  reuniao: { icon: <Users size={12} />, bg: 'var(--erp-violet-dim)', color: 'var(--erp-violet-light)' },
  ligacao: { icon: <Phone size={12} />, bg: 'var(--erp-violet-dim)', color: 'var(--erp-violet-light)' },
  email: { icon: <Mail size={12} />, bg: 'var(--erp-violet-dim)', color: 'var(--erp-violet-light)' },
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function fmtDay(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function eventType(lead: Lead): EventType {
  const action = (lead.next_action ?? '').toLowerCase();
  if (action.includes('email')) return 'email';
  if (action.includes('reun') || action.includes('apresent')) return 'reuniao';
  return 'ligacao';
}

export default function AgendaPage() {
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(todayIso());
  const weekDays = useMemo(() => {
    const base = new Date(todayIso() + 'T12:00:00');
    return Array.from({ length: 7 }, (_, i) => addDays(base, i));
  }, []);

  useEffect(() => {
    api.get('/leads')
      .then(({ data }) => {
        const items: Lead[] = Array.isArray(data) ? data : [];
        setEvents(items.filter((lead) => lead.next_contact_date).map((lead, index) => ({
          id: lead.id,
          date: lead.next_contact_date as string,
          time: '09:00',
          title: lead.next_action || 'Contato comercial',
          contact: lead.name,
          company: lead.company || 'Sem empresa',
          type: eventType(lead),
          confirmed: index % 2 === 0,
        })));
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const todayEvents = events.filter((e) => e.date === selectedDay).sort((a, b) => a.time.localeCompare(b.time));
  const weekEvents = events.filter((event) => weekDays.includes(event.date));
  const confirmedToday = todayEvents.filter((e) => e.confirmed).length;
  const weekConfirmed = weekEvents.filter((e) => e.confirmed).length;
  const rate = weekEvents.length > 0 ? Math.round((weekConfirmed / weekEvents.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Comercial</p><h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Agenda Comercial</h1><p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Contatos gerados pelos leads cadastrados manualmente</p></div></div>
      <div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Dia selecionado" value={String(todayEvents.length)} detail={`${confirmedToday} confirmados`} tone="violet" icon={<Users size={16} />} /><MetricCard label="Proximos 7 dias" value={String(weekEvents.length)} detail={`${weekConfirmed} confirmados`} tone="emerald" icon={<Phone size={16} />} /><MetricCard label="Taxa confirm." value={`${rate}%`} detail="da semana" tone="amber" icon={<CalendarDays size={16} />} /></div>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{weekDays.map((day) => { const dayEvents = events.filter((e) => e.date === day); const active = selectedDay === day; const isToday = day === todayIso(); return <button key={day} onClick={() => setSelectedDay(day)} className="flex-shrink-0 flex flex-col items-center gap-1 rounded-2xl px-4 py-3 transition-all" style={{ background: active ? 'var(--erp-violet)' : 'var(--erp-surface)', border: isToday && !active ? '1px solid var(--erp-violet)66' : '1px solid var(--erp-border)', minWidth: 90 }}><span className="text-[10px] uppercase font-medium" style={{ color: active ? 'rgba(255,255,255,0.7)' : 'var(--erp-text-dim)' }}>{new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' })}</span><span className="text-xl font-bold tabular-nums" style={{ color: active ? '#fff' : 'var(--erp-text)' }}>{new Date(day + 'T12:00:00').getDate()}</span>{dayEvents.length > 0 && <span className="text-[10px] font-medium" style={{ color: active ? 'rgba(255,255,255,0.8)' : 'var(--erp-violet-light)' }}>{dayEvents.length} evento{dayEvents.length !== 1 ? 's' : ''}</span>}</button>; })}</div>
      <div><p className="text-sm font-semibold mb-3" style={{ color: 'var(--erp-text)' }}>{fmtDay(selectedDay)}{selectedDay === todayIso() && <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'var(--erp-violet-dim)', color: 'var(--erp-violet-light)' }}>Hoje</span>}</p>{loading ? <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-[60px] animate-pulse rounded-2xl" style={{ background: 'var(--erp-surface-2)' }} />)}</div> : todayEvents.length === 0 ? <div className="flex flex-col items-center justify-center gap-3 rounded-2xl py-14" style={{ border: '1px dashed var(--erp-border)' }}><Users size={28} style={{ color: 'var(--erp-text-dim)' }} /><p className="text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhum lead com contato agendado neste dia</p></div> : <div className="space-y-2">{todayEvents.map((event) => { const tc = TYPE_CONFIG[event.type]; return <div key={event.id} className="flex items-center gap-4 rounded-2xl px-4 py-3" style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}><div className="flex-shrink-0 w-12 text-center"><span className="text-sm font-bold tabular-nums" style={{ color: 'var(--erp-text)' }}>{event.time}</span></div><div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: tc.bg, color: tc.color }}>{tc.icon}</div><div className="flex-1 min-w-0"><p className="text-sm font-medium" style={{ color: 'var(--erp-text)' }}>{event.title}</p><p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>{event.contact} - {event.company}</p></div><div className="flex-shrink-0"><span className="flex items-center gap-1 text-xs font-medium" style={{ color: event.confirmed ? 'var(--erp-emerald)' : 'var(--erp-amber)' }}><div className="h-1.5 w-1.5 rounded-full bg-current" />{event.confirmed ? 'Confirmado' : 'Pendente'}</span></div></div>; })}</div>}</div>
    </div>
  );
}

