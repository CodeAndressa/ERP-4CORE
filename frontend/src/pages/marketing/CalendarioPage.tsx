import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Sparkles } from 'lucide-react';
import { Card } from '../../shared/components/ui/Card';
import { api } from '../../services/api';

interface ApiPost { id: string | number; date?: string }
interface ContentItem { id: number; title: string; channel: string; scheduled_at: string | null; status: string }

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthGrid(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const startOffset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { date: string; day: number; inMonth: boolean }[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    cells.push({ date: isoDate(d), day: d.getDate(), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: isoDate(new Date(year, month, day)), day, inMonth: true });
  }
  let trailing = 1;
  while (cells.length % 7 !== 0) {
    const d = new Date(year, month + 1, trailing);
    cells.push({ date: isoDate(d), day: d.getDate(), inMonth: false });
    trailing += 1;
  }
  return cells;
}

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export default function CalendarioPage() {
  const [publishedDates, setPublishedDates] = useState<Set<string>>(new Set());
  const [scheduledByDate, setScheduledByDate] = useState<Record<string, ContentItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api.get<ApiPost[]>('/marketing/posts').catch(() => ({ data: [] as ApiPost[] })),
      api.get<{ items: ContentItem[] }>('/marketing/content', { params: { status: 'scheduled' } }).catch(() => ({ data: { items: [] as ContentItem[] } })),
    ]).then(([postsRes, contentRes]) => {
      if (!active) return;
      const posts = Array.isArray(postsRes.data) ? postsRes.data : [];
      setPublishedDates(new Set(posts.map((p) => p.date).filter((d): d is string => Boolean(d))));

      const map: Record<string, ContentItem[]> = {};
      for (const item of contentRes.data?.items ?? []) {
        if (!item.scheduled_at) continue;
        const day = item.scheduled_at.slice(0, 10);
        (map[day] ??= []).push(item);
      }
      setScheduledByDate(map);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const cells = useMemo(() => monthGrid(viewMonth), [viewMonth]);
  const todayIso = isoDate(new Date());

  function changeMonth(delta: number) {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setSelectedDate(null);
  }

  const selectedScheduled = selectedDate ? scheduledByDate[selectedDate] ?? [] : [];
  const selectedPublished = selectedDate ? publishedDates.has(selectedDate) : false;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays size={16} style={{ color: 'var(--erp-violet-light)' }} />
        <h1 className="text-base font-bold" style={{ color: 'var(--erp-text)' }}>Calendário</h1>
        {loading && <RefreshCw size={12} className="animate-spin" style={{ color: 'var(--erp-text-muted)' }} />}
      </div>

      <Card padding="sm">
        <div className="flex items-center justify-between px-1 pb-2 pt-1">
          <p className="text-sm font-semibold capitalize" style={{ color: 'var(--erp-text)' }}>
            {viewMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </p>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => changeMonth(-1)} aria-label="Mês anterior" className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--erp-surface-2)]" style={{ color: 'var(--erp-text-muted)' }}>
              <ChevronLeft size={14} />
            </button>
            <button type="button" onClick={() => { setViewMonth(() => { const d = new Date(); d.setDate(1); return d; }); setSelectedDate(null); }} className="rounded-lg px-2 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--erp-surface-2)]" style={{ color: 'var(--erp-text-muted)' }}>
              Hoje
            </button>
            <button type="button" onClick={() => changeMonth(1)} aria-label="Próximo mês" className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--erp-surface-2)]" style={{ color: 'var(--erp-text-muted)' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-0.5 px-1 text-center">
          {WEEKDAY_LABELS.map((label, i) => (
            <span key={`${label}-${i}`} className="py-0.5 text-[9px] font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-dim)' }}>{label}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5 px-1 pb-1">
          {cells.map((cell) => {
            const published = publishedDates.has(cell.date);
            const scheduled = (scheduledByDate[cell.date] ?? []).length > 0;
            const isToday = cell.date === todayIso;
            const isSelected = cell.date === selectedDate;
            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => cell.inMonth && setSelectedDate((prev) => (prev === cell.date ? null : cell.date))}
                disabled={!cell.inMonth}
                aria-label={`${cell.day}${published ? ', publicado' : ''}${scheduled ? ', agendado' : ''}`}
                className="flex h-9 flex-col items-center justify-center gap-0.5 rounded-lg text-xs transition-colors disabled:cursor-default sm:h-10"
                style={{
                  background: isSelected ? 'var(--erp-violet)' : isToday ? 'var(--erp-violet-soft)' : 'transparent',
                  color: !cell.inMonth ? 'var(--erp-text-dim)' : isSelected ? '#fff' : 'var(--erp-text)',
                  opacity: cell.inMonth ? 1 : 0.4,
                  fontWeight: isToday || isSelected ? 700 : 500,
                }}
              >
                <span>{cell.day}</span>
                {(published || scheduled) && (
                  <span className="flex items-center gap-0.5">
                    {published && <span className="h-1 w-1 rounded-full" style={{ background: isSelected ? '#fff' : 'var(--erp-emerald)' }} />}
                    {scheduled && <span className="h-1 w-1 rounded-full" style={{ background: isSelected ? '#fff' : 'var(--erp-violet)' }} />}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 px-1 pb-1 pt-2 text-[10px]" style={{ color: 'var(--erp-text-muted)' }}>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--erp-emerald)' }} /> Publicado</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--erp-violet)' }} /> Agendado via Meta</span>
        </div>
      </Card>

      {selectedDate && (
        <Card padding="sm">
          <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--erp-text)' }}>
            {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
          </p>
          {!selectedPublished && selectedScheduled.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>Nada publicado ou agendado neste dia.</p>
          ) : (
            <div className="space-y-1.5">
              {selectedPublished && (
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--erp-text)' }}>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--erp-emerald)' }} />
                  Post publicado no Instagram
                </div>
              )}
              {selectedScheduled.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2" style={{ color: 'var(--erp-text)' }}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--erp-violet)' }} />
                    <span className="truncate">{item.title}</span>
                  </span>
                  <span className="shrink-0 text-[9px] uppercase tracking-wide" style={{ color: 'var(--erp-text-dim)' }}>{item.channel}</span>
                </div>
              ))}
            </div>
          )}
          {selectedScheduled.length > 0 && (
            <Link to="/marketing/estudio" className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--erp-violet-light)' }}>
              <Sparkles size={11} /> Editar no Estúdio
            </Link>
          )}
        </Card>
      )}
    </div>
  );
}
