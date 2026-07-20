import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, DollarSign, FileText, Plus, Save, Search, X } from 'lucide-react';
import { api } from '../services/api';
import { Card } from '../shared/components/ui/Card';
import { MetricCard } from '../shared/components/layout/MetricCard';
import { Badge } from '../shared/components/ui/Badge';

type ProposalStatus = 'enviada' | 'elaboracao' | 'aprovada' | 'perdida';

interface Proposal {
  id: number;
  code: string;
  client: string;
  value_total: number;
  status: ProposalStatus;
  next_action?: string | null;
  lead_id?: number | null;
}

interface LeadOption {
  id: number;
  name: string;
  company?: string | null;
  email?: string | null;
  value_potential?: number | null;
  stage?: string | null;
}

const STATUS_TONE: Record<ProposalStatus, 'amber' | 'violet' | 'emerald' | 'slate'> = {
  enviada: 'amber',
  elaboracao: 'violet',
  aprovada: 'emerald',
  perdida: 'slate',
};

const STATUS_LABELS: Record<ProposalStatus, string> = {
  enviada: 'Enviada',
  elaboracao: 'Em elaboração',
  aprovada: 'Aprovada',
  perdida: 'Perdida',
};

const PROPOSAL_ACTIONS = [
  'Enviar proposta ao cliente',
  'Aguardar retorno',
  'Fazer follow-up',
  'Agendar reunião de negociação',
  'Enviar revisão da proposta',
  'Solicitar aprovação final',
  'Encerrar proposta',
] as const;

const TABS: { id: ProposalStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'elaboracao', label: 'Em elaboração' },
  { id: 'enviada', label: 'Enviadas' },
  { id: 'aprovada', label: 'Aprovadas' },
  { id: 'perdida', label: 'Perdidas' },
];

const initialForm = { lead_id: '', client: '', value_total: '', status: 'elaboracao' as ProposalStatus, next_action: '' };
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

