import { useEffect, useState } from 'react';
import { Phone, Mail, Users, Bell, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import { Card } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';

type ContactType = 'ligacao' | 'email' | 'reuniao' | 'whatsapp';
type FollowStatus = 'ativo' | 'espera' | 'concluido';
type Priority = 'alta' | 'media' | 'baixa';

interface Followup {
  id: number;
  name: string;
  company: string;
  lastContact?: string | null;
  nextContact?: string | null;
  type: ContactType;
  status: FollowStatus;
  priority: Priority;
  notes: string;
}

interface Lead {
  id: number;
  name: string;
  company?: string | null;
  status?: string | null;
  stage?: string | null;
  email?: string | null;
  phone?: string | null;
  last_contact_date?: string | null;
  next_contact_date?: string | null;
  next_action?: string | null;
  notes?: string | null;
}

const TYPE_LABELS: Record<ContactType, string> = { ligacao: 'Ligação', email: 'Email', reuniao: 'Reunião', whatsapp: 'WhatsApp' };
const TYPE_ICONS: Record<ContactType, JSX.Element> = { ligacao: <Phone size={13} style={{ color: 'var(--erp-text-muted)' }} />, email: <Mail size={13} style={{ color: 'var(--erp-text-muted)' }} />, reuniao: <Users size={13} style={{ color: 'var(--erp-text-muted)' }} />, whatsapp: <Bell size={13} style={{ color: 'var(--erp-text-muted)' }} /> };
const PRIORITY_CONFIG: Record<Priority, { bg: string; color: string; label: string }> = { alta: { bg: 'rgba(190,18,60,0.12)', color: 'var(--erp-rose)', label: 'Alta' }, media: { bg: 'rgba(180,83,9,0.12)', color: 'var(--erp-amber)', label: 'Média' }, baixa: { bg: 'var(--erp-surface-3)', color: 'var(--erp-text-muted)', label: 'Baixa' } };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(iso?: string | null) {
  if (!iso) return 999;
  const today = new Date(todayIso() + 'T12:00:00');
  const target = new Date(iso + 'T12:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function typeFromLead(lead: Lead): ContactType {
  const text = `${lead.next_action ?? ''} ${lead.notes ?? ''}`.toLowerCase();
  if (text.includes('whats')) return 'whatsapp';
  if (text.includes('email')) return 'email';
  if (text.includes('reun') || text.includes('apresent')) return 'reuniao';
  return lead.email && !lead.phone ? 'email' : 'ligacao';
}

function statusFromLead(lead: Lead): FollowStatus {
  if (lead.stage === 'fechado' || lead.status === 'perdido') return 'concluido';
  if (!lead.next_contact_date) return 'espera';
  return 'ativo';
}

function priorityFromLead(lead: Lead): Priority {
  const days = daysUntil(lead.next_contact_date);
  if (days <= 1) return 'alta';
  if (days <= 7) return 'media';
  return 'baixa';
}

function normalizeFollowup(lead: Lead): Followup {
  return {
    id: lead.id,
    name: lead.name,
    company: lead.company || 'Sem empresa',
    lastContact: lead.last_contact_date,
    nextContact: lead.next_contact_date,
    type: typeFromLead(lead),
    status: statusFromLead(lead),
    priority: priorityFromLead(lead),
    notes: lead.next_action || lead.notes || 'Sem próxima ação definida',
  };
}

function DaysBadge({ iso }: { iso?: string | null }) {
  if (!iso) return <span className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>Sem data</span>;
  const days = daysUntil(iso);
  if (days < 0) return <span className="text-xs font-semibold" style={{ color: 'var(--erp-rose)' }}>{Math.abs(days)}d em atraso</span>;
  if (days === 0) return <span className="text-xs font-semibold" style={{ color: 'var(--erp-amber)' }}>Hoje</span>;
  if (days <= 2) return <span className="text-xs font-semibold" style={{ color: 'var(--erp-amber)' }}>em {days}d</span>;
  return <span className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>em {days}d</span>;
}

export default function FollowupPage() {
  const [items, setItems] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FollowStatus | 'all'>('all');

  useEffect(() => {
    api.get('/leads')
      .then(({ data }) => setItems((Array.isArray(data) ? data : []).map(normalizeFollowup)))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((f) => filter === 'all' || f.status === filter);
  const ativos = items.filter((f) => f.status === 'ativo').length;
  const urgentes = items.filter((f) => daysUntil(f.nextContact) <= 1 && f.status === 'ativo').length;
  const concluidos = items.filter((f) => f.status === 'concluido').length;
  const espera = items.filter((f) => f.status === 'espera').length;
  const TABS: { id: FollowStatus | 'all'; label: string; count: number }[] = [
    { id: 'all', label: 'Todos', count: items.length },
    { id: 'ativo', label: 'Ativos', count: ativos },
    { id: 'espera', label: 'Aguardando', count: espera },
    { id: 'concluido', label: 'Concluídos', count: concluidos },
  ];

  return (
    <div className="space-y-6">
      <div><p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Comercial</p><h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Follow-up</h1><p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Acompanhamento gerado pelos leads cadastrados manualmente</p></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><MetricCard label="Ativos" value={String(ativos)} detail="em acompanhamento" tone="violet" icon={<Bell size={16} />} /><MetricCard label="Urgentes" value={String(urgentes)} detail="contatar hoje/amanhã" tone="rose" icon={<AlertTriangle size={16} />} /><MetricCard label="Concluídos" value={String(concluidos)} detail="leads fechados/perdidos" tone="emerald" icon={<CheckCircle size={16} />} /></div>
      <div className="flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap">{TABS.map((tab) => { const active = filter === tab.id; return <button key={tab.id} onClick={() => setFilter(tab.id)} className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all" style={{ background: active ? 'var(--erp-violet-dim)' : 'transparent', color: active ? 'var(--erp-violet-light)' : 'var(--erp-text-muted)', border: active ? '1px solid var(--erp-violet)44' : '1px solid transparent' }}>{tab.label}<span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'var(--erp-surface-2)', color: 'var(--erp-text-dim)' }}>{tab.count}</span></button>; })}</div>
      <Card padding="sm">{loading ? <div className="space-y-2 p-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />)}</div> : filtered.length === 0 ? <div className="py-14 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhum lead para acompanhamento.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr style={{ borderBottom: '1px solid var(--erp-border)' }}>{['Lead', 'Empresa', 'Próximo contato', 'Tipo', 'Prioridade', 'Notas'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-muted)' }}>{h}</th>)}</tr></thead><tbody>{filtered.map((f, i) => { const pc = PRIORITY_CONFIG[f.priority]; const days = daysUntil(f.nextContact); const isUrgent = days <= 1 && f.status === 'ativo'; return <tr key={f.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--erp-border)' : undefined, background: isUrgent ? 'rgba(190,18,60,0.04)' : undefined }} onMouseEnter={(e) => { if (!isUrgent) e.currentTarget.style.background = 'var(--erp-surface-2)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = isUrgent ? 'rgba(190,18,60,0.04)' : 'transparent'; }}><td className="px-4 py-3"><div className="flex items-center gap-2">{f.status === 'concluido' && <CheckCircle size={12} style={{ color: 'var(--erp-emerald)' }} />}{f.status === 'espera' && <Clock size={12} style={{ color: 'var(--erp-amber)' }} />}<span className="font-medium" style={{ color: 'var(--erp-text)' }}>{f.name}</span></div></td><td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{f.company}</td><td className="px-4 py-3"><div className="flex flex-col gap-0.5"><span className="text-xs tabular-nums" style={{ color: 'var(--erp-text-muted)' }}>{f.nextContact ? new Date(f.nextContact + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</span><DaysBadge iso={f.nextContact} /></div></td><td className="px-4 py-3"><div className="flex items-center gap-1.5">{TYPE_ICONS[f.type]}<span className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>{TYPE_LABELS[f.type]}</span></div></td><td className="px-4 py-3"><span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: pc.bg, color: pc.color }}>{pc.label}</span></td><td className="px-4 py-3 text-xs max-w-[260px] truncate" style={{ color: 'var(--erp-text-muted)' }}>{f.notes}</td></tr>; })}</tbody></table></div>}</Card>
    </div>
  );
}
