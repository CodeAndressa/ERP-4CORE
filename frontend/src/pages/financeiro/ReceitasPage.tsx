import { useCallback, useEffect, useState } from 'react';
import { Calendar, CheckCircle, DollarSign, Link2, Plus, RefreshCw, Trash2, TrendingUp } from 'lucide-react';
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
};

const RECEIVED_STATUSES = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'received', 'confirmed', 'received_in_cash']);
const today = new Date().toISOString().slice(0, 10);
const emptyDirectSale: DirectSaleDraft = { date: today, customer: '', description: '', value: '', contract_total: '' };

function parseMoney(value: string) {
  const parsed = Number(value.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function ReceitasPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<FinancePeriod>(DEFAULT_PERIOD);
  const [localDirectSales, setLocalDirectSales] = useState<DirectSale[]>([]);
  const [deletedDirectSaleIds, setDeletedDirectSaleIds] = useState<string[]>([]);
  const [directSaleDraft, setDirectSaleDraft] = useState<DirectSaleDraft>(emptyDirectSale);

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

  const received = (data?.payments ?? []).filter((p) => RECEIVED_STATUSES.has(p.status ?? ''));
  const baseDirectSales = (data?.manual_financial?.direct_sales ?? []).filter((item) => !deletedDirectSaleIds.includes(item.id));
  const directSales = [...baseDirectSales, ...localDirectSales.filter((item) => isInFinancePeriod(item.date, period))].sort((a, b) => a.date.localeCompare(b.date));
  const totalReceived = data?.received_value ?? data?.summary?.total_received ?? received.reduce((sum, item) => sum + item.value, 0);
  const totalDirectSales = directSales.reduce((sum, item) => sum + item.value, 0);
  const unmatchedDirectSales = directSales.filter((item) => !item.matched).reduce((sum, item) => sum + item.value, 0);
  const receivedCount = data?.received_count ?? received.length;
  const avgTicket = receivedCount > 0 ? totalReceived / receivedCount : 0;

  function saveLocalDirectSale() {
    const value = parseMoney(directSaleDraft.value);
    if (value <= 0) return;
    const contractTotal = parseMoney(directSaleDraft.contract_total) || value;
    const date = directSaleDraft.date || today;
    const entry: DirectSale = {
      id: `local-direct-sale-${Date.now()}`,
      month: date.slice(0, 7),
      date,
      customer: directSaleDraft.customer || 'Cliente manual',
      description: directSaleDraft.description || 'Venda direta',
      value,
      contract_total: contractTotal,
      source: 'Manual',
      matched: false,
      asaas_match: null,
    };
    const next = [...localDirectSales, entry];
    setLocalDirectSales(next);
    localStorage.setItem(LOCAL_DIRECT_SALES_KEY, JSON.stringify(next));
    setDirectSaleDraft(emptyDirectSale);
  }

  function removeDirectSale(item: DirectSale) {
    if (item.id.startsWith('local-direct-sale-')) {
      const next = localDirectSales.filter((entry) => entry.id !== item.id);
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
          <button onClick={() => load(true)} className="flex h-11 items-center justify-center gap-1.5 rounded-full border border-violet-100 bg-white px-4 text-xs font-bold text-slate-600 transition hover:border-violet-200 hover:text-violet-700">
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
                  {['Competência', 'Cliente', 'Descrição', 'Parcela', 'Total contrato', 'Origem', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {directSales.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: i < directSales.length - 1 ? '1px solid var(--erp-border)' : undefined }}>
                    <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--erp-text-muted)' }}>{item.month}</td>
                    <td className="px-4 py-3 font-medium max-w-xs" style={{ color: 'var(--erp-text)' }}>{item.customer}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{item.description}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums" style={{ color: '#34d399' }}>{currency(item.value, 2)}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--erp-text-muted)' }}>{currency(item.contract_total, 2)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: item.matched ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.12)', color: item.matched ? '#34d399' : '#b45309' }}>
                        {item.id.startsWith('local-direct-sale-') ? 'Manual' : item.matched ? 'Conciliado' : 'Base manual'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => removeDirectSale(item)} className="inline-flex h-8 w-8 items-center justify-center rounded-full" style={{ border: '1px solid var(--erp-border)', color: '#ef4444', background: '#fff' }} aria-label="Remover venda direta">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && directSales.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhuma venda direta cadastrada no período</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader title="Nova venda direta" subtitle="Cadastro manual" />
          <div className="space-y-3">
            {[
              ['date', 'Data', 'date'],
              ['customer', 'Cliente', 'text'],
              ['description', 'Descrição', 'text'],
              ['value', 'Valor da parcela', 'text'],
              ['contract_total', 'Total do contrato', 'text'],
            ].map(([key, label, type]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>{label}</span>
                <input type={type} value={directSaleDraft[key as keyof DirectSaleDraft]} onChange={(event) => setDirectSaleDraft((current) => ({ ...current, [key]: event.target.value }))} className="h-10 w-full rounded-xl px-3 text-sm outline-none" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
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
                {['Cliente', 'Descrição', 'Valor', 'Data', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {received.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: i < received.length - 1 ? '1px solid var(--erp-border)' : undefined }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{p.customer ?? '-'}</td>
                  <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: 'var(--erp-text-muted)' }}>{p.description ?? '-'}</td>
                  <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: '#34d399' }}>{currency(p.value, 2)}</td>
                  <td className="px-4 py-3"><span className="flex items-center gap-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}><Calendar size={10} />{formatDate(p.due_date)}</span></td>
                  <td className="px-4 py-3"><span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>Recebido</span></td>
                </tr>
              ))}
              {!loading && received.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhum pagamento recebido no período</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}