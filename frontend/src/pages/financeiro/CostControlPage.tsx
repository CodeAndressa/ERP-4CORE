import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronDown, Infinity, Plus, ReceiptText, Repeat, ShieldCheck, Trash2, WalletCards } from 'lucide-react';
import { api } from '../../services/api';
import { Card, CardHeader } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';
import { currency, formatDate, localCostKey, monthLabel, type CostKind, type ManualExpense, type ManualFinancial } from './manualFinance';
import FinancePeriodFilter from './FinancePeriodFilter';
import { DEFAULT_PERIOD, type FinancePeriod } from './financePeriod';

type CostFilter = 'all' | 'fixed' | 'monthly' | 'recurring';
type RecurrenceMode = 'fixed' | 'monthly' | 'recurring';
type RecurrenceLimit = 'none' | 'count' | 'until';

type DraftCost = {
  description: string;
  value: string;
  totalValue: string;
  date: string;
  category: string;
  vendor: string;
  mode: RecurrenceMode;
  limit: RecurrenceLimit;
  repeatCount: string;
  paidCount: string;
  untilDate: string;
  notes: string;
};

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const today = localDateString();

const emptyDraft: DraftCost = {
  description: '',
  value: '',
  totalValue: '',
  date: today,
  category: '',
  vendor: '',
  mode: 'fixed',
  limit: 'none',
  repeatCount: '12',
  paidCount: '0',
  untilDate: '',
  notes: '',
};

const FILTERS: { label: string; value: CostFilter }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Pontuais', value: 'fixed' },
  { label: 'Mensais', value: 'monthly' },
  { label: 'Recorrentes', value: 'recurring' },
];

const MODES: { label: string; value: RecurrenceMode; hint: string }[] = [
  { label: 'Pontual', value: 'fixed', hint: 'lança uma vez' },
  { label: 'Mensal', value: 'monthly', hint: 'compromisso fixo todo mês' },
  { label: 'Recorrente', value: 'recurring', hint: 'parcelas ou período definido' },
];

const DELETED_COSTS_KEY = '4core.finance.deleted_cost_ids';

const COST_CATEGORIES = [
  'Empréstimos',
  'Impostos',
  'Logística',
  'Software',
  'Contabilidade',
  'Folha de pagamento',
  'Marketing',
  'Operacional',
  'Financeiro',
  'Aluguel',
  'Internet e telefonia',
  'Manutenção',
  'Outros',
];

const LIMITS: { label: string; value: RecurrenceLimit }[] = [
  { label: 'Sem prazo', value: 'none' },
  { label: 'Quantidade', value: 'count' },
  { label: 'Até data', value: 'until' },
];

