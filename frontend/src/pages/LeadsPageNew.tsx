import type { FormEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Edit3, Globe, HelpCircle, Mail, Megaphone, Phone, Plus, Save, Search, Trash2, User, UserPlus, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { Card } from '../shared/components/ui/Card';
import { Badge } from '../shared/components/ui/Badge';

interface TeamMember {
  id: number;
  full_name: string;
  email: string;
}

type LeadStatus = 'novo' | 'contato' | 'qualificado' | 'perdido';
type LeadStage = 'novo' | 'contato' | 'qualificado' | 'proposta' | 'negociacao' | 'fechado' | 'perdido';

interface Lead {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  status: LeadStatus;
  stage: LeadStage;
  value_potential?: number | null;
  origin?: string | null;
  notes?: string | null;
  next_action?: string | null;
  last_contact_date?: string | null;
  next_contact_date?: string | null;
  assigned_to_id?: number | null;
  assigned_to_name?: string | null;
  created_at?: string;
}

const STATUS_LABELS: Record<LeadStatus, string> = {
  novo: 'Novo',
  contato: 'Em contato',
  qualificado: 'Qualificado',
  perdido: 'Perdido',
};

const STATUS_TONE: Record<LeadStatus, 'cyan' | 'violet' | 'emerald' | 'slate'> = {
  novo: 'cyan',
  contato: 'violet',
  qualificado: 'emerald',
  perdido: 'slate',
};

const STAGE_LABELS: Record<LeadStage, string> = {
  novo: 'Novo lead',
  contato: 'Em contato',
  qualificado: 'Qualificado',
  proposta: 'Proposta enviada',
  negociacao: 'Em negociação',
  fechado: 'Fechado',
  perdido: 'Perdido',
};

const NEXT_ACTION_OPTIONS = [
  'Ligar para o lead',
  'Enviar e-mail',
  'Enviar WhatsApp',
  'Agendar reunião',
  'Enviar proposta',
  'Fazer follow-up',
  'Aguardar retorno',
] as const;

const ORIGIN_OPTIONS = ['Manual', 'Site', 'Instagram', 'Indicação', 'Marketing'] as const;

const FILTER_TABS: { id: 'all' | LeadStatus; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'novo', label: 'Novos' },
  { id: 'contato', label: 'Em contato' },
  { id: 'qualificado', label: 'Qualificados' },
  { id: 'perdido', label: 'Perdidos' },
];

const ORIGIN_ICONS: Record<string, ReactNode> = {
  Instagram: <Users size={13} className="text-pink-400" />,
  Site: <Globe size={13} className="text-blue-400" />,
  Indicação: <UserPlus size={13} className="text-violet-400" />,
  Marketing: <Megaphone size={13} className="text-amber-400" />,
  Manual: <UserPlus size={13} className="text-emerald-400" />,
};

const initialForm = {
  name: '',
  company: '',
  email: '',
  phone: '',
  status: 'novo' as LeadStatus,
  stage: 'novo' as LeadStage,
  origin: 'Manual',
  value_potential: '',
  next_action: '',
  last_contact_date: '',
  next_contact_date: '',
  notes: '',
  assigned_to_id: '',
};

