import { ArrowRight, FileText, Kanban, Megaphone, TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader } from '../../shared/components/ui/Card';

const QUICK_REPORTS = [
  { id: 1, label: 'Posição financeira', icon: TrendingUp, path: '/relatorios/financeiros' },
  { id: 2, label: 'Contas a receber', icon: FileText, path: '/financeiro/receita' },
  { id: 3, label: 'Clientes ativos', icon: Users, path: '/comercial/clientes' },
  { id: 4, label: 'Funil de vendas', icon: Kanban, path: '/comercial/pipeline' },
  { id: 5, label: 'Conteúdo publicado', icon: Megaphone, path: '/marketing/posts' },
];

export default function RelatoriosOverview() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between" style={{ borderColor: 'var(--erp-border)' }}>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--erp-violet-light)' }}>Relatórios</p>
          <h1 className="mt-1 text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Inteligência de Gestão</h1>
          <p className="mt-1 max-w-2xl text-sm" style={{ color: 'var(--erp-text-muted)' }}>Consolide indicadores por área com dados em tempo real.</p>
        </div>
      </div>

      <Card padding="lg">
        <CardHeader title="Relatórios rápidos" subtitle="Acesso direto aos módulos com dado ao vivo" />
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {QUICK_REPORTS.map((report) => {
            const Icon = report.icon;
            return (
              <Link
                key={report.id}
                to={report.path}
                className="group flex items-center gap-3 rounded-full px-3 py-3 transition-colors"
                style={{ border: '1px solid var(--erp-border)', background: 'var(--erp-surface)' }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'var(--erp-violet-dim)' }}>
                  <Icon size={13} style={{ color: 'var(--erp-violet-light)' }} />
                </div>
                <span className="flex-1 text-sm" style={{ color: 'var(--erp-text)' }}>{report.label}</span>
                <ArrowRight size={12} className="transition-colors" style={{ color: 'var(--erp-text-dim)' }} />
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
