import { useEffect, useState } from 'react';
import { Building2, Mail, Phone, Search, AlertTriangle, Users } from 'lucide-react';
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

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get<{ data?: Client[] } | Client[]>('/clients')
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : (data as any)?.data ?? [];
        setClients(list);
      })
      .catch((e) => setError(e?.response?.data?.detail || 'Falha ao conectar ao ASAAS'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Comercial Â· ASAAS</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Clientes</h1>
        </div>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)', minWidth: 220 }}>
          <Search size={13} style={{ color: 'var(--erp-text-muted)' }} />
          <input
            type="text" placeholder="Buscar clienteâ€¦" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--erp-text)' }}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Clientes"    value={loading ? 'â€¦' : String(clients.length)} detail="sincronizados Â· ASAAS" tone="violet" icon={<Users size={16} />} />
        <MetricCard label="Fonte"       value="ASAAS" detail="dados em tempo real" tone="emerald" icon={<Building2 size={16} />} />
        <MetricCard label="ExportaÃ§Ã£o"  value="â€”" detail="Aguarda mapeamento" tone="amber" />
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      <Card padding="sm">
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                  {['Cliente', 'E-mail', 'Telefone', 'Cadastro', 'Origem'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id}
                    style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--erp-border)' : undefined }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--erp-surface-2)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                          style={{ background: 'var(--erp-violet-dim)' }}>
                          <Building2 size={12} style={{ color: 'var(--erp-violet-light)' }} />
                        </div>
                        <span className="font-medium" style={{ color: 'var(--erp-text)' }}>{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.email
                        ? <div className="flex items-center gap-1.5"><Mail size={11} style={{ color: 'var(--erp-text-dim)' }} /><span style={{ color: 'var(--erp-text-muted)' }}>{c.email}</span></div>
                        : <span style={{ color: 'var(--erp-text-dim)' }}>â€”</span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.phone
                        ? <div className="flex items-center gap-1.5"><Phone size={11} style={{ color: 'var(--erp-text-dim)' }} /><span style={{ color: 'var(--erp-text-muted)' }}>{c.phone}</span></div>
                        : <span style={{ color: 'var(--erp-text-dim)' }}>â€”</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                      {c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : 'â€”'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                        ASAAS
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="py-12 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>
                    Nenhum cliente encontrado
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
