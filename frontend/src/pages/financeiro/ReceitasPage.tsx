import { useCallback, useEffect, useState } from 'react';
import { Calendar, CheckCircle, ChevronDown, DollarSign, Link2, Plus, RefreshCw, Trash2, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';
import { Card, CardHeader } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';
import { currency, DELETED_DIRECT_SALES_KEY, formatDate, LOCAL_DIRECT_SALES_KEY, readDeletedDirectSaleIds, readLocalDirectSales, type DirectSale, type ManualFinancial } from './manualFinance';
import FinancePeriodFilter from './FinancePeriodFilter';
import { DEFAULT_PERIOD, buildOverviewUrl, isInFinancePeriod, type FinancePeriod } from './financePeriod';

interface Payment {
  id: string;
  customer?: string;
  description?: string;
  value: number;
  due_date?: string;
  status?: string;
  payment_method?: string;
}
interface Overview {
  received_value?: number;
  received_count?: number;
  summary?: { total_received?: number; total_pending?: number; mrr?: number };
  payments?: Payment[];
  manual_financial?: ManualFinancial;
}

type DirectSaleDraft = {
  date: string;
  customer: string;
  description: string;
  value: string;
  contract_total: string;
  installment_count: string;
};

const RECEIVED_STATUSES = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'received', 'confirmed', 'received_in_cash']);
const today = new Date().toISOString().slice(0, 10);
const emptyDirectSale: DirectSaleDraft = { date: today, customer: '', description: '', value: '', contract_total: '', installment_count: '1' };

function parseMoney(value: string) {
  const cleaned = value.replace(/[^0-9,.-]/g, '').trim();
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/\.(?=\d{3}(\D|$))/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}
function addMonths(date: string, months: number) {
  const current = new Date(`${date}T12:00:00`);
  current.setMonth(current.getMonth() + months);
  return current.toISOString().slice(0, 10);
}

function directSaleSeriesPrefix(id: string) {
  const match = id.match(/^(local-direct-sale-\d+)-\d+$/);
  return match?.[1] ?? null;
}

type DirectSaleGroup = {
  key: string;
  item: DirectSale;
  installments: DirectSale[];
  totalInstallments: number;
  installmentTotal: number;
  contractTotal: number;
};

function directSaleGroupKey(item: DirectSale) {
  return directSaleSeriesPrefix(item.id) ?? item.id;
}

function buildDirectSaleGroups(items: DirectSale[]): DirectSaleGroup[] {
  const map = new Map<string, DirectSale[]>();
  items.forEach((item) => {
    const key = directSaleGroupKey(item);
    map.set(key, [...(map.get(key) ?? []), item]);
  });

  return Array.from(map.entries()).map(([key, groupItems]) => {
    const installments = [...groupItems].sort((a, b) => a.date.localeCompare(b.date));
    const item = installments[0];
    return {
      key,
      item,
      installments,
      totalInstallments: installments.length,
      installmentTotal: installments.reduce((sum, entry) => sum + entry.value, 0),
      contractTotal: item.contract_total || installments.reduce((sum, entry) => sum + entry.value, 0),
    };
  }).sort((a, b) => a.item.date.localeCompare(b.item.date));
}

