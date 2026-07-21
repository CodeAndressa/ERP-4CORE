import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw, Sparkles, X } from 'lucide-react';
import { Card } from '../../shared/components/ui/Card';
import { api } from '../../services/api';

interface ApiPost { id: string | number; date?: string }
interface ContentItem { id: number; title: string; channel: string; scheduled_at: string | null; published_at?: string | null; status: string }
interface ExternalItem { id: number; title: string; channel: string; scheduled_at: string; notes: string }
interface ScheduledEntry { id: number; title: string; channel: string; source: 'erp' | 'external' }

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
  const [scheduledByDate, setScheduledByDate] = useState<Record<string, ScheduledEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', time: '12:00', channel: 'instagram' });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    return Promise.all([
      api.get<ApiPost[]>('/marketing/posts').catch(() => ({ data: [] as ApiPost[] })),
      api.get<{ items: ContentItem[] }>('/marketing/content', { params: { status: 'scheduled' } }).catch(() => ({ data: { items: [] as ContentItem[] } })),
      api.get<{ items: ExternalItem[] }>('/marketing/scheduled-external').catch(() => ({ data: { items: [] as ExternalItem[] } })),
      api.get<{ items: ContentItem[] }>('/marketing/content', { params: { status: 'published' } }).catch(() => ({ data: { items: [] as ContentItem[] } })),
    ]).then(([postsRes, contentRes, externalRes, publishedRes]) => {
      const posts = Array.isArray(postsRes.data) ? postsRes.data : [];
      const publishedDays = posts.map((p) => p.date).filter((d): d is string => Boolean(d));
      for (const item of publishedRes.data?.items ?? []) {
        if (item.published_at) publishedDays.push(item.published_at.slice(0, 10));
      }
      setPublishedDates(new Set(publishedDays));

      const map: Record<string, ScheduledEntry[]> = {};
      for (const item of contentRes.data?.items ?? []) {
        if (!item.scheduled_at) continue;
        const day = item.scheduled_at.slice(0, 10);
        (map[day] ??= []).push({ id: item.id, title: item.title, channel: item.channel, source: 'erp' });
      }
      for (const item of externalRes.data?.items ?? []) {
        const day = item.scheduled_at.slice(0, 10);
        (map[day] ??= []).push({ id: item.id, title: item.title, channel: item.channel, source: 'external' });
      }
      setScheduledByDate(map);
    }).finally(() => setLoading(false));
  }

  useEffect(() => {
    let active = true;
    load().then(() => { if (!active) return; });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cells = useMemo(() => monthGrid(viewMonth), [viewMonth]);
  const todayIso = isoDate(new Date());

  function changeMonth(delta: number) {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setSelectedDate(null);
  }

  const selectedScheduled = selectedDate ? scheduledByDate[selectedDate] ?? [] : [];
  const selectedPublished = selectedDate ? publishedDates.has(selectedDate) : false;

  async function saveExternal() {
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    try {
      await api.post('/marketing/scheduled-external', {
        title: form.title.trim(),
        channel: form.channel,
        scheduled_at: `${form.date}T${form.time}:00`,
      });
      setForm({ title: '', date: '', time: '12:00', channel: 'instagram' });
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function removeExternal(id: number) {
    await api.delete(`/marketing/scheduled-external/${id}`);
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} style={{ color: 'var(--erp-violet-light)' }} />
          <h1 className="text-base font-bold" style={{ color: 'var(--erp-text)' }}>Calendário</h1>
          {loading && <RefreshCw size={12} className="animate-spin" style={{ color: 'var(--erp-text-muted)' }} />}
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
          style={{ background: showForm ? 'var(--erp-surface-2)' : 'var(--erp-violet)', color: showForm ? 'var(--erp-text)' : '#fff' }}
        >
          {showForm ? <X size={12} /> : <Plus size={12} />}
          {showForm ? 'Cancelar' : 'Registrar agendamento externo'}
        </button>
      </div>

      {showForm && (
        <Card padding="sm">
          <p className="mb-2 text-xs" style={{ color: 'var(--erp-text-muted)' }}>
            Pra posts agendados fora do ERP (ex.: Meta Business Suite) — a Meta não deixa a gente buscar isso automaticamente.
          </p>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
            <input
              type="text"
              placeholder="Título do post"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="rounded-lg px-2.5 py-2 text-xs outline-none"
              style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}
            />
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="rounded-lg px-2.5 py-2 text-xs outline-none"
              style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}
            />
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              className="rounded-lg px-2.5 py-2 text-xs outline-none"
              style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}
            />
            <select
              value={form.channel}
              onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
              className="rounded-lg px-2.5 py-2 text-xs outline-none"
              style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}
            >
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="both">Ambos</option>
            </select>
            <button
              type="button"
              onClick={saveExternal}
              disabled={saving || !form.title.trim() || !form.date}
              className="rounded-lg px-3 py-2 text-xs font-semibold"
              style={{ background: 'var(--erp-violet)', color: '#fff', opacity: saving || !form.title.trim() || !form.date ? 0.6 : 1 }}
            >
              Salvar
            </button>
          </div>
        </Card>
      )}

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
        <div className="grid grid-cols-7 gap-1 px-1 pb-1">
          {cells.map((cell) => {
            const published = publishedDates.has(cell.date);
            const scheduledCount = (scheduledByDate[cell.date] ?? []).length;
            const scheduled = scheduledCount > 0;
            const isToday = cell.date === todayIso;
            const isSelected = cell.date === selectedDate;

            let background = 'transparent';
            let color = 'var(--erp-text)';
            let ring: string | undefined;
            if (isSelected) {
              background = 'var(--erp-violet)';
              color = '#fff';
            } else if (scheduled) {
              background = 'var(--erp-violet)';
              color = '#fff';
              if (published) ring = '0 0 0 2px var(--erp-surface), 0 0 0 4px var(--erp-emerald)';
            } else if (published) {
              background = 'var(--erp-emerald)';
              color = '#fff';
            } else if (isToday) {
              background = 'var(--erp-violet-soft)';
            }

            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => cell.inMonth && setSelectedDate((prev) => (prev === cell.date ? null : cell.date))}
                disabled={!cell.inMonth}
                aria-label={`${cell.day}${published ? ', publicado' : ''}${scheduled ? `, ${scheduledCount} agendado(s)` : ''}`}
                className="relative flex h-10 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-semibold transition-transform hover:scale-105 disabled:cursor-default disabled:hover:scale-100 sm:h-11"
                style={{
                  background,
                  color: !cell.inMonth ? 'var(--erp-text-dim)' : color,
                  opacity: cell.inMonth ? 1 : 0.35,
                  fontWeight: isToday || isSelected || scheduled || published ? 700 : 500,
                  boxShadow: isSelected ? undefined : ring,
                }}
              >
                <span>{cell.day}</span>
                {scheduledCount > 1 && (
                  <span
                    className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold"
                    style={{ background: 'var(--erp-amber)', color: '#fff' }}
                  >
                    {scheduledCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 px-1 pb-1 pt-2 text-[10px]" style={{ color: 'var(--erp-text-muted)' }}>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--erp-emerald)' }} /> Publicado</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--erp-violet)' }} /> Agendado (Estúdio ou externo)</span>
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
                <div key={`${item.source}-${item.id}`} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2" style={{ color: 'var(--erp-text)' }}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--erp-violet)' }} />
                    <span className="truncate">{item.title}</span>
                    {item.source === 'external' && (
                      <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide" style={{ background: 'var(--erp-surface-2)', color: 'var(--erp-text-dim)' }}>
                        Manual
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--erp-text-dim)' }}>{item.channel}</span>
                    {item.source === 'external' && (
                      <button type="button" onClick={() => removeExternal(item.id)} aria-label="Remover" style={{ color: 'var(--erp-text-dim)' }}>
                        <X size={11} />
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
          {selectedScheduled.some((item) => item.source === 'erp') && (
            <Link to="/marketing/estudio" className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--erp-violet-light)' }}>
              <Sparkles size={11} /> Editar no Estúdio
            </Link>
          )}
        </Card>
      )}
    </div>
  );
}
