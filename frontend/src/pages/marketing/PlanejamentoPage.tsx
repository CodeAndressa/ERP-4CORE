import { useState } from 'react';
import { Calendar, Target, TrendingUp, Plus, X, Check } from 'lucide-react';
import { Card } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';

interface Goal {
  id: number;
  pillar: string;
  goal: string;
  metric: string;
  target: string;
  done: boolean;
}

const PILLARS = ['Educação', 'Cases', 'Autoridade', 'Engajamento', 'Prospecção'];

const SEED_GOALS: Goal[] = [
  { id: 1, pillar: 'Educação',    goal: 'Publicar 2 artigos de educação continuada DP', metric: 'Posts',      target: '2/mês',  done: false },
  { id: 2, pillar: 'Cases',       goal: 'Documentar 1 caso de sucesso de cliente',      metric: 'Cases',      target: '1/mês',  done: false },
  { id: 3, pillar: 'Autoridade',  goal: 'Participar de 1 evento / webinar como speaker', metric: 'Eventos',   target: '1/mês',  done: false },
  { id: 4, pillar: 'Engajamento', goal: 'Taxa de engajamento acima de 4% no Instagram', metric: 'Taxa %',     target: '≥ 4%',   done: false },
  { id: 5, pillar: 'Prospecção',  goal: '10 novos leads via conteúdo orgânico',          metric: 'Leads',      target: '10/mês', done: false },
];

export default function PlanejamentoPage() {
  const [goals, setGoals] = useState<Goal[]>(SEED_GOALS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ pillar: PILLARS[0], goal: '', metric: '', target: '' });

  const doneCount = goals.filter((g) => g.done).length;

  function toggleGoal(id: number) {
    setGoals((prev) => prev.map((g) => g.id === id ? { ...g, done: !g.done } : g));
  }

  function addGoal() {
    if (!form.goal) return;
    setGoals((prev) => [...prev, { id: prev.length + 1, ...form, done: false }]);
    setShowForm(false);
    setForm({ pillar: PILLARS[0], goal: '', metric: '', target: '' });
  }

  const byPillar = PILLARS.map((p) => ({
    pillar: p,
    goals: goals.filter((g) => g.pillar === p),
  })).filter((p) => p.goals.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Marketing</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Planejamento Mensal</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Objetivos, pilares de conteúdo e metas do mês</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--erp-violet)', color: '#fff' }}>
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancelar' : 'Novo objetivo'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Mês atual"    value="Julho 2026"            detail="período de planejamento"             tone="violet"  icon={<Calendar size={16} />}   />
        <MetricCard label="Objetivos"    value={String(goals.length)}  detail={`${doneCount} concluídos`}           tone="emerald" icon={<Target size={16} />}     />
        <MetricCard label="Conclusão"    value={goals.length > 0 ? `${Math.round((doneCount / goals.length) * 100)}%` : '0%'} detail="progresso do mês" tone="amber" icon={<TrendingUp size={16} />} />
      </div>

      {showForm && (
        <Card padding="lg">
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--erp-text)' }}>Novo objetivo</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--erp-text-muted)' }}>Pilar</label>
              <select value={form.pillar} onChange={(e) => setForm((f) => ({ ...f, pillar: e.target.value }))}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}>
                {PILLARS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--erp-text-muted)' }}>Objetivo</label>
              <input placeholder="Descreva o objetivo" value={form.goal} onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
            </div>
            <div className="flex items-end">
              <button onClick={addGoal} className="w-full rounded-xl py-2 text-sm font-medium"
                style={{ background: 'var(--erp-violet)', color: '#fff' }}>Adicionar</button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {byPillar.map(({ pillar, goals: pillarGoals }) => (
          <Card key={pillar} padding="lg">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>{pillar}</p>
              <span className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                {pillarGoals.filter((g) => g.done).length}/{pillarGoals.length} concluídos
              </span>
            </div>
            <div className="space-y-2">
              {pillarGoals.map((g) => (
                <div key={g.id}
                  className="flex items-start gap-3 rounded-xl px-3 py-3 cursor-pointer transition-all"
                  style={{
                    background: g.done ? 'rgba(52,211,153,0.06)' : 'var(--erp-surface-2)',
                    border: `1px solid ${g.done ? 'rgba(52,211,153,0.2)' : 'var(--erp-border)'}`,
                  }}
                  onClick={() => toggleGoal(g.id)}
                >
                  <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md mt-0.5"
                    style={{
                      background: g.done ? '#34d399' : 'var(--erp-surface)',
                      border: `1px solid ${g.done ? '#34d399' : 'var(--erp-border-strong)'}`,
                    }}>
                    {g.done && <Check size={10} color="#fff" strokeWidth={3} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm" style={{
                      color: g.done ? 'var(--erp-text-muted)' : 'var(--erp-text)',
                      textDecoration: g.done ? 'line-through' : 'none',
                    }}>{g.goal}</p>
                    {g.metric && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--erp-text-dim)' }}>
                        {g.metric} · meta: {g.target}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
