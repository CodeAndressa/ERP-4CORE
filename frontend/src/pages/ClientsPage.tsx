import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, CheckCircle, FileText, Mail, Phone, Search, Trash2, Upload, Users } from 'lucide-react';
import { api } from '../services/api';
import { Card } from '../shared/components/ui/Card';
import { MetricCard } from '../shared/components/layout/MetricCard';

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  created_at?: string;
}

interface Contract {
  id: number | string;
  client_name: string;
  asaas_customer_id?: string;
  title?: string;
  file_name?: string;
  created_at?: string;
}

function clientKey(client: Client) {
  return `asaas:${client.id}`;
}

function legacyClientKey(name?: string) {
  return `name:${(name ?? '').trim().toLowerCase()}`;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');

  function loadContracts() {
    return api.get<Contract[] | { data?: Contract[] }>('/contracts')
      .then(({ data }) => setContracts(Array.isArray(data) ? data : data.data ?? []));
  }

  useEffect(() => {
    Promise.allSettled([
      api.get<{ data?: Client[] } | Client[]>('/clients'),
      loadContracts(),
    ])
      .then(([clientResult]) => {
        if (clientResult.status === 'fulfilled') {
          const payload = clientResult.value.data;
          setClients(Array.isArray(payload) ? payload : payload.data ?? []);
        } else {
          setError(clientResult.reason?.response?.data?.detail || 'Falha ao carregar clientes');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const contractsByClient = useMemo(() => {
    const map = new Map<string, Contract[]>();
    contracts.forEach((contract) => {
      const keys = [
        contract.asaas_customer_id ? `asaas:${contract.asaas_customer_id}` : '',
        legacyClientKey(contract.client_name),
      ].filter(Boolean);
      keys.forEach((key) => map.set(key, [...(map.get(key) ?? []), contract]));
    });
    return map;
  }, [contracts]);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q);
  });

  async function uploadContract(client: Client, file?: File) {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Envie apenas contratos em PDF.');
      return;
    }

    setUploading(client.id);
    setError('');
    setSuccess('');
    const form = new FormData();
    form.append('client_name', client.name);
    form.append('asaas_customer_id', client.id);
    form.append('title', `Contrato - ${client.name}`);
    form.append('status', 'ativo');
    form.append('file', file);

    try {
      await api.post('/contracts', form);
      await loadContracts();
      setSuccess(`Contrato vinculado a ${client.name}.`);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Erro ao vincular contrato ao cliente');
    } finally {
      setUploading(null);
    }
  }

  async function openContractFile(contractId: number | string) {
    try {
      const { data } = await api.get(`/contracts/${contractId}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Não foi possível abrir o contrato');
    }
  }

  async function removeClient(client: Client) {
    const confirmation = window.prompt(`Para remover ${client.name} do ASAAS, digite REMOVER`);
    if (confirmation !== 'REMOVER') return;

    setRemoving(client.id);
    setError('');
    setSuccess('');
    try {
      await api.delete(`/clients/${client.id}`);
      setClients((prev) => prev.filter((item) => item.id !== client.id));
      setSuccess(`${client.name} removido do ASAAS.`);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Erro ao remover cliente no ASAAS');
    } finally {
      setRemoving(null);
    }
  }

  const clientsWithContracts = clients.filter((client) => {
    const byId = contractsByClient.get(clientKey(client)) ?? [];
    const byName = contractsByClient.get(legacyClientKey(client.name)) ?? [];
    return byId.length > 0 || byName.length > 0;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--erp-violet-light)' }}>Comercial · ASAAS</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Clientes</h1>
        </div>
        <div className="flex min-w-[220px] items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}>
          <Search size={13} style={{ color: 'var(--erp-text-muted)' }} />
          <input type="text" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" style={{ color: 'var(--erp-text)' }} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Clientes" value={loading ? '...' : String(clients.length)} detail="sincronizados · ASAAS" tone="violet" icon={<Users size={16} />} />
        <MetricCard label="Com contrato" value={loading ? '...' : String(clientsWithContracts)} detail="PDF vinculado" tone="emerald" icon={<FileText size={16} />} />
        <MetricCard label="Sem contrato" value={loading ? '...' : String(clients.length - clientsWithContracts)} detail="ainda sem PDF vinculado" tone="cyan" icon={<Building2 size={16} />} />
      </div>

      {(error || success) && (
        <div className="flex items-center gap-3 rounded-[22px] px-4 py-3 text-sm" style={{ background: error ? 'rgba(190,18,60,0.08)' : 'rgba(4,120,87,0.08)', border: `1px solid ${error ? 'rgba(190,18,60,0.24)' : 'rgba(4,120,87,0.24)'}`, color: error ? 'var(--erp-rose)' : 'var(--erp-emerald)' }}>
          {error ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
          <span>{error || success}</span>
        </div>
      )}

      <Card padding="sm">
        {loading ? (
          <div className="space-y-2 p-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded-full" style={{ background: 'var(--erp-surface-2)' }} />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                  {['Cliente', 'E-mail', 'Telefone', 'Cadastro', 'Contrato', 'Origem', 'Ações'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((client, i) => {
                  const linked = contractsByClient.get(clientKey(client)) ?? contractsByClient.get(legacyClientKey(client.name)) ?? [];
                  const latest = linked[0];
                  return (
                    <tr key={client.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--erp-border)' : undefined }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--erp-violet-dim)' }}><Building2 size={13} style={{ color: 'var(--erp-violet-light)' }} /></div>
                          <span className="font-medium" style={{ color: 'var(--erp-text)' }}>{client.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{client.email ? <div className="flex items-center gap-1.5"><Mail size={11} style={{ color: 'var(--erp-text-dim)' }} /><span style={{ color: 'var(--erp-text-muted)' }}>{client.email}</span></div> : <span style={{ color: 'var(--erp-text-dim)' }}>-</span>}</td>
                      <td className="px-4 py-3">{client.phone ? <div className="flex items-center gap-1.5"><Phone size={11} style={{ color: 'var(--erp-text-dim)' }} /><span style={{ color: 'var(--erp-text-muted)' }}>{client.phone}</span></div> : <span style={{ color: 'var(--erp-text-dim)' }}>-</span>}</td>
                      <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--erp-text-muted)' }}>{client.created_at ? new Date(client.created_at).toLocaleDateString('pt-BR') : '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {latest?.file_name && <button onClick={() => openContractFile(latest.id)} className="rounded-xl px-3 py-1 text-xs font-medium transition-colors" style={{ border: '1px solid var(--erp-border)', color: 'var(--erp-violet-light)' }}>Ver PDF</button>}
                          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-semibold text-white" style={{ background: 'var(--erp-violet)' }}>
                            <Upload size={12} />
                            {uploading === client.id ? 'Enviando...' : linked.length ? 'Substituir' : 'Anexar PDF'}
                            <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={uploading === client.id} onChange={(event) => uploadContract(client, event.target.files?.[0])} />
                          </label>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'var(--erp-violet-soft)', color: 'var(--erp-violet-light)' }}>ASAAS</span></td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeClient(client)}
                          disabled={removing === client.id}
                          className="inline-flex items-center gap-1 rounded-xl px-3 py-1 text-xs font-medium transition disabled:cursor-wait disabled:opacity-60"
                          style={{ border: '1px solid rgba(190,18,60,0.24)', color: 'var(--erp-rose)' }}
                          onMouseEnter={(e) => { if (removing !== client.id) e.currentTarget.style.background = 'rgba(190,18,60,0.08)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          title="Remover cliente no ASAAS"
                        >
                          <Trash2 size={11} />
                          {removing === client.id ? 'Removendo...' : 'Remover'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhum cliente encontrado</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
