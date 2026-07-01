import { useEffect, useState } from 'react';
import { Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { type FinancePeriod, type PeriodPreset, getPeriodRange } from './financePeriod';

const OPTIONS: { label: string; value: PeriodPreset }[] = [
  { label: 'Hoje', value: 'today' },
  { label: 'Este mês', value: 'month' },
  { label: 'Este ano', value: 'year' },
  { label: 'Desde o início', value: 'all' },
  { label: 'Personalizado', value: 'custom' },
];

type Props = {
  value: FinancePeriod;
  onApply: (period: FinancePeriod) => void;
  className?: string;
};

export default function FinancePeriodFilter({ value, onApply, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FinancePeriod>(value);
  const range = getPeriodRange(value);

  useEffect(() => { setDraft(value); }, [value]);

  function apply() {
    onApply(draft);
    setOpen(false);
  }

  function clear() {
    const next: FinancePeriod = { preset: 'today' };
    setDraft(next);
    onApply(next);
    setOpen(false);
  }

  return (
    <div className={`relative z-[1000] ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 min-w-[140px] items-center justify-center gap-2 rounded-full px-4 text-sm font-bold transition-all"
        style={{ background: '#dbeafe', border: '1px solid #2563eb', color: '#1d4ed8' }}
      >
        <Calendar size={16} />
        {range.label}
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="absolute right-0 z-[1001] mt-3 w-[306px] overflow-hidden rounded-2xl bg-white shadow-[0_18px_45px_rgba(15,23,42,0.22)]" style={{ border: '1px solid var(--erp-border)' }}>
          <div className="space-y-1 p-4">
            {OPTIONS.map((option) => {
              const active = draft.preset === option.value;
              return (
                <button key={option.value} type="button" onClick={() => setDraft((current) => ({ ...current, preset: option.value }))} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm font-medium" style={{ color: 'var(--erp-text)' }}>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ border: `1px solid ${active ? '#1d4ed8' : '#94a3b8'}` }}>
                    {active && <span className="h-3 w-3 rounded-full bg-[#1d4ed8]" />}
                  </span>
                  {option.label}
                </button>
              );
            })}

            {draft.preset === 'custom' && (
              <div className="grid grid-cols-2 gap-2 px-2 pt-2">
                <label className="text-[11px] font-semibold" style={{ color: 'var(--erp-text-muted)' }}>
                  Início
                  <input type="date" value={draft.startDate ?? ''} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} className="mt-1 h-10 w-full rounded-xl px-2 text-xs outline-none" style={{ border: '1px solid var(--erp-border)', background: 'var(--erp-surface-2)', color: 'var(--erp-text)' }} />
                </label>
                <label className="text-[11px] font-semibold" style={{ color: 'var(--erp-text-muted)' }}>
                  Fim
                  <input type="date" value={draft.endDate ?? ''} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} className="mt-1 h-10 w-full rounded-xl px-2 text-xs outline-none" style={{ border: '1px solid var(--erp-border)', background: 'var(--erp-surface-2)', color: 'var(--erp-text)' }} />
                </label>
              </div>
            )}
          </div>

          <div className="flex gap-4 p-4" style={{ borderTop: '1px solid var(--erp-border)' }}>
            <button type="button" onClick={clear} className="h-11 flex-1 rounded-full text-sm font-bold" style={{ border: '1px solid #1d4ed8', color: '#1d4ed8' }}>Limpar</button>
            <button type="button" onClick={apply} className="h-11 flex-1 rounded-full text-sm font-bold text-white" style={{ background: '#1d4ed8' }}>Aplicar</button>
          </div>
        </div>
      )}
    </div>
  );
}