function inputStyle() {
  return { background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' };
}

function parseMoneyInput(value: string) {
  if (!value.trim()) return 0;
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function dateLabel(value?: string | null) {
  if (!value) return null;
  return new Date(value + 'T12:00:00').toLocaleDateString('pt-BR');
}

function OriginIcon({ origin }: { origin?: string | null }) {
  if (!origin) return <HelpCircle size={13} style={{ color: 'var(--erp-text-dim)' }} />;
  return <>{ORIGIN_ICONS[origin] ?? <HelpCircle size={13} style={{ color: 'var(--erp-text-dim)' }} />}</>;
}

function stageToStatus(stage: LeadStage): LeadStatus {
  if (stage === 'perdido') return 'perdido';
  if (stage === 'qualificado' || stage === 'proposta' || stage === 'negociacao' || stage === 'fechado') return 'qualificado';
  if (stage === 'contato') return 'contato';
  return 'novo';
}

function normalizeStage(value?: string): LeadStage {
  if (value === 'contato' || value === 'qualificado' || value === 'proposta' || value === 'negociacao' || value === 'fechado' || value === 'perdido') return value;
  return 'novo';
}

function normalizeLead(item: Record<string, unknown>): Lead {
  const stage = normalizeStage((item.stage as string) || (item.status as string));
  return {
    id: String(item.id),
    name: String(item.name ?? ''),
    company: (item.company as string) ?? null,
    email: (item.email as string) ?? null,
    phone: (item.phone as string) ?? null,
    status: ((item.status as string) || stageToStatus(stage)) as LeadStatus,
    stage,
    value_potential: Number(item.value_potential ?? 0),
    origin: (item.origin as string) ?? 'Manual',
    notes: (item.notes as string) ?? null,
    next_action: (item.next_action as string) ?? null,
    last_contact_date: (item.last_contact_date as string) ?? null,
    next_contact_date: (item.next_contact_date as string) ?? null,
    assigned_to_id: (item.assigned_to_id as number) ?? null,
    assigned_to_name: (item.assigned_to_name as string) ?? null,
    created_at: (item.created_at as string) ?? undefined,
  };
}

function leadToForm(lead: Lead) {
  return {
    name: lead.name ?? '',
    company: lead.company ?? '',
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    status: lead.status ?? 'novo',
    stage: lead.stage ?? 'novo',
    origin: lead.origin ?? 'Manual',
    value_potential: lead.value_potential ? String(lead.value_potential).replace('.', ',') : '',
    next_action: lead.next_action ?? '',
    last_contact_date: lead.last_contact_date ?? '',
    next_contact_date: lead.next_contact_date ?? '',
    notes: lead.notes ?? '',
    assigned_to_id: lead.assigned_to_id ? String(lead.assigned_to_id) : '',
  };
}

function Field({ label, help, children, className = '' }: { label: string; help: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="text-xs font-semibold" style={{ color: 'var(--erp-text)' }}>{label}</span>
      {children}
      <span className="text-[11px] leading-snug" style={{ color: 'var(--erp-text-muted)' }}>{help}</span>
    </label>
  );
}

function EmptyLeads({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--erp-violet-dim)' }}>
        <Users size={22} style={{ color: 'var(--erp-violet-light)' }} />
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--erp-text)' }}>{filtered ? 'Nenhum lead nesta categoria' : 'Nenhum lead cadastrado'}</p>
      <p className="max-w-xs text-xs" style={{ color: 'var(--erp-text-muted)' }}>{filtered ? 'Tente outro filtro ou revise a busca.' : 'Cadastre leads manualmente para alimentar pipeline, funil, agenda e follow-up.'}</p>
    </div>
  );
}

