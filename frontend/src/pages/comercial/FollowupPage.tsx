import { useState } from 'react';
import { Phone, Mail, Users, Bell, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';

type ContactType = 'ligação' | 'email' | 'reunião' | 'whatsapp';
type FollowStatus = 'ativo' | 'espera' | 'concluido';
type Priority = 'alta' | 'media' | 'baixa';

interface Followup {
  id: number;
  name: string;
  company: string;
  lastContact: string;
  nextContact: string;
  type: ContactType;
  status: FollowStatus;
  priority: Priority;
  notes: string;
}

const DATA: Followup[] = [
  { id: 1, name: 'João Silva',      company: 'Construtora Atlas',  lastContact: '2026-06-20', nextContact: '2026-06-28', type: 'ligação',  status: 'ativo',    priority: 'alta',  notes: 'Proposta enviada, aguardando retorno' },
  { id: 2, name: 'Maria Santos',    company: 'RH Consulting',      lastContact: '2026-06-15', nextContact: '2026-06-30', type: 'email',    status: 'ativo',    priority: 'media', notes: 'Interesse em compliance trabalhista' },
  { id: 3, name: 'Pedro Oliveira',  company: 'Indústria Teksa',    lastContact: '2026-06-22', nextContact: '2026-07-02', type: 'reunião',  status: 'ativo',    priority: 'alta',  notes: 'Segunda reunião agendada' },
  { id: 4, name: 'Ana Costa',       company: 'Distribuidora Nova', lastContact: '2026-06-10', nextContact: '2026-07-05', type: 'email',    status: 'espera',   priority: 'baixa', notes: 'Aguardando aprovação interna' },
  { id: 5, name: 'Carlos Ferreira', company: 'Tech Soluções',      lastContact: '2026-06-24', nextContact: '2026-06-27', type: 'ligação',  status: 'ativo',    priority: 'alta',  notes: 'Decisão iminente — urgente' },
  { id: 6, name: 'Lucia Mendes',    company: 'Grupo Farma',        lastContact: '2026-06-18', nextContact: '2026-07-08', type: 'reunião',  status: 'espera',   priority: 'media', notes: 'Enviado material de apresentação' },
  { id: 7, name: 'Roberto Lima',    company: 'Agro Primavera',     lastContact: '2026-06-25', nextContact: '2026-06-29', type: 'whatsapp', status: 'ativo',    priority: 'media', notes: 'Respondeu ontem, muito interessado' },
  { id: 8, name: 'Fernanda Dias',   company: 'Clínica Saúde',      lastContact: '2026-06-12', nextContact: '2026-06-26', type: 'email',    status: 'concluido', priority: 'baixa', notes: 'Contrato fechado' },
];

const TYPE_ICONS: Record<ContactType, React.ReactNode> = {
  ligação:  <Phone     size={13} className="text-violet-400" />,
  email:    <Mail      size={13} className="text-blue-400"   />,
  reunião:  <Users     size={13} className="text-emerald-400"/>,
  whatsapp: <Bell      size={13} className="text-green-400"  />,
};

const PRIORITY_CONFIG: Record<Priority, { bg: string; color: string; label: string }> = {
  alta:  { bg: 'rgba(248,113,113,0.12)', color: '#f87171', label: 'Alta' },
  media: { bg: 'rgba(251,191,36,0.12)',  color: '#fbbf24', label: 'Média' },
  baixa: { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8', label: 'Baixa' },
};

function daysUntil(iso: string) {
  const today = new Date('2026-06-26');
  const target = new Date(iso);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function DaysBadge({ iso }: { iso: string }) {
  const days = daysUntil(iso);
  if (days < 0)  return <span className="text-xs font-semibold" style={{ color: '#f87171' }}>{Math.abs(days)}d em atraso</span>;
  if (days === 0) return <span className="text-xs font-semibold" style={{ color: '#fbbf24' }}>Hoje</span>;
  if (days <= 2)  return <span className="text-xs font-semibold" style={{ color: '#fbbf24' }}>em {days}d</span>;
  return <span className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>em {days}d</span>;
}

export default function FollowupPage() {
  const [filter, setFilter] = useState<FollowStatus | 'all'>('all');

  const filtered = DATA.filter((f) => filter === 'all' || f.status === filter);

  const ativos    = DATA.filter((f) => f.status === 'ativo').length;
  const urgentes  = DATA.filter((f) => daysUntil(f.nextContact) <= 1 && f.status === 'ativo').length;
  const concluidos = DATA.filter((f) => f.status === 'concluido').length;

  const TABS: { id: FollowStatus | 'all'; label: string; count: number }[] = [
    { id: 'all',      label: 'Todos',     count: DATA.length },
    { id: 'ativo',    label: 'Ativos',    count: ativos },
    { id: 'espera',   label: 'Aguardando', count: DATA.filter((f) => f.status === 'espera').length },
    { id: 'concluido', label: 'Concluídos', count: concluidos },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Comercial</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Follow-up</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Ativos"    value={String(ativos)}    detail="em acompanhamento"   tone="violet"  icon={<Bell size={16} />} />
        <MetricCard label="Urgentes"  value={String(urgentes)}  detail="contatar hoje/amanhã" tone="rose"    icon={<AlertTriangle size={16} />} />
        <MetricCard label="Concluídos" value={String(concluidos)} detail="este mês"            tone="emerald" icon={<CheckCircle size={16} />} />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map((tab) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: active ? 'var(--erp-violet-dim)' : 'transparent',
                color: active ? 'var(--erp-violet-light)' : 'var(--erp-text-muted)',
                border: active ? '1px solid var(--erp-violet)44' : '1px solid transparent',
              }}
            >
              {tab.label}
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                style={{ background: 'var(--erp-surface-2)', color: 'var(--erp-text-dim)' }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <Card padding="sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                {['Lead', 'Empresa', 'Próximo contato', 'Tipo', 'Prioridade', 'Notas'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => {
                const pc = PRIORITY_CONFIG[f.priority];
                const days = daysUntil(f.nextContact);
                const isUrgent = days <= 1 && f.status === 'ativo';
                return (
                  <tr
                    key={f.id}
                    style={{
                      borderBottom: i < filtered.length - 1 ? '1px solid var(--erp-border)' : undefined,
                      background: isUrgent ? 'rgba(248,113,113,0.04)' : undefined,
                    }}
                    onMouseEnter={(e) => { if (!isUrgent) (e.currentTarget as HTMLElement).style.background = 'var(--erp-surface-2)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isUrgent ? 'rgba(248,113,113,0.04)' : 'transparent'; }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {f.status === 'concluido' && <CheckCircle size={12} style={{ color: '#34d399' }} />}
                        {f.status === 'espera'    && <Clock size={12} style={{ color: '#fbbf24' }} />}
                        <span className="font-medium" style={{ color: 'var(--erp-text)' }}>{f.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{f.company}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs tabular-nums" style={{ color: 'var(--erp-text-muted)' }}>
                          {new Date(f.nextContact + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                        <DaysBadge iso={f.nextContact} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {TYPE_ICONS[f.type]}
                        <span className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>{f.type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ background: pc.bg, color: pc.color }}>
                        {pc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[200px] truncate" style={{ color: 'var(--erp-text-muted)' }}>
                      {f.notes}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
