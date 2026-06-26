import { useState } from 'react';
import { Megaphone, Plus, X, TrendingUp, DollarSign, Target } from 'lucide-react';
import { Card } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';
import { Badge } from '../../shared/components/ui/Badge';

type CampaignStatus = 'ativa' | 'planejada' | 'encerrada';
type Channel = 'instagram' | 'linkedin' | 'email' | 'google' | 'whatsapp';

interface Campaign {
  id: number;
  name: string;
  channel: Channel;
  status: CampaignStatus;
  budget: number;
  spent: number;
  leads: number;
  start: string;
  end?: string;
}

const SEED: Campaign[] = [
  { id: 1, name: 'Lançamento RH Digital',   channel: 'instagram', status: 'ativa',     budget: 3000,  spent: 1800, leads: 24, start: '01/06' },
  { id: 2, name: 'Nutrição de leads B2B',    channel: 'email',     status: 'ativa',     budget: 500,   spent: 220,  leads: 41, start: '15/06' },
  { id: 3, name: 'Webinar DP Automatizado',  channel: 'linkedin',  status: 'planejada', budget: 1200,  spent: 0,    leads: 0,  start: '10/07' },
  { id: 4, name: 'Remarketing clientes',     channel: 'google',    status: 'encerrada', budget: 2000,  spent: 2000, leads: 18, start: '01/05', end: '31/05' },
];

const CH_COLOR: Record<Channel, string> = {
  instagram: '#e1306c', linkedin: '#0a66c2', email: '#7c3aed',
  google: '#4285f4', whatsapp: '#25d366',
};

const STATUS_TONE: Record<CampaignStatus, 'emerald' | 'violet' | 'slate'> = {
  ativa: 'emerald', planejada: 'violet', encerrada: 'slate',
};

const money = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

export default function CampanhasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(SEED);
  const [filter, setFilter] = useState<CampaignStatus | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', channel: 'instagram' as Channel, budget: '', start: '' });

  const ativas = campaigns.filter((c) => c.status === 'ativa');
  const totalBudget = ativas.reduce((s, c) => s + c.budget, 0);
  const totalLeads  = campaigns.reduce((s, c) => s + c.leads, 0);
  const filtered = campaigns.filter((c) => filter === 'all' || c.status === filter);

  function addCampaign() {
    if (!form.name) return;
    setCampaigns((prev) => [...prev, {
      id: prev.length + 1, name: form.name, channel: form.channel,
      status: 'planejada', budget: Number(form.budget) || 0, spent: 0,
      leads: 0, start: form.start || '—',
    }]);
    setShowForm(false);
    setForm({ name: '', channel: 'instagram', budget: '', start: '' });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Marketing</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Campanhas</h1>
        </div>
        <button onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--erp-violet)', color: '#fff' }}>
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancelar' : 'Nova campanha'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Ativas"         value={String(ativas.length)}  detail={`de ${campaigns.length} campanhas`} tone="emerald" icon={<Megaphone size={16} />}  />
        <MetricCard label="Investimento"   value={money(totalBudget)}     detail="orçamento das ativas"               tone="violet"  icon={<DollarSign size={16} />} />
        <MetricCard label="Leads gerados"  value={String(totalLeads)}     detail="todas as campanhas"                  tone="amber"   icon={<Target size={16} />}     />
      </div>

      {showForm && (
        <Card padding="lg">
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--erp-text)' }}>Nova campanha</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--erp-text-muted)' }}>Nome</label>
              <input placeholder="Nome da campanha" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--erp-text-muted)' }}>Canal</label>
              <select value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as Channel }))}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}>
                {(['instagram','linkedin','email','google','whatsapp'] as Channel[]).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--erp-text-muted)' }}>Orçamento (R$)</label>
              <input type="number" placeholder="0" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
            </div>
            <div className="flex items-end">
              <button onClick={addCampaign} className="w-full rounded-xl py-2 text-sm font-medium"
                style={{ background: 'var(--erp-violet)', color: '#fff' }}>Adicionar</button>
            </div>
          </div>
        </Card>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        {(['all', 'ativa', 'planejada', 'encerrada'] as (CampaignStatus | 'all')[]).map((s) => {
          const active = filter === s;
          const labels: Record<string, string> = { all: 'Todas', ativa: 'Ativas', planejada: 'Planejadas', encerrada: 'Encerradas' };
          return (
            <button key={s} onClick={() => setFilter(s)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: active ? 'var(--erp-violet-dim)' : 'transparent',
                color: active ? 'var(--erp-violet-light)' : 'var(--erp-text-muted)',
                border: active ? '1px solid var(--erp-violet)44' : '1px solid transparent',
              }}>
              {labels[s]}
            </button>
          );
        })}
      </div>

      <Card padding="sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                {['Campanha', 'Canal', 'Status', 'Orçamento', 'Gasto', 'Leads', 'Período'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const spentPct = c.budget > 0 ? Math.round((c.spent / c.budget) * 100) : 0;
                return (
                  <tr key={c.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--erp-border)' : undefined }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--erp-surface-2)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Megaphone size={12} style={{ color: 'var(--erp-text-dim)' }} />
                        <span className="font-medium" style={{ color: 'var(--erp-text)' }}>{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
                        style={{ background: `${CH_COLOR[c.channel]}18`, color: CH_COLOR[c.channel] }}>
                        {c.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3"><Badge tone={STATUS_TONE[c.status]} dot>{c.status}</Badge></td>
                    <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: 'var(--erp-violet-light)' }}>{money(c.budget)}</td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-xs tabular-nums" style={{ color: 'var(--erp-text-muted)' }}>{money(c.spent)}</span>
                        <div className="mt-1 h-1 rounded-full" style={{ background: 'var(--erp-surface-2)', width: 60 }}>
                          <div className="h-1 rounded-full" style={{ background: '#7c3aed', width: `${spentPct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: c.leads > 0 ? '#34d399' : 'var(--erp-text-dim)' }}>{c.leads}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                      {c.start}{c.end ? ` — ${c.end}` : ''}
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
