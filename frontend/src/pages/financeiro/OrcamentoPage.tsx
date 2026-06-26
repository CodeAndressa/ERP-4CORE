import { Target, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';

const BUDGET_LINES = [
  { category: 'Receita bruta',       budgeted: 120000, actual: null },
  { category: 'Custo pessoal',       budgeted: 40000,  actual: null },
  { category: 'Marketing',           budgeted: 12000,  actual: null },
  { category: 'Tecnologia',          budgeted: 8000,   actual: null },
  { category: 'Despesas operacionais', budgeted: 10000,  actual: null },
];

const money = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

export default function OrcamentoPage() {
  const totalBudgeted = BUDGET_LINES.reduce((s, b) => s + b.budgeted, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Financeiro</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Orçamento</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Planejado vs realizado por categoria</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Orçamento total"  value={money(totalBudgeted)} detail="projeção anual planejada" tone="violet"  icon={<Target size={16} />}      />
        <MetricCard label="Realizado"        value="—"                    detail="Aguarda lançamentos"      tone="emerald" icon={<TrendingUp size={16} />}   />
        <MetricCard label="Desvio"           value="—"                    detail="vs planejado"             tone="amber"   icon={<TrendingDown size={16} />} />
      </div>

      <Card padding="sm">
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--erp-border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Orçamento por categoria</p>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
            Realizado aguarda mapeamento
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                {['Categoria', 'Planejado', 'Realizado', 'Desvio', 'Execução'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BUDGET_LINES.map((line, i) => (
                <tr key={i} style={{ borderBottom: i < BUDGET_LINES.length - 1 ? '1px solid var(--erp-border)' : undefined }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--erp-surface-2)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{line.category}</td>
                  <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: 'var(--erp-violet-light)' }}>{money(line.budgeted)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--erp-text-dim)' }}>—</td>
                  <td className="px-4 py-3" style={{ color: 'var(--erp-text-dim)' }}>—</td>
                  <td className="px-4 py-3 w-32">
                    <div className="h-1.5 rounded-full" style={{ background: 'var(--erp-surface-2)' }}>
                      <div className="h-1.5 rounded-full" style={{ background: 'var(--erp-violet)', width: '0%' }} />
                    </div>
                    <span className="text-[10px]" style={{ color: 'var(--erp-text-dim)' }}>0%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