function parseValue(value: string) {
  const cleaned = value.replace(/[^0-9,.-]/g, '').trim();
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/\.(?=\d{3}(\D|$))/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function addMonths(date: string, months: number) {
  const current = new Date(`${date}T12:00:00`);
  current.setMonth(current.getMonth() + months);
  return current.toISOString().slice(0, 10);
}

function recurringSeriesPrefix(id: string) {
  const match = id.match(/^(local-recurring-\d+)-\d+$/);
  return match?.[1] ?? null;
}

function recurrenceLabel(draft: DraftCost, index?: number, total?: number) {
  if (draft.mode === 'fixed') return 'Pontual';
  if (draft.mode === 'monthly') return 'Mensal sem prazo';
  if (draft.limit === 'count' && total) return `Recorrente ${index}/${total}`;
  if (draft.limit === 'until' && draft.untilDate) return `Recorrente até ${formatDate(draft.untilDate)}`;
  return 'Recorrente sem prazo';
}

function costKindFromMode(mode: RecurrenceMode): CostKind {
  return mode === 'fixed' ? 'fixed' : 'recurring';
}

function costFilter(item: ManualExpense): CostFilter {
  if (item.kind === 'fixed') return 'fixed';
  const recurrence = item.recurrence.toLowerCase();
  return recurrence.includes('recorrente') ? 'recurring' : 'monthly';
}

type CostGroup = {
  key: string;
  item: ManualExpense;
  installments: ManualExpense[];
  filter: CostFilter;
  paid: ManualExpense[];
  payable: ManualExpense[];
  total: number;
  paidTotal: number;
  payableTotal: number;
  contractTotal?: number;
  nextDue?: ManualExpense;
};

function costGroupKey(item: ManualExpense) {
  const seriesPrefix = item.id.startsWith('local-recurring-') ? recurringSeriesPrefix(item.id) : null;
  if (seriesPrefix) return seriesPrefix;
  return item.id;
}

function contractTotalFromNotes(notes?: string | null) {
  if (!notes) return undefined;
  const match = notes.match(/Total contratado:\s*R\$\s*([\d.,]+)/i);
  if (!match) return undefined;
  const value = parseValue(match[1]);
  return value > 0 ? value : undefined;
}

function buildCostGroups(items: ManualExpense[]): CostGroup[] {
  const map = new Map<string, ManualExpense[]>();
  items.forEach((item) => {
    const key = costGroupKey(item);
    map.set(key, [...(map.get(key) ?? []), item]);
  });

  return Array.from(map.entries()).map(([key, groupItems]) => {
    const installments = [...groupItems].sort((a, b) => a.date.localeCompare(b.date));
    const item = installments[0];
    const paid = installments.filter((entry) => entry.date < today);
    const payable = installments.filter((entry) => entry.date >= today);
    return {
      key,
      item,
      installments,
      filter: costFilter(item),
      paid,
      payable,
      total: installments.reduce((sum, entry) => sum + entry.value, 0),
      paidTotal: paid.reduce((sum, entry) => sum + entry.value, 0),
      payableTotal: payable.reduce((sum, entry) => sum + entry.value, 0),
      contractTotal: installments.map((entry) => contractTotalFromNotes(entry.notes)).find((value): value is number => typeof value === 'number'),
      nextDue: payable[0],
    };
  }).sort((a, b) => (a.nextDue?.date ?? a.item.date).localeCompare(b.nextDue?.date ?? b.item.date));
}

function costPlanningPeriodBounds(period: FinancePeriod) {
  const now = new Date();
  const iso = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().slice(0, 10);
  const current = localDateString(now);

  if (period.preset === 'all') return { startDate: undefined, endDate: undefined };
  if (period.preset === 'month') return { startDate: iso(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  if (period.preset === 'year') return { startDate: iso(new Date(now.getFullYear(), 0, 1)), endDate: iso(new Date(now.getFullYear(), 11, 31)) };
  if (period.preset === 'custom') return { startDate: period.startDate || current, endDate: period.endDate || current };
  return { startDate: current, endDate: current };
}

function isInCostPlanningPeriod(date: string | undefined, period: FinancePeriod) {
  if (!date) return false;
  const range = costPlanningPeriodBounds(period);
  return (!range.startDate || date >= range.startDate) && (!range.endDate || date <= range.endDate);
}
function buildEntries(draft: DraftCost): ManualExpense[] {
  const installmentValue = parseValue(draft.value);
  const totalValue = parseValue(draft.totalValue);
  if (installmentValue <= 0) return [];
  if (draft.mode === 'recurring' && totalValue > 0 && installmentValue > totalValue) return [];

  let occurrences = 1;
  if (draft.mode === 'recurring' && draft.limit === 'count') {
    occurrences = Math.max(1, Number(draft.repeatCount) || 1);
  }
  if (draft.mode === 'recurring' && draft.limit === 'until' && draft.untilDate) {
    occurrences = 0;
    let date = draft.date;
    while (date <= draft.untilDate && occurrences < 120) {
      occurrences += 1;
      date = addMonths(draft.date, occurrences);
    }
    occurrences = Math.max(1, occurrences);
  }

  const kind = costKindFromMode(draft.mode);
  const total = occurrences;
  const paidCount = draft.mode === 'recurring' ? Math.min(Math.max(0, Number(draft.paidCount) || 0), Math.max(0, total - 1)) : 0;
  const seriesId = `local-${kind}-${Date.now()}`;

  return Array.from({ length: occurrences }, (_, index) => {
    const date = draft.mode === 'recurring'
      ? addMonths(draft.date, index)
      : index === 0 ? draft.date : addMonths(draft.date, index);
    return {
      id: `${seriesId}-${index}`,
      month: date.slice(0, 7),
      date,
      category: draft.category || (kind === 'fixed' ? 'Operacional' : 'Recorrente'),
      description: draft.description || 'Novo custo',
      value: installmentValue,
      vendor: draft.vendor || 'Manual',
      kind,
      recurrence: recurrenceLabel(draft, index + 1, total),
      notes: [
        draft.notes,
        draft.mode === 'recurring' && totalValue > 0 ? 'Total contratado: ' + currency(totalValue, 2) : '',
        draft.mode === 'recurring' && paidCount > 0 ? `${paidCount} parcela(s) já paga(s)` : '',
      ].filter(Boolean).join(' | ') || null,
    };
  });
}

export default function CostControlPage({ kind }: { kind?: CostKind }) {
  const [data, setData] = useState<ManualFinancial | null>(null);
  const [manualFixed, setManualFixed] = useState<ManualExpense[]>([]);
  const [manualRecurring, setManualRecurring] = useState<ManualExpense[]>([]);
  const [deletedCostIds, setDeletedCostIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<DraftCost>({ ...emptyDraft, mode: kind === 'recurring' ? 'monthly' : 'fixed' });
  const [filter, setFilter] = useState<CostFilter>(kind === 'recurring' ? 'monthly' : kind === 'fixed' ? 'fixed' : 'all');
  const [period, setPeriod] = useState<FinancePeriod>(DEFAULT_PERIOD);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  useEffect(() => {
    api.get<ManualFinancial>('/financial/manual')
      .then(({ data: response }) => setData(response))
      .catch(() => setData(null))
      .finally(() => setLoading(false));

    const deleted = localStorage.getItem(DELETED_COSTS_KEY);
    if (deleted) {
      try {
        setDeletedCostIds(JSON.parse(deleted));
      } catch {
        setDeletedCostIds([]);
      }
    }

    ([['fixed', setManualFixed], ['recurring', setManualRecurring]] as const).forEach(([entryKind, setter]) => {
      const stored = localStorage.getItem(localCostKey(entryKind));
      if (!stored) return;
      try {
        setter(JSON.parse(stored));
      } catch {
        setter([]);
      }
    });
  }, []);

  const allCosts = [
    ...(data?.fixed_costs ?? []),
    ...(data?.recurring_costs ?? []),
    ...manualFixed,
    ...manualRecurring,
  ].filter((item) => !deletedCostIds.includes(item.id)).sort((a, b) => a.date.localeCompare(b.date));

  const periodCosts = allCosts.filter((item) => isInCostPlanningPeriod(item.date, period));
  const costs = filter === 'all' ? periodCosts : periodCosts.filter((item) => costFilter(item) === filter);
  const paidCosts = costs.filter((item) => item.date < today);
  const payableCosts = costs.filter((item) => item.date >= today);
  const paidTotal = paidCosts.reduce((sum, item) => sum + item.value, 0);
  const payableTotal = payableCosts.reduce((sum, item) => sum + item.value, 0);
  const total = costs.reduce((sum, item) => sum + item.value, 0);
  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    costs.forEach((item) => map.set(item.month, (map.get(item.month) ?? 0) + item.value));
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({ month, value }));
  }, [costs]);
  const futureCosts = payableCosts;
  const nextDue = futureCosts[0] ?? costs[costs.length - 1];
  const costGroups = buildCostGroups(costs);


  function toggleGroup(key: string) {
    setExpandedGroups((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  function removeCost(item: ManualExpense) {
    if (item.id.startsWith('local-fixed-')) {
      const next = manualFixed.filter((entry) => entry.id !== item.id);
      setManualFixed(next);
      localStorage.setItem(localCostKey('fixed'), JSON.stringify(next));
      return;
    }

    if (item.id.startsWith('local-recurring-')) {
      const seriesPrefix = recurringSeriesPrefix(item.id);
      const next = seriesPrefix ? manualRecurring.filter((entry) => !entry.id.startsWith(seriesPrefix)) : manualRecurring.filter((entry) => entry.id !== item.id);
      setManualRecurring(next);
      localStorage.setItem(localCostKey('recurring'), JSON.stringify(next));
      return;
    }

    const next = Array.from(new Set([...deletedCostIds, item.id]));
    setDeletedCostIds(next);
    localStorage.setItem(DELETED_COSTS_KEY, JSON.stringify(next));
  }
  function saveManualEntry() {
    const installmentValue = parseValue(draft.value);
    const totalValue = parseValue(draft.totalValue);
    if (draft.mode === 'recurring' && totalValue > 0 && installmentValue > totalValue) {
      window.alert('O valor da parcela mensal não pode ser maior que o valor total contratado.');
      return;
    }

    const entries = buildEntries(draft);
    if (!entries.length) {
      window.alert('Preencha pelo menos descrição e valor para adicionar o custo.');
      return;
    }

    const fixedEntries = entries.filter((entry) => entry.kind === 'fixed');
    const recurringEntries = entries.filter((entry) => entry.kind === 'recurring');

    if (fixedEntries.length) {
      const next = [...manualFixed, ...fixedEntries];
      setManualFixed(next);
      localStorage.setItem(localCostKey('fixed'), JSON.stringify(next));
    }
    if (recurringEntries.length) {
      const next = [...manualRecurring, ...recurringEntries];
      setManualRecurring(next);
      localStorage.setItem(localCostKey('recurring'), JSON.stringify(next));
    }

    setFilter(costFilter(entries[0]));
    setDraft({ ...emptyDraft, mode: draft.mode });
  }

  return (
    <div className="space-y-6">
      <div className="relative z-[900] flex flex-col gap-2 border-b border-violet-100 pb-3 sm:flex-row sm:items-center sm:justify-end">
        <FinancePeriodFilter value={period} onApply={setPeriod} />
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className="h-9 shrink-0 rounded-full px-4 text-xs font-bold transition-all"
                style={{
                  background: filter === item.value ? 'var(--erp-violet)' : 'var(--erp-surface-2)',
                  border: '1px solid var(--erp-border)',
                  color: filter === item.value ? '#fff' : 'var(--erp-text-muted)',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Total previsto" value={loading ? '...' : currency(total, 2)} detail={`${costs.length} lançamentos no período`} tone="rose" icon={<WalletCards size={16} />} />
        <MetricCard label="Já pago" value={loading ? '...' : currency(paidTotal, 2)} detail={`${paidCosts.length} lançamentos vencidos`} tone="violet" icon={<ReceiptText size={16} />} />
        <MetricCard label="A pagar" value={loading ? '...' : currency(payableTotal, 2)} detail={`${payableCosts.length} lançamentos futuros`} tone="amber" icon={<Repeat size={16} />} />
        <MetricCard label="Próximo vencimento" value={nextDue ? formatDate(nextDue.date) : '-'} detail={nextDue?.description ?? 'sem próximos itens'} tone="cyan" icon={<CalendarDays size={16} />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <Card padding="lg">
          <CardHeader title="Custos cadastrados" subtitle="Pontuais, mensais e recorrentes em uma única lista" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                  {['Contrato', 'Categoria', 'Fornecedor', 'Parcelas', 'Valor do emprestimo', 'Total com juros', 'Ja pago', 'A pagar', 'Proximo', ''].map((heading) => (
                    <th key={heading} className="pb-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--erp-text-dim)' }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--erp-border)' }}>
                {costGroups.map((group) => {
                  const label = group.filter === 'fixed' ? 'Pontual' : group.filter === 'monthly' ? 'Mensal' : 'Recorrente';
                  const isExpanded = expandedGroups.includes(group.key);
                  const canExpand = group.installments.length > 1;
                  const statusLabel = `${group.paid.length} pagas / ${group.payable.length} a vencer`;
                  return (
                    <>
                      <tr key={group.key}>
                        <td className="py-3">
                          <button type="button" onClick={() => canExpand && toggleGroup(group.key)} className="flex items-center gap-2 text-left" style={{ color: 'var(--erp-text)' }}>
                            {canExpand && <ChevronDown size={15} className="transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />}
                            <span className="font-semibold">{group.item.description}</span>
                          </button>
                          <span className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: group.item.kind === 'fixed' ? 'var(--erp-violet-dim)' : 'rgba(251,191,36,0.12)', color: group.item.kind === 'fixed' ? 'var(--erp-violet-light)' : '#b45309' }}>{label}</span>
                        </td>
                        <td className="py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{group.item.category}</td>
                        <td className="py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{group.item.vendor}</td>
                        <td className="py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{statusLabel}</td>
                        <td className="py-3 font-semibold tabular-nums" style={{ color: 'var(--erp-text)' }}>{group.contractTotal ? currency(group.contractTotal, 2) : '-'}</td>
                        <td className="py-3 font-semibold tabular-nums" style={{ color: '#f59e0b' }}>{currency(group.total, 2)}</td>
                        <td className="py-3 font-semibold tabular-nums" style={{ color: '#047857' }}>{currency(group.paidTotal, 2)}</td>
                        <td className="py-3 font-semibold tabular-nums" style={{ color: '#2563eb' }}>{currency(group.payableTotal, 2)}</td>
                        <td className="py-3 text-xs tabular-nums" style={{ color: 'var(--erp-text-muted)' }}>{group.nextDue ? formatDate(group.nextDue.date) : '-'}</td>
                        <td className="py-3 text-right">
                          <button type="button" onClick={() => removeCost(group.item)} className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors" style={{ border: '1px solid var(--erp-border)', color: '#ef4444', background: '#fff' }} aria-label="Remover lançamento">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && group.installments.map((item) => (
                        <tr key={item.id} style={{ background: 'var(--erp-surface-2)' }}>
                          <td className="py-2 pl-8 text-xs tabular-nums" style={{ color: 'var(--erp-text-muted)' }}>{formatDate(item.date)}</td>
                          <td className="py-2 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{item.recurrence}</td>
                          <td className="py-2 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{item.vendor}</td>
                          <td className="py-2"><span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: item.date < today ? 'rgba(52,211,153,0.12)' : 'rgba(59,130,246,0.12)', color: item.date < today ? '#047857' : '#2563eb' }}>{item.date < today ? 'Pago' : 'A vencer'}</span></td>
                          <td className="py-2 text-xs" style={{ color: 'var(--erp-text-dim)' }}>Parcela</td>
                          <td className="py-2 font-semibold tabular-nums" style={{ color: '#f59e0b' }}>{currency(item.value, 2)}</td>
                          <td className="py-2 text-xs" style={{ color: 'var(--erp-text-dim)' }}>{item.date < today ? currency(item.value, 2) : '-'}</td>
                          <td className="py-2 text-xs" style={{ color: 'var(--erp-text-dim)' }}>{item.date >= today ? currency(item.value, 2) : '-'}</td>
                          <td className="py-2 text-xs" style={{ color: 'var(--erp-text-dim)' }}>{item.notes ?? '-'}</td>
                          <td />
                        </tr>
                      ))}
                    </>
                  );
                })}
                {!loading && costGroups.length === 0 && (
                  <tr><td colSpan={10} className="py-10 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhum custo cadastrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader title="Novo lançamento" subtitle="Escolha o tipo e o sistema monta os lançamentos" />
          <div className="space-y-3">
            <div>
              <span className="mb-2 block text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>Tipo</span>
              <div className="grid grid-cols-3 gap-2">
                {MODES.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setDraft((current) => ({ ...current, mode: mode.value, limit: mode.value === 'recurring' ? (current.limit === 'none' ? 'count' : current.limit) : 'none' }))}
                    className="min-h-16 rounded-2xl px-2 py-2 text-left text-xs font-bold transition-all"
                    style={{
                      background: draft.mode === mode.value ? 'var(--erp-violet)' : 'var(--erp-surface-2)',
                      border: '1px solid var(--erp-border)',
                      color: draft.mode === mode.value ? '#fff' : 'var(--erp-text)',
                    }}
                  >
                    <span className="block">{mode.label}</span>
                    <span className="mt-1 block text-[10px] font-medium opacity-75">{mode.hint}</span>
                  </button>
                ))}
              </div>
            </div>
            {[
              ['description', 'Descrição', 'text'],
              ['value', draft.mode === 'recurring' ? 'Valor da parcela mensal' : 'Valor', 'text'],
              ['date', draft.mode === 'recurring' ? 'Primeiro vencimento' : 'Vencimento', 'date'],
              ['vendor', 'Fornecedor', 'text'],
            ].map(([key, label, type]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>{label}</span>
                <input
                  type={type}
                  value={draft[key as keyof DraftCost]}
                  onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                  className="h-10 w-full rounded-xl px-3 text-sm outline-none"
                  style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}
                />
              </label>
            ))}

            {draft.mode === 'recurring' && (
              <label className="block">
                <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>Valor total</span>
                <input
                  value={draft.totalValue}
                  onChange={(event) => setDraft((current) => ({ ...current, totalValue: event.target.value }))}
                  className="h-10 w-full rounded-xl px-3 text-sm outline-none"
                  style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}
                />
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>Categoria</span>
              <select
                value={draft.category}
                onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                className="h-10 w-full rounded-xl px-3 text-sm outline-none"
                style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}
              >
                <option value="">Selecionar categoria</option>
                {COST_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>

            {draft.mode === 'recurring' && (
              <div className="rounded-2xl p-3" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)' }}>
                <span className="mb-2 block text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>Limite da recorrência</span>
                <div className="grid grid-cols-3 gap-2">
                  {LIMITS.map((limit) => (
                    <button
                      key={limit.value}
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, limit: limit.value }))}
                      className="flex h-9 items-center justify-center gap-1 rounded-full px-2 text-[11px] font-bold"
                      style={{
                        background: draft.limit === limit.value ? '#fff' : 'transparent',
                        border: '1px solid var(--erp-border)',
                        color: draft.limit === limit.value ? 'var(--erp-text)' : 'var(--erp-text-muted)',
                      }}
                    >
                      {limit.value === 'none' && <Infinity size={12} />}
                      {limit.value !== 'none' && <Check size={12} />}
                      {limit.label}
                    </button>
                  ))}
                </div>
                {draft.limit === 'count' && (
                  <label className="mt-3 block">
                    <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>Total de parcelas</span>
                    <input type="number" min="1" value={draft.repeatCount} onChange={(event) => setDraft((current) => ({ ...current, repeatCount: event.target.value }))} className="h-10 w-full rounded-xl px-3 text-sm outline-none" style={{ background: '#fff', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
                  </label>
                )}
                {draft.limit === 'count' && (
                  <label className="mt-3 block">
                    <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>Parcelas já pagas</span>
                    <input type="number" min="0" max={Math.max(0, Number(draft.repeatCount) - 1)} value={draft.paidCount} onChange={(event) => setDraft((current) => ({ ...current, paidCount: event.target.value }))} className="h-10 w-full rounded-xl px-3 text-sm outline-none" style={{ background: '#fff', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
                  </label>
                )}
                {draft.limit === 'until' && (
                  <label className="mt-3 block">
                    <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>Repetir até</span>
                    <input type="date" value={draft.untilDate} onChange={(event) => setDraft((current) => ({ ...current, untilDate: event.target.value }))} className="h-10 w-full rounded-xl px-3 text-sm outline-none" style={{ background: '#fff', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
                  </label>
                )}
              </div>
            )}

            <label className="block">
              <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>Observação</span>
              <input value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} className="h-10 w-full rounded-xl px-3 text-sm outline-none" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
            </label>

            <button
              type="button"
              onClick={saveManualEntry}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: 'var(--erp-violet)', color: '#fff' }}
            >
              <Plus size={15} />
              Adicionar custo
            </button>
          </div>
        </Card>
      </div>

      <Card padding="lg">
        <CardHeader title="Linha mensal" subtitle="Leitura rápida de pressão no caixa" />
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {monthly.map((item) => (
            <div key={item.month} className="rounded-xl px-3 py-3" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)' }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--erp-text-muted)' }}>{monthLabel(item.month)}</span>
                <ShieldCheck size={13} style={{ color: '#f59e0b' }} />
              </div>
              <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--erp-text)' }}>{currency(item.value, 2)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
