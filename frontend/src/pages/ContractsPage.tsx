import { useEffect, useState } from 'react';
import { FileSignature, ShoppingBag, Plus, X, AlertTriangle, Calendar, DollarSign } from 'lucide-react';
import { api } from '../services/api';
import { Card } from '../shared/components/ui/Card';
import { MetricCard } from '../shared/components/layout/MetricCard';
import { Badge } from '../shared/components/ui/Badge';

interface Contract {
  id?: number | string;
  client_name?: string;
  client?: string;
  value?: number;
  start_date?: string;
  end_date?: string;
  status?: string;
  description?: string;
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
    : 'â€”';

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

  const [cForm, setCForm] = useState({ client_name: '', value: '', start_date: '', end_date: '', status: 'ativo', description: '' });
  const [oForm, setOForm] = useState({ client_name: '', value: '', closed_at: '', description: '' });

  useEffect(() => {
    api.get<Contract[] | { data: Contract[] }>('/contracts')
      .then(({ data }) => setContracts(Array.isArray(data) ? data : (data as any).data ?? []))
      .catch((e) => setErrorC(e?.response?.data?.detail || 'Erro ao carregar contratos'))
      .finally(() => setLoadingC(false));
    api.get<Order[] | { data: Order[] }>('/orders')
      .then(({ data }) => setOrders(Array.isArray(data) ? data : (data as any).data ?? []))
      .catch((e) => setErrorO(e?.response?.data?.detail || 'Erro ao carregar pedidos'))
      .finally(() => setLoadingO(false));
  }, []);

  async function addContract() {
    if (!cForm.client_name) return;
    try {
      const { data } = await api.post<Contract>('/contracts', { ...cForm, value: Number(cForm.value) || 0 });
      setContracts((prev) => [...prev, data]);
      setShowForm(false);
      setCForm({ client_name: '', value: '', start_date: '', end_date: '', status: 'ativo', description: '' });
    } catch (e: any) {
      setErrorC(e?.response?.data?.detail || 'Erro ao criar contrato');
    }
  }

  async function addOrder() {
    if (!oForm.client_name) return;
    try {
      const { data } = await api.post<Order>('/orders', { ...oForm, value: Number(oForm.value) || 0 });
      setOrders((prev) => [...prev, data]);
      setShowForm(false);
      setOForm({ client_name: '', value: '', closed_at: '', description: '' });
    } catch (e: any) {
      setErrorO(e?.response?.data?.detail || 'Erro ao criar pedido');
    }
  }

