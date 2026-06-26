import { TrendingDown, Layers } from 'lucide-react';
import { Card } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';

const CATEGORIES = [
  { name: 'Folha de pagamento',  pct: 40 },
  { name: 'Aluguel e espaço',    pct: 15 },
  { name: 'Software e serviços', pct: 12 },
  { name: 'Marketing',           pct: 10 },
  { name: 'Outros',              pct: 23 },
];

export default function DespesasPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Financeiro</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Despesas</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Controle de saídas e categorias de custo</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total despesas" value="—" detail="Aguarda lançamento" tone="amber"   icon={<TrendingDown size={16} />} />
        <MetricCard label="Fixas"          value="—" detail="custos recorrentes"  tone="violet"  icon={<Layers size={16} />}      />
        <MetricCard label="Variáveis"      value="—" detail="custos variáveis"    tone="emerald" icon={<TrendingDown size={16} />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="lg">
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--erp-text)' }}>Estrutura de custos prevista</p>
          <p className="text-xs mb-4" style={{ color: 'var(--erp-text-muted)' }}>Distribuição esperada quando os dados forem lançados</p>
          <div className="space-y-3">
            {CATEGORIES.map((cat) => (
              <div key={cat.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm" style={{ color: 'var(--erp-text)' }}>{cat.name}</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--erp-text-muted)' }}>{cat.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'var(--erp-surface-2)' }}>
                  <div className="h-1.5 rounded-full transition-all" style={{ background: 'var(--erp-violet)', width: `${cat.pct}%`, opacity: 0.4 }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card padding="lg">
          <div className="flex flex-col items-center justify-center gap-4 h-full py-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <TrendingDown size={24} style={{ color: '#fbbf24' }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Aguarda mapeamento de dados</p>
            <p className="text-xs text-center max-w-xs" style={{ color: 'var(--erp-text-muted)' }}>
              Para registrar despesas, será necessário conectar a fonte de lançamentos contábeis
              ou habilitar o formulário de entrada manual.
            </p>
            <div className="space-y-1.5 w-full max-w-xs">
              {['Integração com sistema contábil', 'Lançamento manual de despesas', 'Importação via planilha'].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)' }}>
                  <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--erp-text-dim)' }} />
                  <span className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
