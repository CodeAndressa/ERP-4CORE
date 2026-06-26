import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react';
import { api } from '../../services/api';
import { Card, CardHeader } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';
import { currency, formatDate, localCostKey, monthLabel, type CostKind, type ManualExpense, type ManualFinancial } from './manualFinance';

type DraftCost = {
  description: string;
  value: string;
  date: string;
  category: string;
  vendor: string;
  recurrence: string;
  notes: string;
};

const emptyDraft: DraftCost = {
  description: '',
  value: '',
  date: new Date().toISOString().slice(0, 10),
  category: '',
  vendor: '',
  recurrence: 'Mensal',
  notes: '',
};

const toneByKind = {
  fixed: {
    eyebrow: 'Custos fixos',
    title: 'Custos Fixos',
    subtitle: 'Compromissos manuais, impostos, logística e despesas previsíveis do mês',
    totalLabel: 'Fixos do mês',
    plannedLabel: 'Base operacional',
    tableTitle: 'Custos fixos cadastrados',
    accent: '#f87171',
    tone: 'rose' as const,
  },
  recurring: {
    eyebrow: 'Custos recorrentes',
    title: 'Custos Recorrentes',
    subtitle: 'Assinaturas, serviços, contabilidade, empréstimos e contratos mensais',
    totalLabel: 'Recorrente mensal',
    plannedLabel: 'Compromisso ativo',
    tableTitle: 'Recorrências cadastradas',
    accent: '#fbbf24',
    tone: 'amber' as const,
  },
};

function parseValue(value: string) {
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildEntry(kind: CostKind, draft: DraftCost): ManualExpense {
  return {
    id: `local-${kind}-${Date.now()}`,
    month: draft.date.slice(0, 7),
    date: draft.date,
    category: draft.category || (kind === 'fixed' ? 'Operacional' : 'Recorrente'),
    description: draft.description || 'Novo custo',
    value: parseValue(draft.value),
    vendor: draft.vendor || 'Manual',
    kind,
    recurrence: draft.recurrence || (kind === 'fixed' ? 'Pontual' : 'Mensal'),
    notes: draft.notes || null,
  };
}

export default function CostControlPage({ kind }: { kind: CostKind }) {
  const config = toneByKind[kind];
  const [data, setData] = useState<ManualFinancial | null>(null);
  const [manualEntries, setManualEntries] = useState<ManualExpense[]>([]);
  const [draft, setDraft] = useState<DraftCost>({ ...emptyDraft, recurrence: kind === 'fixed' ? 'Pontual' : 'Mensal' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ManualFinancial>('/financial/manual')
      .then(({ data: response }) => setData(response))
      .catch(() => setData(null))
      .finally(() => setLoading(false));

    const stored = localStorage.getItem(localCostKey(kind));
    if (stored) {
      try {
        setManualEntries(JSON.parse(stored));
      } catch {
        setManualEntries([]);
      }
    }
  }, [kind]);

  const baseCosts = kind === 'fixed' ? data?.fixed_costs ?? [] : data?.recurring_costs ?? [];
  const costs = [...baseCosts, ...manualEntries].sort((a, b) => a.date.localeCompare(b.date));
  const total = costs.reduce((sum, item) => sum + item.value, 0);
  const average = costs.length ? total / costs.length : 0;
  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    costs.forEach((item) => map.set(item.month, (map.get(item.month) ?? 0) + item.value));
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({ month, value }));
  }, [costs]);
  const futureCosts = costs.filter((item) => item.date >= new Date().toISOString().slice(0, 10));
  const nextDue = futureCosts[0] ?? costs[costs.length - 1];

  function saveManualEntry() {
    const entry = buildEntry(kind, draft);
    if (entry.value <= 0) return;
    const next = [...manualEntries, entry];
    setManualEntries(next);
    localStorage.setItem(localCostKey(kind), JSON.stringify(next));
    setDraft({ ...emptyDraft, recurrence: kind === 'fixed' ? 'Pontual' : 'Mensal' });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-violet-100 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
          <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--erp-violet-light)' }}>{config.eyebrow}</p>
          <h1 className="shrink-0 text-xl font-bold" style={{ color: 'var(--erp-text)' }}>{config.title}</h1>
          <p className="min-w-0 truncate text-sm" style={{ color: 'var(--erp-text-muted)' }}>{config.subtitle}</p>
        </div>
        <span className="shrink-0 rounded-full px-3 py-1 text-xs font-medium" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text-muted)' }}>
          Cadastro manual
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label={config.totalLabel} value={loading ? '...' : currency(total, 2)} detail={`${costs.length} itens ativos`} tone={config.tone} icon={<WalletCards size={16} />} />
        <MetricCard label="Ticket médio" value={loading ? '...' : currency(average, 2)} detail="por lançamento" tone="violet" icon={<ReceiptText size={16} />} />
        <MetricCard label={config.plannedLabel} value={nextDue ? formatDate(nextDue.date) : '-'} detail={nextDue?.description ?? 'sem próximos itens'} tone="cyan" icon={<CalendarDays size={16} />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card padding="lg">
          <CardHeader title={config.tableTitle} subtitle="Base do backend + lançamentos manuais deste navegador" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                  {['Data', 'Descrição', 'Categoria', 'Fornecedor', 'Recorrência', 'Valor', 'Obs.'].map((heading) => (
                    <th key={heading} className="pb-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--erp-text-dim)' }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--erp-border)' }}>
                {costs.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 text-xs tabular-nums" style={{ color: 'var(--erp-text-muted)' }}>{formatDate(item.date)}</td>
                    <td className="py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{item.description}</td>
                    <td className="py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{item.category}</td>
                    <td className="py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{item.vendor}</td>
                    <td className="py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{item.recurrence}</td>
                    <td className="py-3 font-semibold tabular-nums" style={{ color: config.accent }}>{currency(item.value, 2)}</td>
                    <td className="py-3 text-xs" style={{ color: 'var(--erp-text-dim)' }}>{item.notes ?? '-'}</td>
                  </tr>
                ))}
                {!loading && costs.length === 0 && (
                  <tr><td colSpan={7} className="py-10 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhum custo cadastrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader title="Novo lançamento" subtitle="Entrada manual rápida" />
          <div className="space-y-3">
            {[
              ['description', 'Descrição'],
              ['value', 'Valor'],
              ['date', 'Vencimento'],
              ['category', 'Categoria'],
              ['vendor', 'Fornecedor'],
              ['recurrence', 'Recorrência'],
              ['notes', 'Observação'],
            ].map(([key, label]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>{label}</span>
                <input
                  type={key === 'date' ? 'date' : 'text'}
                  value={draft[key as keyof DraftCost]}
                  onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                  className="h-10 w-full rounded-xl px-3 text-sm outline-none"
                  style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}
                />
              </label>
            ))}
            <button
              type="button"
              onClick={saveManualEntry}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors"
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
                <ShieldCheck size={13} style={{ color: config.accent }} />
              </div>
              <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--erp-text)' }}>{currency(item.value, 2)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

