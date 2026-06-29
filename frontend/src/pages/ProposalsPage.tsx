import { useState } from 'react';
import { FileText, Plus, Clock, CheckCircle, X, DollarSign } from 'lucide-react';
import { Card } from '../shared/components/ui/Card';
import { MetricCard } from '../shared/components/layout/MetricCard';
import { Badge } from '../shared/components/ui/Badge';

type ProposalStatus = 'enviada' | 'elaboracao' | 'aprovada' | 'perdida';

interface Proposal {
  id: number;
  code: string;
  client: string;
  value: number;
  status: ProposalStatus;
  nextAction: string;
}

const SEED: Proposal[] = [
  { id: 1, code: '026/2026', client: 'Grupo Atlas',          value: 28000, status: 'enviada',    nextAction: '27 jun — aguardando retorno'  },
  { id: 2, code: '025/2026', client: 'Norte RH',             value: 16800, status: 'elaboracao', nextAction: '30 jun — enviar para cliente'  },
  { id: 3, code: '024/2026', client: 'Vértice Logística',    value: 12500, status: 'aprovada',   nextAction: 'Início 01 jul'                  },
  { id: 4, code: '023/2026', client: 'Agro Primavera',       value:  8900, status: 'enviada',    nextAction: '28 jun — follow-up'             },
  { id: 5, code: '022/2026', client: 'Tech Soluções',        value: 19500, status: 'perdida',    nextAction: 'Encerrada'                      },
];

const STATUS_TONE: Record<ProposalStatus, 'amber' | 'violet' | 'emerald' | 'slate'> = {
  enviada:    'amber',
  elaboracao: 'violet',
  aprovada:   'emerald',
  perdida:    'slate',
};

const STATUS_LABELS: Record<ProposalStatus, string> = {
  enviada:    'Enviada',
  elaboracao: 'Em elaboração',
  aprovada:   'Aprovada',
  perdida:    'Perdida',
};

const money = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>(SEED);
  const [filter, setFilter] = useState<ProposalStatus | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ client: '', value: '', status: 'elaboracao' as ProposalStatus });

  const active = proposals.filter((p) => p.status !== 'perdida');
  const pipeline = active.reduce((s, p) => s + p.value, 0);
  const approved = proposals.filter((p) => p.status === 'aprovada').length;
  const convRate = proposals.length > 0 ? Math.round((approved / proposals.length) * 100) : 0;

  const filtered = proposals.filter((p) => filter === 'all' || p.status === filter);

  const TABS: { id: ProposalStatus | 'all'; label: string }[] = [
    { id: 'all',        label: 'Todas'        },
    { id: 'elaboracao', label: 'Em elaboração' },
    { id: 'enviada',    label: 'Enviadas'     },
    { id: 'aprovada',   label: 'Aprovadas'    },
    { id: 'perdida',    label: 'Perdidas'     },
  ];

  function addProposal() {
    if (!form.client || !form.value) return;
    const next = proposals.length + 1;
    setProposals((prev) => [...prev, {
      id: next,
      code: `0${next + 20}/2026`,
      client: form.client,
      value: Number(form.value),
      status: form.status,
      nextAction: 'A definir',
    }]);
    setShowForm(false);
    setForm({ client: '', value: '', status: 'elaboracao' });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Comercial</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Propostas</h1>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--erp-violet)', color: '#fff' }}
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancelar' : 'Nova proposta'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Em negociação" value={money(pipeline)}  detail={`${active.length} propostas ativas`} tone="violet"  icon={<DollarSign size={16} />} />
        <MetricCard label="Conversão"     value={`${convRate}%`}   detail="aprovadas / total"                  tone="emerald" icon={<CheckCircle size={16} />} />
        <MetricCard label="Tempo médio"   value="12 dias"          detail="do envio ao fechamento"             tone="amber"   icon={<Clock size={16} />} />
      </div>

      {showForm && (
        <Card padding="lg">
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--erp-text)' }}>Nova proposta</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <input placeholder="Cliente" value={form.client} onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))}
              className="rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
            <input placeholder="Valor (R$)" type="number" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              className="rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
            <button onClick={addProposal} className="rounded-xl py-2 text-sm font-medium"
              style={{ background: 'var(--erp-violet)', color: '#fff' }}>Adicionar</button>
          </div>
        </Card>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map((tab) => {
          const active = filter === tab.id;
          return (
            <button key={tab.id} onClick={() => setFilter(tab.id)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: active ? 'var(--erp-violet-dim)' : 'transparent',
                color: active ? 'var(--erp-violet-light)' : 'var(--erp-text-muted)',
                border: active ? '1px solid var(--erp-violet)44' : '1px solid transparent',
              }}>
              {tab.label}
            </button>
          );
        })}
      </div>

      <Card padding="sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                {['Proposta', 'Cliente', 'Valor', 'Status', 'Próxima ação'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id}
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--erp-border)' : undefined }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--erp-surface-2)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText size={12} style={{ color: 'var(--erp-text-dim)' }} />
                      <span className="font-mono text-xs" style={{ color: 'var(--erp-text-muted)' }}>#{p.code}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{p.client}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums" style={{ color: 'var(--erp-violet-light)' }}>{money(p.value)}</td>
                  <td className="px-4 py-3"><Badge tone={STATUS_TONE[p.status]} dot>{STATUS_LABELS[p.status]}</Badge></td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{p.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