export default function ReceitasPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<FinancePeriod>(DEFAULT_PERIOD);
  const [localDirectSales, setLocalDirectSales] = useState<DirectSale[]>([]);
  const [deletedDirectSaleIds, setDeletedDirectSaleIds] = useState<string[]>([]);
  const [directSaleDraft, setDirectSaleDraft] = useState<DirectSaleDraft>(emptyDirectSale);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const load = useCallback((forceRefresh = false) => {
    setLoading(true);
    api.get<Overview>(buildOverviewUrl(period, forceRefresh))
      .then(({ data: d }) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => { load(false); }, [load]);
  useEffect(() => {
    setLocalDirectSales(readLocalDirectSales());
    setDeletedDirectSaleIds(readDeletedDirectSaleIds());
  }, []);

  const periodPayments = (data?.payments ?? []).filter((p) => isInFinancePeriod(p.due_date, period));
  const received = periodPayments.filter((p) => RECEIVED_STATUSES.has(p.status ?? ''));
  const baseDirectSales = (data?.manual_financial?.direct_sales ?? []).filter((item) => !deletedDirectSaleIds.includes(item.id) && isInFinancePeriod(item.date, period));
  const directSales = [...baseDirectSales, ...localDirectSales.filter((item) => isInFinancePeriod(item.date, period))].sort((a, b) => a.date.localeCompare(b.date));
  const totalReceived = received.reduce((sum, item) => sum + item.value, 0);
  const totalDirectSales = directSales.reduce((sum, item) => sum + item.value, 0);
  const unmatchedDirectSales = directSales.filter((item) => !item.matched).reduce((sum, item) => sum + item.value, 0);
  const receivedCount = received.length;
  const avgTicket = receivedCount > 0 ? totalReceived / receivedCount : 0;
  const directSaleGroups = buildDirectSaleGroups(directSales);

  function toggleGroup(key: string) {
    setExpandedGroups((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  function saveLocalDirectSale() {
    const contractTotal = parseMoney(directSaleDraft.contract_total);
    const installmentCount = Math.max(1, Number(directSaleDraft.installment_count) || 1);
    const typedInstallmentValue = parseMoney(directSaleDraft.value);
    const value = typedInstallmentValue > 0 ? typedInstallmentValue : contractTotal > 0 ? contractTotal / installmentCount : 0;
    if (value <= 0) return;

    const date = directSaleDraft.date || today;
    const seriesId = `local-direct-sale-${Date.now()}`;
    const entries: DirectSale[] = Array.from({ length: installmentCount }, (_, index) => {
      const installmentDate = addMonths(date, index);
      return {
        id: `${seriesId}-${index}`,
        month: installmentDate.slice(0, 7),
        date: installmentDate,
        customer: directSaleDraft.customer || 'Cliente manual',
        description: directSaleDraft.description || 'Venda direta',
        value,
        contract_total: contractTotal || value * installmentCount,
        source: 'Manual',
        matched: false,
        asaas_match: null,
      };
    });

    const next = [...localDirectSales, ...entries];
    setLocalDirectSales(next);
    localStorage.setItem(LOCAL_DIRECT_SALES_KEY, JSON.stringify(next));
    setDirectSaleDraft(emptyDirectSale);
  }

  function removeDirectSale(item: DirectSale) {
    if (item.id.startsWith('local-direct-sale-')) {
      const seriesPrefix = directSaleSeriesPrefix(item.id);
      const next = seriesPrefix ? localDirectSales.filter((entry) => !entry.id.startsWith(seriesPrefix)) : localDirectSales.filter((entry) => entry.id !== item.id);
      setLocalDirectSales(next);
      localStorage.setItem(LOCAL_DIRECT_SALES_KEY, JSON.stringify(next));
      return;
    }
    const next = Array.from(new Set([...deletedDirectSaleIds, item.id]));
    setDeletedDirectSaleIds(next);
    localStorage.setItem(DELETED_DIRECT_SALES_KEY, JSON.stringify(next));
  }

  return (
    <div className="space-y-6">
      <div className="relative z-[900] flex flex-col gap-3 border-b border-violet-100 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--erp-violet-light)' }}>Financeiro ASAAS</p>
          <h1 className="text-xl font-bold" style={{ color: 'var(--erp-text)' }}>Receita</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <FinancePeriodFilter value={period} onApply={setPeriod} />
          <button onClick={() => load(true)} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-violet-100 bg-white px-4 text-xs font-bold transition hover:border-violet-200 hover:text-violet-700" style={{ color: 'var(--erp-text-muted)' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Recebido ASAAS" value={loading ? '...' : currency(totalReceived, 2)} detail={`${receivedCount} pagamentos`} tone="emerald" icon={<CheckCircle size={16} />} />
        <MetricCard label="Ticket médio" value={loading ? '...' : currency(avgTicket, 2)} detail="por pagamento recebido" tone="violet" icon={<DollarSign size={16} />} />
        <MetricCard label="MRR" value={loading ? '...' : currency(data?.summary?.mrr ?? 0, 2)} detail="receita mensal recorrente" tone="amber" icon={<TrendingUp size={16} />} />
        <MetricCard label="Venda direta" value={loading ? '...' : currency(totalDirectSales, 2)} detail={`${currency(unmatchedDirectSales, 2)} sem match`} tone="cyan" icon={<Link2 size={16} />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <Card padding="sm">
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--erp-border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Vendas diretas manuais</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}>Parcelas de reposição de caixa que entram na Visão Geral.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                  {['Cliente', 'Descrição', 'Parcelas', 'Valor da parcela', 'Total do contrato', 'Receita prevista', 'Origem', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {directSaleGroups.map((group, i) => {
                  const isExpanded = expandedGroups.includes(group.key);
                  const canExpand = group.installments.length > 1;
                  return (
                    <>
                      <tr key={group.key} style={{ borderBottom: i < directSaleGroups.length - 1 ? '1px solid var(--erp-border)' : undefined }}>
                        <td className="px-4 py-3 font-medium max-w-xs" style={{ color: 'var(--erp-text)' }}>
                          <button type="button" onClick={() => canExpand && toggleGroup(group.key)} className="flex items-center gap-2 text-left">
                            {canExpand && <ChevronDown size={15} className="transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />}
                            <span>{group.item.customer}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{group.item.description}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{group.totalInstallments}x</td>
                        <td className="px-4 py-3 font-semibold tabular-nums" style={{ color: 'var(--erp-emerald)' }}>{currency(group.item.value, 2)}</td>
                        <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--erp-text-muted)' }}>{currency(group.contractTotal, 2)}</td>
                        <td className="px-4 py-3 font-semibold tabular-nums" style={{ color: 'var(--erp-emerald)' }}>{currency(group.installmentTotal, 2)}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: group.item.matched ? 'rgba(4,120,87,0.12)' : 'rgba(180,83,9,0.12)', color: group.item.matched ? 'var(--erp-emerald)' : 'var(--erp-amber)' }}>
                            {group.item.id.startsWith('local-direct-sale-') ? 'Manual' : group.item.matched ? 'Conciliado' : 'Base manual'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => removeDirectSale(group.item)} className="inline-flex h-8 w-8 items-center justify-center rounded-full" style={{ border: '1px solid var(--erp-border)', color: 'var(--erp-rose)', background: '#fff' }} aria-label="Remover venda direta">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && group.installments.map((item) => (
                        <tr key={item.id} style={{ background: 'var(--erp-surface-2)' }}>
                          <td className="px-4 py-2 pl-10 text-xs tabular-nums" style={{ color: 'var(--erp-text-muted)' }}>{formatDate(item.date)}</td>
                          <td className="px-4 py-2 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{item.description}</td>
                          <td className="px-4 py-2 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{item.month}</td>
                          <td className="px-4 py-2 font-semibold tabular-nums" style={{ color: 'var(--erp-emerald)' }}>{currency(item.value, 2)}</td>
                          <td className="px-4 py-2 text-xs tabular-nums" style={{ color: 'var(--erp-text-dim)' }}>{currency(item.contract_total, 2)}</td>
                          <td className="px-4 py-2 text-xs" style={{ color: 'var(--erp-text-dim)' }}>Parcela</td>
                          <td className="px-4 py-2 text-xs" style={{ color: 'var(--erp-text-dim)' }}>{item.source}</td>
                          <td />
                        </tr>
                      ))}
                    </>
                  );
                })}
                {!loading && directSaleGroups.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhuma venda direta cadastrada no período</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader title="Nova venda direta" subtitle="Cadastro manual" />
          <div className="space-y-3">
            {[
              ['date', 'Primeiro vencimento', 'date'],
              ['customer', 'Cliente', 'text'],
              ['description', 'Descrição', 'text'],
              ['value', 'Valor da parcela', 'text'],
              ['contract_total', 'Total do contrato', 'text'],
              ['installment_count', 'Quantidade de parcelas', 'number'],
            ].map(([key, label, type]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>{label}</span>
                <input type={type} min={key === 'installment_count' ? '1' : undefined} value={directSaleDraft[key as keyof DirectSaleDraft]} onChange={(event) => setDirectSaleDraft((current) => ({ ...current, [key]: event.target.value }))} className="h-10 w-full rounded-xl px-3 text-sm outline-none" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
              </label>
            ))}
            <button type="button" onClick={saveLocalDirectSale} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold" style={{ background: 'var(--erp-violet)', color: '#fff' }}>
              <Plus size={15} />
              Adicionar venda direta
            </button>
          </div>
        </Card>
      </div>

      <Card padding="sm">
        <CardHeader title="Pagamentos recebidos" subtitle="ASAAS" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                {['Cliente', 'Descrição', 'Forma de pagamento', 'Valor', 'Data', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {received.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: i < received.length - 1 ? '1px solid var(--erp-border)' : undefined }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{p.customer ?? '-'}</td>
                  <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: 'var(--erp-text-muted)' }}>{p.description ?? '-'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{p.payment_method ?? '-'}</td>
                  <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: 'var(--erp-emerald)' }}>{currency(p.value, 2)}</td>
                  <td className="px-4 py-3"><span className="flex items-center gap-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}><Calendar size={10} />{formatDate(p.due_date)}</span></td>
                  <td className="px-4 py-3"><span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'rgba(4,120,87,0.12)', color: 'var(--erp-emerald)' }}>Recebido</span></td>
                </tr>
              ))}
              {!loading && received.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhum pagamento recebido no período</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}