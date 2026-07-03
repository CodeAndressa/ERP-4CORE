export type PeriodPreset = 'today' | 'last30' | 'month' | 'year' | 'all' | 'custom';

export type FinancePeriod = {
  preset: PeriodPreset;
  startDate?: string;
  endDate?: string;
};

export const DEFAULT_PERIOD: FinancePeriod = { preset: 'last30' };

function toIso(date: Date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return copy.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  const left = new Date(`${start}T12:00:00`).getTime();
  const right = new Date(`${end}T12:00:00`).getTime();
  return Math.max(1, Math.round((right - left) / 86400000) + 1);
}

export function getPeriodRange(period: FinancePeriod) {
  const now = new Date();
  const today = toIso(now);

  if (period.preset === 'last30') {
    const startDate = toIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
    return { label: 'Últimos 30 dias', startDate, endDate: today, days: 30 };
  }

  if (period.preset === 'month') {
    const startDate = toIso(new Date(now.getFullYear(), now.getMonth(), 1));
    return { label: 'Este mês', startDate, endDate: today, days: daysBetween(startDate, today) };
  }

  if (period.preset === 'year') {
    const startDate = toIso(new Date(now.getFullYear(), 0, 1));
    return { label: 'Este ano', startDate, endDate: today, days: daysBetween(startDate, today) };
  }

  if (period.preset === 'all') {
    return { label: 'Desde o início', startDate: undefined, endDate: today, days: 3650 };
  }

  if (period.preset === 'custom') {
    const startDate = period.startDate || today;
    const endDate = period.endDate || today;
    return { label: 'Personalizado', startDate, endDate, days: daysBetween(startDate, endDate) };
  }

  return { label: 'Hoje', startDate: today, endDate: today, days: 1 };
}

export function buildOverviewUrl(period: FinancePeriod, forceRefresh = false) {
  const range = getPeriodRange(period);
  const params = new URLSearchParams();
  params.set('days', String(range.days));
  if (range.startDate) params.set('start_date', range.startDate);
  if (range.endDate && period.preset !== 'all') params.set('end_date', range.endDate);
  if (forceRefresh) params.set('refresh', 'true');
  return `/financial/overview?${params.toString()}`;
}

export function isInFinancePeriod(date: string | undefined, period: FinancePeriod) {
  if (!date || period.preset === 'all') return true;
  const range = getPeriodRange(period);
  return (!range.startDate || date >= range.startDate) && (!range.endDate || date <= range.endDate);
}