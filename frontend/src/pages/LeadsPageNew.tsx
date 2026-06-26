import { useState, useEffect } from 'react';
import { Users, Globe, UserPlus, Megaphone, HelpCircle, Search } from 'lucide-react';
import { Card } from '../shared/components/ui/Card';
import { Badge } from '../shared/components/ui/Badge';

type LeadStatus = 'novo' | 'contato' | 'qualificado' | 'perdido';

interface Lead {
  id: string | number;
  name: string;
  company?: string;
  status: LeadStatus;
  value?: number;
  origin?: string;
  created_at?: string;
}

const STATUS_LABELS: Record<LeadStatus, string> = {
  novo:        'Novo',
  contato:     'Contato',
  qualificado: 'Qualificado',
  perdido:     'Perdido',
};

const STATUS_TONE: Record<LeadStatus, 'cyan' | 'violet' | 'emerald' | 'slate'> = {
  novo:        'cyan',
  contato:     'violet',
  qualificado: 'emerald',
  perdido:     'slate',
};

const FILTER_TABS: { id: 'all' | LeadStatus; label: string }[] = [
  { id: 'all',        label: 'Todos'       },
  { id: 'novo',       label: 'Novos'       },
  { id: 'contato',    label: 'Em Contato'  },
  { id: 'qualificado',label: 'Qualificados'},
  { id: 'perdido',    label: 'Perdidos'    },
];

const ORIGIN_ICONS: Record<string, React.ReactNode> = {
  Instagram:  <Users     size={13} className="text-pink-400"   />,
  Site:       <Globe     size={13} className="text-blue-400"   />,
  Indicação:  <UserPlus  size={13} className="text-violet-400" />,
  Marketing:  <Megaphone size={13} className="text-amber-400"  />,
};

function fmt(value: number) {
  return 'R$ ' + value.toLocaleString('pt-BR');
}

function OriginIcon({ origin }: { origin?: string }) {
  if (!origin) return <HelpCircle size={13} style={{ color: 'var(--erp-text-dim)' }} />;
  return <>{ORIGIN_ICONS[origin] ?? <HelpCircle size={13} style={{ color: 'var(--erp-text-dim)' }} />}</>;
}

function normalizeStatus(raw: string): LeadStatus {
  const map: Record<string, LeadStatus> = {
    'Novo lead': 'novo',
    'novo': 'novo',
    'QualificaÃ§Ã£o': 'qualificado',
    'qualificado': 'qualificado',
    'DiagnÃ³stico': 'contato',
    'contato': 'contato',
    'Proposta': 'contato',
    'NegociaÃ§Ã£o': 'contato',
    'perdido': 'perdido',
  };
  return map[raw] ?? 'novo';
}

function EmptyLeads({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{ background: 'var(--erp-violet-dim)' }}
      >
        <Users size={22} style={{ color: 'var(--erp-violet-light)' }} />
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--erp-text)' }}>
        {filtered ? 'Nenhum lead nesta categoria' : 'Nenhum lead cadastrado'}
      </p>
      <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>
        {filtered ? 'Tente outro filtro.' : 'Os leads aparecerÃ£o aqui quando forem registrados.'}
      </p>
    </div>
  );
}

export function LeadsPageNew() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | LeadStatus>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch('/leads')
      .then((r) => r.json())
      .then((data) => {
        const raw: Record<string, unknown>[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.leads)
          ? data.leads
          : [];
        const normalized: Lead[] = raw.map((item, i) => ({
          id:         String(item.id ?? i),
          name:       (item.name as string) ?? (item.nome as string) ?? 'â€”',
          company:    (item.company as string) ?? (item.empresa as string) ?? undefined,
          status:     normalizeStatus((item.status as string) ?? (item.stage as string) ?? 'novo'),
          value:      (item.value as number) ?? (item.valor as number) ?? undefined,
          origin:     (item.origin as string) ?? (item.source_channel as string) ?? undefined,
          created_at: (item.created_at as string) ?? undefined,
        }));
        setLeads(normalized);
      })
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = leads.filter((l) => {
    const matchFilter = activeFilter === 'all' || l.status === activeFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      l.name.toLowerCase().includes(q) ||
      (l.company ?? '').toLowerCase().includes(q) ||
      (l.origin ?? '').toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const counts: Record<string, number> = { all: leads.length };
  for (const l of leads) {
    counts[l.status] = (counts[l.status] ?? 0) + 1;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>
            Comercial
          </p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>
            Leads
          </h1>
        </div>
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)', minWidth: 220 }}
        >
          <Search size={14} style={{ color: 'var(--erp-text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar leadâ€¦"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-inherit"
            style={{ color: 'var(--erp-text)', caretColor: 'var(--erp-violet)' }}
          />
        </div>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {FILTER_TABS.map((tab) => {
          const active = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150"
              style={{
                background: active ? 'var(--erp-violet-dim)' : 'transparent',
                color: active ? 'var(--erp-violet-light)' : 'var(--erp-text-muted)',
                border: active ? '1px solid var(--erp-violet)44' : '1px solid transparent',
              }}
            >
              {tab.label}
              {counts[tab.id] != null && (
                <span
                  className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                  style={{
                    background: active ? 'var(--erp-violet)33' : 'var(--erp-surface)',
                    color: active ? 'var(--erp-violet-light)' : 'var(--erp-text-dim)',
                  }}
                >
                  {counts[tab.id]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Card padding="sm" className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12">
            <div
              className="h-4 w-4 animate-spin rounded-full border-2"
              style={{ borderColor: 'var(--erp-border)', borderTopColor: 'var(--erp-violet)' }}
            />
            <span className="text-sm" style={{ color: 'var(--erp-text-muted)' }}>Carregando leadsâ€¦</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyLeads filtered={activeFilter !== 'all' || search !== ''} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                  {['Nome', 'Empresa', 'Status', 'Valor potencial', 'Origem', 'Data'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--erp-text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead, i) => (
                  <tr
                    key={lead.id}
                    className="transition-colors duration-100"
                    style={{
                      borderBottom: i < filtered.length - 1 ? '1px solid var(--erp-border)' : undefined,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--erp-surface-2)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium" style={{ color: 'var(--erp-text)' }}>
                        {lead.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span style={{ color: 'var(--erp-text-muted)' }}>
                        {lead.company ?? 'â€”'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[lead.status]} dot>
                        {STATUS_LABELS[lead.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span style={{ color: lead.value ? 'var(--erp-violet-light)' : 'var(--erp-text-dim)' }}>
                        {lead.value ? fmt(lead.value) : 'â€”'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <OriginIcon origin={lead.origin} />
                        <span style={{ color: 'var(--erp-text-muted)' }}>{lead.origin ?? 'â€”'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span style={{ color: 'var(--erp-text-dim)' }}>
                        {lead.created_at
                          ? new Date(lead.created_at).toLocaleDateString('pt-BR')
                          : 'â€”'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default LeadsPageNew;
