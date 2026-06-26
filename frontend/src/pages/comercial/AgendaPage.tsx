import { useState } from 'react';
import { Phone, Users, Mail, Video, Plus } from 'lucide-react';
import { MetricCard } from '../../shared/components/layout/MetricCard';

type EventType = 'reuniao' | 'ligacao' | 'email' | 'videocall';

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

const EVENTS: AgendaEvent[] = [
  { id: 1, date: '2026-06-26', time: '09:00', title: 'Apresentação de proposta', contact: 'Pedro Oliveira', company: 'Indústria Teksa', type: 'reuniao', confirmed: true },
  { id: 2, date: '2026-06-26', time: '11:00', title: 'Follow-up contrato', contact: 'Carlos Ferreira', company: 'Tech Soluções', type: 'ligacao', confirmed: true },
  { id: 3, date: '2026-06-26', time: '14:30', title: 'Diagnóstico inicial', contact: 'Ana Costa', company: 'Distribuidora Nova', type: 'videocall', confirmed: false },
  { id: 4, date: '2026-06-27', time: '10:00', title: 'Renovação de contrato', contact: 'João Silva', company: 'Construtora Atlas', type: 'reuniao', confirmed: true },
  { id: 5, date: '2026-06-27', time: '15:00', title: 'Apresentação de resultados', contact: 'Maria Santos', company: 'RH Consulting', type: 'videocall', confirmed: true },
  { id: 6, date: '2026-06-28', time: '09:30', title: 'Prospecção ativa', contact: 'Lucia Mendes', company: 'Grupo Farma', type: 'ligacao', confirmed: false },
  { id: 7, date: '2026-06-29', time: '14:00', title: 'Fechamento de proposta', contact: 'Roberto Lima', company: 'Agro Primavera', type: 'reuniao', confirmed: true },
  { id: 8, date: '2026-06-30', time: '10:30', title: 'Check-in mensal', contact: 'João Silva', company: 'Construtora Atlas', type: 'email', confirmed: true },
  { id: 9, date: '2026-07-01', time: '09:00', title: 'Kickoff cliente novo', contact: 'Fernanda Dias', company: 'Clínica Saúde', type: 'videocall', confirmed: true },
  { id: 10, date: '2026-07-01', time: '16:00', title: 'Apresentação comercial', contact: 'Carlos Ferreira', company: 'Tech Soluções', type: 'reuniao', confirmed: false },
];

const WEEK_DAYS = ['2026-06-26', '2026-06-27', '2026-06-28', '2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02'];

const TYPE_CONFIG: Record<EventType, { icon: React.ReactNode; bg: string; color: string }> = {
  reuniao: { icon: <Users size={12} />, bg: 'rgba(43,22,92,0.12)', color: '#2b165c' },
  ligacao: { icon: <Phone size={12} />, bg: 'rgba(52,211,153,0.12)', color: '#34d399' },
  email: { icon: <Mail size={12} />, bg: 'rgba(103,232,249,0.12)', color: '#67e8f9' },
  videocall: { icon: <Video size={12} />, bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' },
};

function fmtDay(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

export default function AgendaPage() {
  const [selectedDay, setSelectedDay] = useState('2026-06-26');

  const todayEvents = EVENTS.filter((e) => e.date === selectedDay).sort((a, b) => a.time.localeCompare(b.time));

  const confirmedToday = todayEvents.filter((e) => e.confirmed).length;
  const weekTotal = EVENTS.length;
  const weekConfirmed = EVENTS.filter((e) => e.confirmed).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>
            Comercial
          </p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>
            Agenda Comercial
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>
            Semana de 26 jun a 2 jul 2026
          </p>
        </div>

        <button
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--erp-violet)', color: '#fff' }}
        >
          <Plus size={14} />
          Novo evento
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Hoje" value={String(todayEvents.length)} detail={`${confirmedToday} confirmados`} tone="violet" icon={<Users size={16} />} />
        <MetricCard label="Semana total" value={String(weekTotal)} detail={`${weekConfirmed} confirmados`} tone="emerald" icon={<Phone size={16} />} />
        <MetricCard label="Taxa confirm." value={`${Math.round((weekConfirmed / weekTotal) * 100)}%`} detail="da semana" tone="amber" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {WEEK_DAYS.map((day) => {
          const dayEvents = EVENTS.filter((e) => e.date === day);
          const active = selectedDay === day;
          const isToday = day === '2026-06-26';

          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className="flex-shrink-0 flex flex-col items-center gap-1 rounded-2xl px-4 py-3 transition-all"
              style={{
                background: active ? 'var(--erp-violet)' : 'var(--erp-surface)',
                border: isToday && !active ? '1px solid var(--erp-violet)66' : '1px solid var(--erp-border)',
                minWidth: 90,
              }}
            >
              <span
                className="text-[10px] uppercase font-medium"
                style={{ color: active ? 'rgba(255,255,255,0.7)' : 'var(--erp-text-dim)' }}
              >
                {new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' })}
              </span>

              <span className="text-xl font-bold tabular-nums" style={{ color: active ? '#fff' : 'var(--erp-text)' }}>
                {new Date(day + 'T12:00:00').getDate()}
              </span>

              {dayEvents.length > 0 && (
                <span
                  className="text-[10px] font-medium"
                  style={{ color: active ? 'rgba(255,255,255,0.8)' : 'var(--erp-violet-light)' }}
                >
                  {dayEvents.length} evento{dayEvents.length !== 1 ? 's' : ''}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div>
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--erp-text)' }}>
          {fmtDay(selectedDay)}
          {selectedDay === '2026-06-26' && (
            <span
              className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: 'var(--erp-violet-dim)', color: 'var(--erp-violet-light)' }}
            >
              Hoje
            </span>
          )}
        </p>

        {todayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl py-14" style={{ border: '1px dashed var(--erp-border)' }}>
            <Users size={28} style={{ color: 'var(--erp-text-dim)' }} />
            <p className="text-sm" style={{ color: 'var(--erp-text-muted)' }}>
              Nenhum evento neste dia
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayEvents.map((event) => {
              const tc = TYPE_CONFIG[event.type];

              return (
                <div
                  key={event.id}
                  className="flex items-center gap-4 rounded-2xl px-4 py-3"
                  style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}
                >
                  <div className="flex-shrink-0 w-12 text-center">
                    <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--erp-text)' }}>
                      {event.time}
                    </span>
                  </div>

                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: tc.bg, color: tc.color }}>
                    {tc.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--erp-text)' }}>
                      {event.title}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                      {event.contact} · {event.company}
                    </p>
                  </div>

                  <div className="flex-shrink-0">
                    {event.confirmed ? (
                      <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#34d399' }}>
                        <div className="h-1.5 w-1.5 rounded-full bg-current" />
                        Confirmado
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs" style={{ color: '#fbbf24' }}>
                        <div className="h-1.5 w-1.5 rounded-full bg-current" />
                        Pendente
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}