function LeadMobileCard({ lead, onEdit, onDelete }: { lead: Lead; onEdit: (lead: Lead) => void; onDelete: (id: string) => void }) {
  const nextDate = dateLabel(lead.next_contact_date);

  return (
    <article className="rounded-2xl border bg-white p-4" style={{ borderColor: 'var(--erp-border)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold" style={{ color: 'var(--erp-text)' }}>{lead.name}</h2>
          <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--erp-text-muted)' }}>{lead.company || 'Sem empresa'}</p>
        </div>
        <Badge tone={STATUS_TONE[lead.status]} dot>{STATUS_LABELS[lead.status]}</Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl px-3 py-2" style={{ background: 'var(--erp-surface-2)' }}>
          <p style={{ color: 'var(--erp-text-muted)' }}>Pipeline</p>
          <p className="mt-0.5 font-semibold" style={{ color: 'var(--erp-text)' }}>{STAGE_LABELS[lead.stage] ?? lead.stage}</p>
        </div>
        <div className="rounded-xl px-3 py-2" style={{ background: 'var(--erp-surface-2)' }}>
          <p style={{ color: 'var(--erp-text-muted)' }}>Potencial</p>
          <p className="mt-0.5 font-semibold" style={{ color: lead.value_potential ? 'var(--erp-violet-light)' : 'var(--erp-text-dim)' }}>{lead.value_potential ? money(lead.value_potential) : '-'}</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--erp-border)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-muted)' }}>Próxima ação</p>
        <p className="mt-1 text-sm font-medium" style={{ color: 'var(--erp-text)' }}>{lead.next_action || 'Sem ação definida'}</p>
        {nextDate && <p className="mt-0.5 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{nextDate}</p>}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs" style={{ color: 'var(--erp-text-muted)' }}>
        {lead.email && <span className="inline-flex min-h-8 items-center gap-1 rounded-full px-2.5" style={{ background: 'var(--erp-surface-2)' }}><Mail size={12} />{lead.email}</span>}
        {lead.phone && <span className="inline-flex min-h-8 items-center gap-1 rounded-full px-2.5" style={{ background: 'var(--erp-surface-2)' }}><Phone size={12} />{lead.phone}</span>}
        <span className="inline-flex min-h-8 items-center gap-1 rounded-full px-2.5" style={{ background: 'var(--erp-surface-2)' }}><OriginIcon origin={lead.origin} />{lead.origin ?? '-'}</span>
        <span className="inline-flex min-h-8 items-center gap-1 rounded-full px-2.5" style={{ background: 'var(--erp-surface-2)' }}><User size={12} />{lead.assigned_to_name || 'Sem responsável'}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onEdit(lead)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold" style={{ background: 'var(--erp-violet)', color: '#fff' }}>
          <Edit3 size={15} />Editar
        </button>
        <button type="button" onClick={() => onDelete(lead.id)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold" style={{ border: '1px solid var(--erp-border)', color: '#be123c' }}>
          <Trash2 size={15} />Excluir
        </button>
      </div>
    </article>
  );
}

export function LeadsPageNew() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | LeadStatus>('all');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(initialForm);

  async function loadLeads() {
    setLoading(true);
    try {
      const { data } = await api.get('/leads');
      setLeads((Array.isArray(data) ? data : []).map(normalizeLead));
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadTeam() {
    try {
      const { data } = await api.get('/auth/users');
      setTeam(Array.isArray(data) ? data : []);
    } catch {
      setTeam([]);
    }
  }

  useEffect(() => {
    void loadLeads();
    void loadTeam();
  }, []);

  function updateStage(stage: LeadStage) {
    setForm((prev) => ({ ...prev, stage, status: stageToStatus(stage) }));
  }

  function openCreateForm() {
    setEditingId(null);
    setForm(initialForm);
    setShowForm(true);
  }

  function closeForm() {
    setEditingId(null);
    setForm(initialForm);
    setShowForm(false);
  }

  function editLead(lead: Lead) {
    setEditingId(lead.id);
    setForm(leadToForm(lead));
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveLead(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const assignedMember = team.find((member) => String(member.id) === form.assigned_to_id);
      const payload = {
        ...form,
        name: form.name.trim(),
        company: form.company || null,
        email: form.email || null,
        phone: form.phone || null,
        status: stageToStatus(form.stage),
        value_potential: parseMoneyInput(form.value_potential),
        next_action: form.next_action || null,
        last_contact_date: form.last_contact_date || null,
        next_contact_date: form.next_contact_date || null,
        notes: form.notes || null,
        assigned_to_id: assignedMember ? assignedMember.id : null,
        assigned_to_name: assignedMember ? assignedMember.full_name : null,
      };
      const { data } = editingId ? await api.patch(`/leads/${editingId}`, payload) : await api.post('/leads', payload);
      const saved = normalizeLead(data);
      setLeads((prev) => editingId ? prev.map((lead) => lead.id === editingId ? saved : lead) : [saved, ...prev]);
      toast.success(editingId ? 'Lead atualizado.' : 'Lead cadastrado.');
      closeForm();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Não foi possível salvar o lead. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteLead(id: string) {
    if (!window.confirm('Excluir este lead?')) return;
    await api.delete(`/leads/${id}`);
    setLeads((prev) => prev.filter((lead) => lead.id !== id));
  }

  const filtered = leads.filter((lead) => {
    const matchFilter = activeFilter === 'all' || lead.status === activeFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      lead.name.toLowerCase().includes(q) ||
      (lead.company ?? '').toLowerCase().includes(q) ||
      (lead.origin ?? '').toLowerCase().includes(q) ||
      (lead.email ?? '').toLowerCase().includes(q) ||
      (lead.phone ?? '').toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const counts: Record<string, number> = { all: leads.length };
  for (const lead of leads) counts[lead.status] = (counts[lead.status] ?? 0) + 1;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--erp-violet-light)' }}>Comercial</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Leads</h1>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <div className="flex min-h-11 items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)', minWidth: 0 }}>
            <Search size={14} style={{ color: 'var(--erp-text-muted)' }} />
            <input type="text" placeholder="Buscar lead..." value={search} onChange={(event) => setSearch(event.target.value)} className="flex-1 bg-transparent text-sm outline-none placeholder:text-inherit" style={{ color: 'var(--erp-text)', caretColor: 'var(--erp-violet)' }} />
          </div>
          <button onClick={() => showForm ? closeForm() : openCreateForm()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium" style={{ background: showForm ? 'var(--erp-surface)' : 'var(--erp-violet)', color: showForm ? 'var(--erp-text)' : '#fff', border: '1px solid var(--erp-border)' }}>
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Cancelar' : 'Novo lead'}
          </button>
        </div>
      </div>

      {showForm && (
        <Card padding="lg">
          <form onSubmit={saveLead} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Nome do contato" help="Pessoa principal para falar sobre a oportunidade.">
              <input required placeholder="Ex: Ana Souza" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} className="rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle()} />
            </Field>
            <Field label="Empresa" help="Nome da empresa ou cliente potencial.">
              <input placeholder="Ex: ACME Ltda" value={form.company} onChange={(event) => setForm((prev) => ({ ...prev, company: event.target.value }))} className="rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle()} />
            </Field>
            <Field label="E-mail" help="Canal para propostas, materiais e retorno formal.">
              <input placeholder="contato@empresa.com" type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} className="rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle()} />
            </Field>
            <Field label="Telefone" help="WhatsApp ou telefone para contato direto.">
              <input placeholder="(00) 00000-0000" value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} className="rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle()} />
            </Field>
            <Field label="Etapa do pipeline" help="Onde o lead está no processo comercial.">
              <select value={form.stage} onChange={(event) => updateStage(event.target.value as LeadStage)} className="rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle()}>
                {Object.entries(STAGE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </Field>
            <Field label="Responsável pelo atendimento" help="Quem da equipe está conduzindo esse lead.">
              <select value={form.assigned_to_id} onChange={(event) => setForm((prev) => ({ ...prev, assigned_to_id: event.target.value }))} className="rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle()}>
                <option value="">Sem responsável</option>
                {team.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
              </select>
            </Field>
            <Field label="Origem do lead" help="De onde esse contato veio. Manual é para cadastro feito aqui.">
              <select value={form.origin} onChange={(event) => setForm((prev) => ({ ...prev, origin: event.target.value }))} className="rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle()}>
                {ORIGIN_OPTIONS.map((origin) => <option key={origin} value={origin}>{origin}</option>)}
              </select>
            </Field>
            <Field label="Valor potencial" help="Estimativa de receita se esse lead fechar.">
              <input placeholder="Ex: 159,99" inputMode="decimal" value={form.value_potential} onChange={(event) => setForm((prev) => ({ ...prev, value_potential: event.target.value }))} className="rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle()} />
            </Field>
            <Field label="Próxima ação" help="O próximo passo planejado para mover o lead.">
              <select value={form.next_action} onChange={(event) => setForm((prev) => ({ ...prev, next_action: event.target.value }))} className="rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle()}>
                <option value="">Escolha uma ação</option>
                {NEXT_ACTION_OPTIONS.map((action) => <option key={action} value={action}>{action}</option>)}
              </select>
            </Field>
            <Field label="Último contato" help="Quando você falou com esse lead pela última vez.">
              <input type="date" value={form.last_contact_date} onChange={(event) => setForm((prev) => ({ ...prev, last_contact_date: event.target.value }))} className="rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle()} />
            </Field>
            <Field label="Próximo contato" help="Data que alimenta agenda e follow-up comercial.">
              <input type="date" value={form.next_contact_date} onChange={(event) => setForm((prev) => ({ ...prev, next_contact_date: event.target.value }))} className="rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle()} />
            </Field>
            <Field label="Notas" help="Contexto da conversa, dores, combinados e observações." className="lg:col-span-3">
              <textarea placeholder="Ex: pediu retorno sobre portaria remota na próxima semana" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} className="min-h-[78px] rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle()} />
            </Field>
            <button type="submit" disabled={saving} className="flex min-h-[78px] items-center justify-center gap-2 rounded-xl text-sm font-medium disabled:opacity-60" style={{ background: 'var(--erp-violet)', color: '#fff' }}>
              <Save size={14} />
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Salvar lead'}
            </button>
          </form>
        </Card>
      )}

      <div className="flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap">
        {FILTER_TABS.map((tab) => {
          const active = activeFilter === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveFilter(tab.id)} className="flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150" style={{ background: active ? 'var(--erp-violet-dim)' : 'transparent', color: active ? 'var(--erp-violet-light)' : 'var(--erp-text-muted)', border: active ? '1px solid var(--erp-violet)44' : '1px solid transparent' }}>
              {tab.label}
              {counts[tab.id] != null && <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: active ? 'var(--erp-violet)33' : 'var(--erp-surface)', color: active ? 'var(--erp-violet-light)' : 'var(--erp-text-dim)' }}>{counts[tab.id]}</span>}
            </button>
          );
        })}
      </div>

      <Card padding="sm" className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12"><div className="h-4 w-4 animate-spin rounded-full border-2" style={{ borderColor: 'var(--erp-border)', borderTopColor: 'var(--erp-violet)' }} /><span className="text-sm" style={{ color: 'var(--erp-text-muted)' }}>Carregando leads...</span></div>
        ) : filtered.length === 0 ? (
          <EmptyLeads filtered={activeFilter !== 'all' || search !== ''} />
        ) : (
          <>
            <div className="grid gap-3 md:hidden">
              {filtered.map((lead) => <LeadMobileCard key={lead.id} lead={lead} onEdit={editLead} onDelete={(id) => void deleteLead(id)} />)}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                    {['Nome', 'Contato', 'Status', 'Pipeline', 'Valor potencial', 'Origem', 'Responsável', 'Próxima ação', ''].map((header) => <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-muted)' }}>{header}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead, index) => (
                    <tr key={lead.id} className="transition-colors duration-100" style={{ borderBottom: index < filtered.length - 1 ? '1px solid var(--erp-border)' : undefined }} onMouseEnter={(event) => { event.currentTarget.style.background = 'var(--erp-surface-2)'; }} onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent'; }}>
                      <td className="px-4 py-3"><span className="font-medium" style={{ color: 'var(--erp-text)' }}>{lead.name}</span><p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>{lead.company ?? '-'}</p></td>
                      <td className="px-4 py-3"><div className="flex flex-col gap-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{lead.email && <span className="flex items-center gap-1"><Mail size={11} />{lead.email}</span>}{lead.phone && <span className="flex items-center gap-1"><Phone size={11} />{lead.phone}</span>}{!lead.email && !lead.phone && '-'}</div></td>
                      <td className="px-4 py-3"><Badge tone={STATUS_TONE[lead.status]} dot>{STATUS_LABELS[lead.status]}</Badge></td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{STAGE_LABELS[lead.stage] ?? lead.stage}</td>
                      <td className="px-4 py-3"><span style={{ color: lead.value_potential ? 'var(--erp-violet-light)' : 'var(--erp-text-dim)' }}>{lead.value_potential ? money(lead.value_potential) : '-'}</span></td>
                      <td className="px-4 py-3"><div className="flex items-center gap-1.5"><OriginIcon origin={lead.origin} /><span style={{ color: 'var(--erp-text-muted)' }}>{lead.origin ?? '-'}</span></div></td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{lead.assigned_to_name || '-'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{lead.next_action || '-'}{lead.next_contact_date && <p className="mt-1" style={{ color: 'var(--erp-text-dim)' }}>{dateLabel(lead.next_contact_date)}</p>}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => editLead(lead)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: 'var(--erp-violet-light)', border: '1px solid var(--erp-border)' }} title="Editar lead"><Edit3 size={14} /></button>
                          <button onClick={() => void deleteLead(lead.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: '#f87171', border: '1px solid var(--erp-border)' }} title="Excluir lead"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

export default LeadsPageNew;
