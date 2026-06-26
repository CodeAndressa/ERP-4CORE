import { Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { Card } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';

const PREVIEW_ROWS = [
  { supplier: 'Fornecedor A', category: 'Software',        due: '05/07/2026', value: '—', status: 'pendente' },
  { supplier: 'Fornecedor B', category: 'Marketing',       due: '10/07/2026', value: '—', status: 'pendente' },
  { supplier: 'Fornecedor C', category: 'Infraestrutura',  due: '15/07/2026', value: '—', status: 'pendente' },
];

export default function ContasPagarPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Financeiro</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Contas a Pagar</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Obrigações a vencer e histórico de pagamentos</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="A vencer"  value="—" detail="Aguarda lançamento"     tone="amber"   icon={<Calendar size={16} />}    />
        <MetricCard label="Vencidos"  value="—" detail="em atraso"              tone="violet"  icon={<AlertCircle size={16} />} />
        <MetricCard label="Pagos"     value="—" detail="este mês"               tone="emerald" icon={<CheckCircle size={16} />} />
      </div>

      <Card padding="sm">
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--erp-border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Próximos vencimentos</p>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
            Aguarda mapeamento
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                {['Fornecedor', 'Categoria', 'Vencimento', 'Valor', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PREVIEW_ROWS.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < PREVIEW_ROWS.length - 1 ? '1px solid var(--erp-border)' : undefined, opacity: 0.4 }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{row.supplier}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{row.category}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{row.due}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--erp-text-dim)' }}>{row.value}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ background: 'rgba(251,191,36,0.08)', color: '#fbbf24' }}>Pendente</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col items-center gap-2 py-6">
          <p className="text-xs" style={{ color: 'var(--erp-text-dim)' }}>Lançamentos reais disponíveis após mapeamento dos fornecedores</p>
        </div>
      </Card>
    </div>
  );
}