  const totalContracts = contracts.reduce((s, c) => s + (c.value ?? 0), 0);
  const activeContracts = contracts.filter((c) => (c.status ?? '').toLowerCase() === 'ativo').length;
  const totalOrders = orders.reduce((s, o) => s + (o.total ?? o.value ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Comercial</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Contratos & Pedidos</h1>
        </div>
        <button onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--erp-violet)', color: '#fff' }}>
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancelar' : tab === 'contratos' ? 'Novo contrato' : 'Novo pedido'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Contratos ativos" value={String(activeContracts)}  detail={`de ${contracts.length} totais`} tone="violet"  icon={<FileSignature size={16} />} />
        <MetricCard label="Valor contratado" value={money(totalContracts)}    detail="soma dos contratos"              tone="emerald" icon={<DollarSign size={16} />}    />
        <MetricCard label="Volume pedidos"   value={money(totalOrders)}       detail={`${orders.length} pedidos`}     tone="amber"   icon={<ShoppingBag size={16} />}   />
      </div>

      <div className="flex items-center gap-1">
        {(['contratos', 'pedidos'] as Tab[]).map((t) => (
          <button key={t} onClick={() => { setTab(t); setShowForm(false); }}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all"
            style={{
              background: tab === t ? 'var(--erp-violet-dim)' : 'transparent',
              color: tab === t ? 'var(--erp-violet-light)' : 'var(--erp-text-muted)',
              border: tab === t ? '1px solid var(--erp-violet)44' : '1px solid transparent',
            }}>
            {t === 'contratos' ? <FileSignature size={13} /> : <ShoppingBag size={13} />}
            {t === 'contratos' ? 'Contratos' : 'Pedidos'}
          </button>
        ))}
      </div>

      {showForm && tab === 'contratos' && (
        <Card padding="lg">
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--erp-text)' }}>Novo contrato</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Cliente',     key: 'client_name', type: 'text',   placeholder: 'Nome do cliente' },
              { label: 'Valor (R$)',  key: 'value',       type: 'number', placeholder: '0'               },
              { label: 'InÃ­cio',      key: 'start_date',  type: 'date',   placeholder: ''                },
              { label: 'Fim',         key: 'end_date',    type: 'date',   placeholder: ''                },
              { label: 'DescriÃ§Ã£o',   key: 'description', type: 'text',   placeholder: 'Opcional'        },
            ].map((f) => (
              <div key={f.key}>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--erp-text-muted)' }}>{f.label}</label>
                <input type={f.type} placeholder={f.placeholder}
                  value={(cForm as any)[f.key]} onChange={(e) => setCForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
              </div>
            ))}
            <div className="flex items-end">
              <button onClick={addContract} className="w-full rounded-xl py-2 text-sm font-medium"
                style={{ background: 'var(--erp-violet)', color: '#fff' }}>Salvar contrato</button>
            </div>
          </div>
        </Card>
      )}

      {showForm && tab === 'pedidos' && (
        <Card padding="lg">
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--erp-text)' }}>Novo pedido</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Cliente',    key: 'client_name', type: 'text',   placeholder: 'Nome do cliente' },
              { label: 'Valor (R$)', key: 'value',       type: 'number', placeholder: '0'               },
              { label: 'Data',       key: 'closed_at',   type: 'date',   placeholder: ''                },
              { label: 'DescriÃ§Ã£o',  key: 'description', type: 'text',   placeholder: 'Opcional'        },
            ].map((f) => (
              <div key={f.key}>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--erp-text-muted)' }}>{f.label}</label>
                <input type={f.type} placeholder={f.placeholder}
                  value={(oForm as any)[f.key]} onChange={(e) => setOForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
              </div>
            ))}
            <div className="flex items-end">
              <button onClick={addOrder} className="w-full rounded-xl py-2 text-sm font-medium"
                style={{ background: 'var(--erp-violet)', color: '#fff' }}>Salvar pedido</button>
            </div>
          </div>
        </Card>
      )}

      {(errorC || errorO) && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
          <AlertTriangle size={14} />
          <span>{errorC || errorO}</span>
        </div>
      )}

      {tab === 'contratos' && (
        <Card padding="sm">
          {loadingC ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                    {['Cliente', 'Valor', 'InÃ­cio', 'Fim', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c, i) => (
                    <tr key={String(c.id ?? i)}
                      style={{ borderBottom: i < contracts.length - 1 ? '1px solid var(--erp-border)' : undefined }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--erp-surface-2)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{c.client_name ?? c.client ?? 'â€”'}</td>
                      <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: 'var(--erp-violet-light)' }}>{money(c.value)}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                        {c.start_date ? <span className="flex items-center gap-1"><Calendar size={10} />{c.start_date}</span> : 'â€”'}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                        {c.end_date ? <span className="flex items-center gap-1"><Calendar size={10} />{c.end_date}</span> : 'â€”'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={c.status?.toLowerCase() === 'ativo' ? 'emerald' : c.status?.toLowerCase() === 'encerrado' ? 'slate' : 'amber'} dot>
                          {c.status ?? 'N/A'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {contracts.length === 0 && (
                    <tr><td colSpan={5} className="py-10 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>
                      Nenhum contrato cadastrado
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'pedidos' && (
        <Card padding="sm">
          {loadingO ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                    {['Cliente', 'Valor', 'Data', 'DescriÃ§Ã£o', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, i) => (
                    <tr key={String(o.id ?? i)}
                      style={{ borderBottom: i < orders.length - 1 ? '1px solid var(--erp-border)' : undefined }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--erp-surface-2)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{o.client_name ?? o.client ?? 'â€”'}</td>
                      <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: 'var(--erp-violet-light)' }}>{money(o.total ?? o.value)}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{o.closed_at ?? o.date ?? o.created_at ?? 'â€”'}</td>
                      <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: 'var(--erp-text-muted)' }}>{o.description ?? o.items ?? 'â€”'}</td>
                      <td className="px-4 py-3">
                        <Badge tone={['entregue','concluido','concluÃ­do'].includes((o.status ?? '').toLowerCase()) ? 'emerald' : ['cancelado'].includes((o.status ?? '').toLowerCase()) ? 'slate' : 'amber'} dot>
                          {o.status ?? 'Pendente'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr><td colSpan={5} className="py-10 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>
                      Nenhum pedido cadastrado
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
