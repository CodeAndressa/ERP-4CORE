import { useState } from 'react';
import { Calendar, Target, TrendingUp, Plus, X, Check, Sparkles, Loader2, Camera } from 'lucide-react';
import { Card } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';
import { api } from '../../services/api';

interface Goal {
  id: number;
  pillar: string;
  goal: string;
  metric: string;
  target: string;
  done: boolean;
}

interface AISuggestion {
  pillar: string;
  title: string;
  format: string;
  angle: string;
  suggested_date: string;
}

const PILLARS = ['Educação', 'Cases', 'Autoridade', 'Engajamento', 'Prospecção'];

const CURRENT_MONTH_NAME = new Date().toLocaleDateString('pt-BR', { month: 'long' });
const CURRENT_MONTH_LABEL = `${CURRENT_MONTH_NAME.charAt(0).toUpperCase()}${CURRENT_MONTH_NAME.slice(1)} ${new Date().getFullYear()}`;

export default function PlanejamentoPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ pillar: PILLARS[0], goal: '', metric: '', target: '' });
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

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

  async function generateSuggestions() {
    setLoadingAI(true);
    setAiError(null);
    try {
      const { data } = await api.post<{ suggestions: AISuggestion[] }>('/marketing/meta/ai/planning');
      setSuggestions(data?.suggestions ?? []);
    } catch {
      setAiError('Não foi possível gerar sugestões. Verifique a conexão com o Instagram e tente novamente.');
    } finally {
      setLoadingAI(false);
    }
  }

  const byPillar = PILLARS.map((p) => ({
    pillar: p,
    goals: goals.filter((g) => g.pillar === p),
    suggestions: suggestions.filter((s) => s.pillar === p),
  })).filter((p) => p.goals.length > 0 || p.suggestions.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Marketing</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Planejamento Mensal</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Objetivos, pilares de conteúdo e metas do mês</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generateSuggestions}
            disabled={loadingAI}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all disabled:opacity-60"
            style={{ background: 'var(--erp-surface-2)', color: 'var(--erp-violet-light)', border: '1px solid var(--erp-border-strong)' }}
          >
            {loadingAI ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loadingAI ? 'Analisando Instagram...' : 'Sugestões da IA'}
          </button>
          <button onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
            style={{ background: 'var(--erp-violet)', color: '#fff' }}>
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Cancelar' : 'Novo objetivo'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Mês atual"    value={CURRENT_MONTH_LABEL}   detail="período de planejamento"             tone="violet"  icon={<Calendar size={16} />}   />
        <MetricCard label="Objetivos"    value={String(goals.length)}  detail={`${doneCount} concluídos`}           tone="emerald" icon={<Target size={16} />}     />
        <MetricCard label="Conclusão"    value={goals.length > 0 ? `${Math.round((doneCount / goals.length) * 100)}%` : '0%'} detail="progresso do mês" tone="amber" icon={<TrendingUp size={16} />} />
      </div>

      {aiError && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(190,18,60,0.08)', border: '1px solid rgba(190,18,60,0.2)', color: 'var(--erp-rose)' }}>
          {aiError}
        </div>
      )}

      {suggestions.length > 0 && (
        <Card padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={14} style={{ color: 'var(--erp-violet-light)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Sugestões da IA — baseadas no seu Instagram</p>
            <span className="ml-auto text-xs rounded-full px-2 py-0.5"
              style={{ background: 'var(--erp-violet-dim)', color: 'var(--erp-violet-light)' }}>
              {suggestions.length} posts
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((s, i) => (
              <div key={i} className="rounded-xl p-3" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'var(--erp-violet-soft)', color: 'var(--erp-violet-light)' }}>
                    {s.pillar}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--erp-text-dim)' }}>{s.format}</span>
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--erp-text)' }}>{s.title}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}>{s.angle}</p>
                {s.suggested_date && (
                  <div className="flex items-center gap-1 mt-2">
                    <Camera size={10} style={{ color: 'var(--erp-text-dim)' }} />
                    <span className="text-[10px]" style={{ color: 'var(--erp-text-dim)' }}>
                      {new Date(s.suggested_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

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

      {goals.length === 0 && (
        <Card padding="lg">
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--erp-violet-dim)' }}>
              <Target size={22} style={{ color: 'var(--erp-violet-light)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--erp-text)' }}>Nenhum objetivo cadastrado este mês</p>
            <p className="max-w-xs text-xs" style={{ color: 'var(--erp-text-muted)' }}>Use "Novo objetivo" para registrar as metas de {CURRENT_MONTH_LABEL.toLowerCase()} por pilar de conteúdo.</p>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {byPillar.map(({ pillar, goals: pillarGoals }) => (
          <Card key={pillar} padding="lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--erp-violet)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>{pillar}</p>
              </div>
              <span className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                {pillarGoals.filter((g) => g.done).length}/{pillarGoals.length} concluídos
              </span>
            </div>
            <div className="space-y-2">
              {pillarGoals.map((g) => (
                <div key={g.id}
                  className="flex items-start gap-3 rounded-xl px-3 py-3 cursor-pointer transition-all"
                  style={{
                    background: g.done ? 'rgba(4,120,87,0.07)' : 'var(--erp-surface-2)',
                    border: `1px solid ${g.done ? 'rgba(4,120,87,0.24)' : 'var(--erp-border)'}`,
                  }}
                  onClick={() => toggleGoal(g.id)}
                >
                  <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md mt-0.5"
                    style={{
                      background: g.done ? 'var(--erp-emerald)' : 'var(--erp-surface)',
                      border: `1px solid ${g.done ? 'var(--erp-emerald)' : 'var(--erp-border-strong)'}`,
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
