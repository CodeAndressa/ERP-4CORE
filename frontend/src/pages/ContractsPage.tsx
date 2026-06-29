import { useEffect, useState } from 'react';
import { AlertTriangle, Calendar, DollarSign, ExternalLink, FileSignature, Plus, ShoppingBag, Upload, X } from 'lucide-react';
import { api } from '../services/api';
import { Card } from '../shared/components/ui/Card';
import { MetricCard } from '../shared/components/layout/MetricCard';
import { Badge } from '../shared/components/ui/Badge';

interface Contract {
  id?: number | string;
  client_name?: string;
  client?: string;
  title?: string;
  value?: number;
  start_date?: string;
  end_date?: string;
  status?: string;
  notes?: string;
  description?: string;
  file_name?: string;
  created_at?: string;
}

interface Order {
  id?: number | string;
  client_name?: string;
  client?: string;
  total?: number;
  value?: number;
  date?: string;
  created_at?: string;
  closed_at?: string;
  status?: string;
  description?: string;
  items?: string;
}

const money = (v?: number) =>
  v != null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
    : '-';

type Tab = 'contratos' | 'pedidos';

export default function ContractsPage() {
  const [tab, setTab] = useState<Tab>('contratos');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingC, setLoadingC] = useState(true);
  const [loadingO, setLoadingO] = useState(true);
  const [errorC, setErrorC] = useState('');
  const [errorO, setErrorO] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const [cForm, setCForm] = useState({ client_name: '', title: '', value: '', start_date: '', end_date: '', status: 'ativo', notes: '' });
  const [oForm, setOForm] = useState({ client_name: '', value: '', closed_at: '', description: '' });

  function loadContracts() {
    setLoadingC(true);
    return api.get<Contract[] | { data: Contract[] }>('/contracts')
      .then(({ data }) => setContracts(Array.isArray(data) ? data : data.data ?? []))
      .catch((e) => setErrorC(e?.response?.data?.detail || 'Erro ao carregar contratos'))
      .finally(() => setLoadingC(false));
  }

  useEffect(() => {
    loadContracts();
    api.get<Order[] | { data: Order[] }>('/orders')
      .then(({ data }) => setOrders(Array.isArray(data) ? data : data.data ?? []))
      .catch((e) => setErrorO(e?.response?.data?.detail || 'Erro ao carregar pedidos'))
      .finally(() => setLoadingO(false));
  }, []);

  async function addContract() {
    if (!cForm.client_name) return;
    if (file && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorC('Envie apenas arquivos PDF.');
      return;
    }

    try {
      const form = new FormData();
      form.append('client_name', cForm.client_name);
      form.append('title', cForm.title || `Contrato - ${cForm.client_name}`);
      form.append('status', cForm.status);
      if (cForm.value) form.append('value', String(Number(cForm.value) || 0));
      if (cForm.start_date) form.append('start_date', cForm.start_date);
      if (cForm.end_date) form.append('end_date', cForm.end_date);
      if (cForm.notes) form.append('notes', cForm.notes);
      if (file) form.append('file', file);

      const { data } = await api.post<Contract>('/contracts', form);
      setContracts((prev) => [data, ...prev]);
      setShowForm(false);
      setFile(null);
      setCForm({ client_name: '', title: '', value: '', start_date: '', end_date: '', status: 'ativo', notes: '' });
    } catch (e: any) {
      setErrorC(e?.response?.data?.detail || 'Erro ao criar contrato');
    }
  }

  async function addOrder() {
    if (!oForm.client_name) return;
    try {
      const { data } = await api.post<Order>('/orders', { ...oForm, description: oForm.description || 'Pedido comercial', value: Number(oForm.value) || 0 });
      setOrders((prev) => [data, ...prev]);
      setShowForm(false);
      setOForm({ client_name: '', value: '', closed_at: '', description: '' });
    } catch (e: any) {
      setErrorO(e?.response?.data?.detail || 'Erro ao criar pedido');
    }
  }

  async function openContractFile(contractId?: number | string) {
    if (!contractId) return;
    try {
      const { data } = await api.get(`/contracts/${contractId}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      setErrorC(e?.response?.data?.detail || 'N?o foi poss?vel abrir o contrato');
    }
  }

  const totalContracts = contracts.reduce((s, c) => s + (c.value ?? 0), 0);
  const activeContracts = contracts.filter((c) => (c.status ?? '').toLowerCase() === 'ativo').length;
  const contractsWithFile = contracts.filter((c) => c.file_name).length;
  const totalOrders = orders.reduce((s, o) => s + (o.total ?? o.value ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--erp-violet-light)' }}>Comercial</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Contratos & Pedidos</h1>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium" style={{ background: 'var(--erp-violet)', color: '#fff' }}>
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancelar' : tab === 'contratos' ? 'Novo contrato' : 'Novo pedido'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Contratos ativos" value={String(activeContracts)} detail={`de ${contracts.length} totais`} tone="violet" icon={<FileSignature size={16} />} />
        <MetricCard label="PDFs anexados" value={String(contractsWithFile)} detail="contratos com arquivo" tone="cyan" icon={<Upload size={16} />} />
        <MetricCard label="Valor contratado" value={money(totalContracts)} detail="soma dos contratos" tone="emerald" icon={<DollarSign size={16} />} />
        <MetricCard label="Volume pedidos" value={money(totalOrders)} detail={`${orders.length} pedidos`} tone="amber" icon={<ShoppingBag size={16} />} />
      </div>

      <div className="inline-flex items-center gap-1 rounded-full border border-violet-100 bg-white p-1">
        {(['contratos', 'pedidos'] as Tab[]).map((t) => (
          <button key={t} onClick={() => { setTab(t); setShowForm(false); }} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all" style={{ background: tab === t ? 'var(--erp-violet)' : 'transparent', color: tab === t ? '#fff' : 'var(--erp-text-muted)' }}>
            {t === 'contratos' ? <FileSignature size={13} /> : <ShoppingBag size={13} />}
            {t === 'contratos' ? 'Contratos' : 'Pedidos'}
          </button>
        ))}
      </div>

      {showForm && tab === 'contratos' && (
        <Card padding="lg">
          <p className="mb-4 text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Novo contrato</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Cliente', key: 'client_name', type: 'text', placeholder: 'Nome do cliente' },
              { label: 'T?tulo', key: 'title', type: 'text', placeholder: 'Contrato principal' },
              { label: 'Valor (R$)', key: 'value', type: 'number', placeholder: '0' },
              { label: 'In?cio', key: 'start_date', type: 'date', placeholder: '' },
              { label: 'Fim', key: 'end_date', type: 'date', placeholder: '' },
              { label: 'Observa??es', key: 'notes', type: 'text', placeholder: 'Opcional' },
            ].map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>{f.label}</label>
                <input type={f.type} placeholder={f.placeholder} value={(cForm as any)[f.key]} onChange={(e) => setCForm((p) => ({ ...p, [f.key]: e.target.value }))} className="w-full rounded-full px-3 py-2 text-sm outline-none" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>PDF do contrato</label>
              <input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="w-full rounded-full px-3 py-2 text-sm" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
            </div>
            <div className="flex items-end">
              <button onClick={addContract} className="w-full rounded-full py-2 text-sm font-medium" style={{ background: 'var(--erp-violet)', color: '#fff' }}>Salvar contrato</button>
            </div>
          </div>
        </Card>
      )}

      {showForm && tab === 'pedidos' && (
        <Card padding="lg">
          <p className="mb-4 text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Novo pedido</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Cliente', key: 'client_name', type: 'text', placeholder: 'Nome do cliente' },
              { label: 'Valor (R$)', key: 'value', type: 'number', placeholder: '0' },
              { label: 'Data', key: 'closed_at', type: 'date', placeholder: '' },
              { label: 'Descri??o', key: 'description', type: 'text', placeholder: 'Opcional' },
            ].map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>{f.label}</label>
                <input type={f.type} placeholder={f.placeholder} value={(oForm as any)[f.key]} onChange={(e) => setOForm((p) => ({ ...p, [f.key]: e.target.value }))} className="w-full rounded-full px-3 py-2 text-sm outline-none" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
              </div>
            ))}
            <div className="flex items-end"><button onClick={addOrder} className="w-full rounded-full py-2 text-sm font-medium" style={{ background: 'var(--erp-violet)', color: '#fff' }}>Salvar pedido</button></div>
          </div>
        </Card>
      )}

      {(errorC || errorO) && <div className="flex items-center gap-3 rounded-[22px] bg-rose-50 px-4 py-3 text-sm text-rose-700"><AlertTriangle size={14} /><span>{errorC || errorO}</span></div>}

      {tab === 'contratos' && (
        <Card padding="sm">
          {loadingC ? <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-full" style={{ background: 'var(--erp-surface-2)' }} />)}</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr style={{ borderBottom: '1px solid var(--erp-border)' }}>{['Cliente', 'Contrato', 'Valor', 'In?cio', 'Fim', 'Arquivo', 'Status'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-muted)' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {contracts.map((c, i) => (
                    <tr key={String(c.id ?? i)} style={{ borderBottom: i < contracts.length - 1 ? '1px solid var(--erp-border)' : undefined }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{c.client_name ?? c.client ?? '-'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{c.title ?? c.description ?? 'Contrato'}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums" style={{ color: 'var(--erp-violet-light)' }}>{money(c.value)}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{c.start_date ? <span className="flex items-center gap-1"><Calendar size={10} />{c.start_date}</span> : '-'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{c.end_date ? <span className="flex items-center gap-1"><Calendar size={10} />{c.end_date}</span> : '-'}</td>
                      <td className="px-4 py-3">{c.file_name ? <button onClick={() => openContractFile(c.id)} className="inline-flex items-center gap-1 rounded-full border border-violet-100 px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50"><ExternalLink size={11} />Abrir PDF</button> : <span className="text-xs" style={{ color: 'var(--erp-text-dim)' }}>Sem arquivo</span>}</td>
                      <td className="px-4 py-3"><Badge tone={c.status?.toLowerCase() === 'ativo' ? 'emerald' : c.status?.toLowerCase() === 'encerrado' ? 'slate' : 'amber'} dot>{c.status ?? 'N/A'}</Badge></td>
                    </tr>
                  ))}
                  {contracts.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhum contrato cadastrado</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'pedidos' && (
        <Card padding="sm">
          {loadingO ? <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-full" style={{ background: 'var(--erp-surface-2)' }} />)}</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr style={{ borderBottom: '1px solid var(--erp-border)' }}>{['Cliente', 'Valor', 'Data', 'Descri??o', 'Status'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-muted)' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {orders.map((o, i) => <tr key={String(o.id ?? i)} style={{ borderBottom: i < orders.length - 1 ? '1px solid var(--erp-border)' : undefined }}><td className="px-4 py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{o.client_name ?? o.client ?? '-'}</td><td className="px-4 py-3 font-semibold tabular-nums" style={{ color: 'var(--erp-violet-light)' }}>{money(o.total ?? o.value)}</td><td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{o.closed_at ?? o.date ?? o.created_at ?? '-'}</td><td className="max-w-xs truncate px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{o.description ?? o.items ?? '-'}</td><td className="px-4 py-3"><Badge tone={['entregue', 'concluido', 'conclu?do'].includes((o.status ?? '').toLowerCase()) ? 'emerald' : ['cancelado'].includes((o.status ?? '').toLowerCase()) ? 'slate' : 'amber'} dot>{o.status ?? 'Pendente'}</Badge></td></tr>)}
                  {orders.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhum pedido cadastrado</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