function parseMoneyInput(value: string) {
  if (!value.trim()) return 0;
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoneyInput(value?: number | null) {
  if (!value) return '';
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function normalizeProposal(item: Record<string, unknown>): Proposal {
  return {
    id: Number(item.id),
    code: String(item.code ?? item.id ?? ''),
    client: String(item.client ?? ''),
    value_total: Number(item.value_total ?? 0),
    status: ((item.status as string) || 'elaboracao') as ProposalStatus,
    next_action: (item.next_action as string) ?? null,
    lead_id: item.lead_id ? Number(item.lead_id) : null,
  };
}

function leadLabel(lead: LeadOption) {
  return lead.company ? `${lead.company} - ${lead.name}` : lead.name;
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<ProposalStatus | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [leadSearch, setLeadSearch] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [proposalResponse, leadResponse] = await Promise.all([api.get('/proposals'), api.get('/leads')]);
      setProposals((Array.isArray(proposalResponse.data) ? proposalResponse.data : []).map(normalizeProposal));
      setLeads(Array.isArray(leadResponse.data) ? leadResponse.data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedLead = leads.find((lead) => String(lead.id) === form.lead_id) ?? null;
  const availableLeads = useMemo(() => {
    const query = leadSearch.trim().toLowerCase();
    return leads
      .filter((lead) => lead.stage !== 'perdido' && lead.stage !== 'fechado')
      .filter((lead) => !query || lead.name.toLowerCase().includes(query) || (lead.company ?? '').toLowerCase().includes(query) || (lead.email ?? '').toLowerCase().includes(query))
      .slice(0, 8);
  }, [leads, leadSearch]);

  function chooseLead(lead: LeadOption) {
    setForm((prev) => ({
      ...prev,
      lead_id: String(lead.id),
      client: lead.company || lead.name,
      value_total: formatMoneyInput(lead.value_potential),
    }));
    setLeadSearch(leadLabel(lead));
  }

  async function addProposal(event: FormEvent) {
    event.preventDefault();
    if (!form.client.trim()) return;
    setSaving(true);
    try {
      const payload = {
        client: form.client.trim(),
        lead_id: form.lead_id ? Number(form.lead_id) : null,
        value_total: parseMoneyInput(form.value_total),
        status: form.status,
        next_action: form.next_action || null,
      };
      const { data } = await api.post('/proposals', payload);
      setProposals((prev) => [normalizeProposal(data), ...prev]);
      setForm(initialForm);
      setLeadSearch('');
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function patchProposal(id: number, patch: Partial<Proposal>) {
    const previous = proposals;
    setProposals((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    try {
      const { data } = await api.patch(`/proposals/${id}`, patch);
      setProposals((prev) => prev.map((item) => (item.id === id ? normalizeProposal(data) : item)));
    } catch {
      setProposals(previous);
    }
  }

  const active = proposals.filter((proposal) => proposal.status !== 'perdida');
  const pipeline = active.reduce((sum, proposal) => sum + proposal.value_total, 0);
  const approved = proposals.filter((proposal) => proposal.status === 'aprovada').length;
  const convRate = proposals.length > 0 ? Math.round((approved / proposals.length) * 100) : 0;
  const filtered = proposals.filter((proposal) => filter === 'all' || proposal.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Comercial</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Propostas</h1>
        </div>
        <button onClick={() => setShowForm((value) => !value)} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium sm:w-auto" style={{ background: showForm ? 'var(--erp-surface)' : 'var(--erp-violet)', color: showForm ? 'var(--erp-text)' : '#fff', border: '1px solid var(--erp-border)' }}>
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancelar' : 'Nova proposta'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard label="Em negociação" value={money(pipeline)} detail={`${active.length} propostas ativas`} tone="violet" icon={<DollarSign size={16} />} />
        <MetricCard label="Conversão" value={`${convRate}%`} detail="aprovadas / total" tone="emerald" icon={<CheckCircle size={16} />} />
        <MetricCard label="Propostas" value={String(proposals.length)} detail="cadastradas manualmente" tone="amber" icon={<Clock size={16} />} />
      </div>

      {showForm && (
        <Card padding="lg">
          <form onSubmit={addProposal} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative sm:col-span-2 lg:col-span-2">
              <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)' }}>
                <Search size={14} style={{ color: 'var(--erp-text-muted)' }} />
                <input placeholder="Pesquisar lead por nome, empresa ou e-mail" value={leadSearch} onChange={(event) => { setLeadSearch(event.target.value); setForm((prev) => ({ ...prev, lead_id: '' })); }} className="min-w-0 flex-1 bg-transparent text-sm outline-none" style={{ color: 'var(--erp-text)' }} />
              </div>
              {leadSearch && !selectedLead && (
                <div className="absolute left-0 right-0 top-12 z-20 max-h-64 overflow-y-auto rounded-xl p-1 shadow-lg" style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}>
                  {availableLeads.length === 0 ? (
                    <div className="px-3 py-2 text-xs" style={{ color: 'var(--erp-text-muted)' }}>Nenhum lead disponível encontrado.</div>
                  ) : availableLeads.map((lead) => (
                    <button key={lead.id} type="button" onClick={() => chooseLead(lead)} className="block w-full rounded-lg px-3 py-2 text-left text-sm" style={{ color: 'var(--erp-text)' }}>
                      <span className="font-medium">{leadLabel(lead)}</span>
                      {lead.email && <span className="block text-xs" style={{ color: 'var(--erp-text-muted)' }}>{lead.email}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input required placeholder="Cliente" value={form.client} onChange={(event) => setForm((prev) => ({ ...prev, client: event.target.value }))} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
            <input placeholder="Valor (ex: 159,99)" inputMode="decimal" value={form.value_total} onChange={(event) => setForm((prev) => ({ ...prev, value_total: event.target.value }))} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
            <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as ProposalStatus }))} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}>
              {Object.entries(STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            <select value={form.next_action} onChange={(event) => setForm((prev) => ({ ...prev, next_action: event.target.value }))} className="rounded-xl px-3 py-2 text-sm outline-none sm:col-span-2 lg:col-span-4" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}>
              <option value="">Próxima ação da proposta</option>
              {PROPOSAL_ACTIONS.map((action) => <option key={action} value={action}>{action}</option>)}
            </select>
            <button disabled={saving} className="flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium disabled:opacity-60" style={{ background: 'var(--erp-violet)', color: '#fff' }}>
              <Save size={14} />
              {saving ? 'Salvando...' : 'Adicionar'}
            </button>
          </form>
        </Card>
      )}

      <div className="flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap">
        {TABS.map((tab) => {
          const activeTab = filter === tab.id;
          return <button key={tab.id} onClick={() => setFilter(tab.id)} className="flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all" style={{ background: activeTab ? 'var(--erp-violet-dim)' : 'transparent', color: activeTab ? 'var(--erp-violet-light)' : 'var(--erp-text-muted)', border: activeTab ? '1px solid var(--erp-violet)44' : '1px solid transparent' }}>{tab.label}</button>;
        })}
      </div>

      <Card padding="sm">
        {loading ? <div className="space-y-2 p-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />)}</div> : filtered.length === 0 ? <div className="py-14 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhuma proposta cadastrada.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: '1px solid var(--erp-border)' }}>{['Proposta', 'Cliente', 'Valor', 'Status', 'Próxima ação'].map((header) => <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-muted)' }}>{header}</th>)}</tr></thead>
              <tbody>{filtered.map((proposal, index) => <tr key={proposal.id} style={{ borderBottom: index < filtered.length - 1 ? '1px solid var(--erp-border)' : undefined }} onMouseEnter={(event) => { event.currentTarget.style.background = 'var(--erp-surface-2)'; }} onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent'; }}><td className="px-4 py-3"><div className="flex items-center gap-2"><FileText size={12} style={{ color: 'var(--erp-text-dim)' }} /><span className="font-mono text-xs" style={{ color: 'var(--erp-text-muted)' }}>#{proposal.code}</span></div></td><td className="px-4 py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{proposal.client}</td><td className="px-4 py-3 font-semibold tabular-nums" style={{ color: 'var(--erp-violet-light)' }}>{money(proposal.value_total)}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><Badge tone={STATUS_TONE[proposal.status]} dot>{STATUS_LABELS[proposal.status]}</Badge><select value={proposal.status} onChange={(event) => void patchProposal(proposal.id, { status: event.target.value as ProposalStatus })} className="rounded-lg px-2 py-1 text-xs outline-none" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}>{Object.entries(STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div></td><td className="px-4 py-3"><select value={proposal.next_action ?? ''} onChange={(event) => void patchProposal(proposal.id, { next_action: event.target.value })} className="w-full min-w-[220px] rounded-lg px-2 py-1 text-xs outline-none" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}><option value="">Definir próxima ação</option>{PROPOSAL_ACTIONS.map((action) => <option key={action} value={action}>{action}</option>)}</select></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
