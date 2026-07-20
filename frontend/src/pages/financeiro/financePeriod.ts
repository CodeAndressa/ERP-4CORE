export type PeriodPreset = 'today' | 'last30' | 'month' | 'year' | 'all' | 'custom';

export type FinancePeriod = {
  preset: PeriodPreset;
  startDate?: string;
  endDate?: string;
};

// O ASAAS usa "Este mês" como recorte operacional padrão. Manter o mesmo
// período evita comparar cobranças futuras/passadas com o painel mensal.
export const DEFAULT_PERIOD: FinancePeriod = { preset: 'month' };

function toIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
    const endDate = toIso(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    return { label: 'Este mês', startDate, endDate, days: daysBetween(startDate, endDate) };
  }

  if (period.preset === 'year') {
    const startDate = toIso(new Date(now.getFullYear(), 0, 1));
    const endDate = toIso(new Date(now.getFullYear(), 11, 31));
    return { label: 'Este ano', startDate, endDate, days: daysBetween(startDate, endDate) };
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
