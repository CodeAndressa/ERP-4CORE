import { useState } from 'react';
import { Download, FileText, TrendingUp, Users, Kanban, Megaphone, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { Card, CardHeader } from '../../shared/components/ui/Card';
import { Link } from 'react-router-dom';

interface Report {
  id: number;
  title: string;
  area: string;
  period: string;
  status: 'pronto' | 'atualizando';
  path?: string;
}

const QUICK_REPORTS = [
  { id: 1, label: 'Posição financeira',    icon: TrendingUp, path: '/relatorios/financeiros' },
  { id: 2, label: 'Contas a receber',       icon: FileText,   path: '/financeiro/contas-receber' },
  { id: 3, label: 'Clientes ativos',        icon: Users,      path: '/comercial/clientes' },
  { id: 4, label: 'Funil de vendas',        icon: Kanban,     path: '/comercial/pipeline' },
  { id: 5, label: 'Conteúdo publicado',     icon: Megaphone,  path: '/marketing/posts' },
  { id: 6, label: 'Resumo financeiro',      icon: TrendingUp, path: '/relatorios/financeiros' },
];

const SAVED_REPORTS: Report[] = [
  { id: 1, title: 'Resultado gerencial',            area: 'Financeiro', period: 'Junho 2026',  status: 'pronto',       path: '/relatorios/financeiros' },
  { id: 2, title: 'Fluxo de caixa projetado',       area: 'Financeiro', period: 'Julho 2026',  status: 'pronto',       path: '/relatorios/financeiros' },
  { id: 3, title: 'Pipeline comercial',             area: 'CRM',        period: 'Junho 2026',  status: 'pronto',       path: '/relatorios/comerciais' },
  { id: 4, title: 'Performance de marketing',       area: 'Marketing',  period: 'Junho 2026',  status: 'atualizando',  path: '/marketing/metricas' },
  { id: 5, title: 'Análise de clientes e churn',    area: 'CRM',        period: 'Mai–Jun 2026', status: 'pronto',      path: '/relatorios/comerciais' },
];

export default function RelatoriosOverview() {
  const [exported, setExported] = useState<number[]>([]);

  function handleExport(id: number) {
    setExported((prev) => [...prev, id]);
    setTimeout(() => setExported((prev) => prev.filter((x) => x !== id)), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Relatórios</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Inteligência de Gestão</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Consolide indicadores e exporte relatórios para análise executiva</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Quick reports */}
        <Card padding="lg">
          <CardHeader title="Relatórios Rápidos" subtitle="Acesso direto aos módulos" />
          <div className="space-y-2 mt-4">
            {QUICK_REPORTS.map((r) => {
              const Icon = r.icon;
              return (
                <Link
                  key={r.id}
                  to={r.path}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 transition-all group"
                  style={{ border: '1px solid var(--erp-border)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--erp-surface-2)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{ background: 'var(--erp-violet-dim)' }}>
                    <Icon size={13} style={{ color: 'var(--erp-violet-light)' }} />
                  </div>
                  <span className="flex-1 text-sm" style={{ color: 'var(--erp-text)' }}>{r.label}</span>
                  <ArrowRight size={12} style={{ color: 'var(--erp-text-dim)' }} />
                </Link>
              );
            })}
          </div>
        </Card>

        {/* Saved reports */}
        <Card className="lg:col-span-2" padding="lg">
          <CardHeader title="Relatórios Salvos" subtitle="Últimos relatórios gerados" />
          <div className="mt-4 space-y-3">
            {SAVED_REPORTS.map((r) => {
              const done = exported.includes(r.id);
              return (
                <div
                  key={r.id}
                  className="flex flex-col gap-3 rounded-xl px-4 py-3 sm:flex-row sm:items-center"
                  style={{ border: '1px solid var(--erp-border)', background: 'var(--erp-surface-2)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm" style={{ color: 'var(--erp-text)' }}>{r.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--erp-text-muted)' }}>{r.area} · {r.period}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      {r.status === 'pronto'
                        ? <CheckCircle size={12} style={{ color: '#34d399' }} />
                        : <Clock size={12} style={{ color: '#fbbf24' }} />}
                      <span className="text-xs font-medium" style={{ color: r.status === 'pronto' ? '#34d399' : '#fbbf24' }}>
                        {r.status === 'pronto' ? 'Pronto' : 'Atualizando'}
                      </span>
                    </div>
                    {r.path && (
                      <Link to={r.path} className="text-xs font-medium" style={{ color: 'var(--erp-violet-light)' }}>
                        Abrir
                      </Link>
                    )}
                    <button
                      onClick={() => handleExport(r.id)}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-all"
                      style={{
                        background: done ? 'rgba(52,211,153,0.12)' : 'var(--erp-surface)',
                        color: done ? '#34d399' : 'var(--erp-text-muted)',
                        border: '1px solid var(--erp-border)',
                      }}
                    >
                      {done ? <CheckCircle size={11} /> : <Download size={11} />}
                      {done ? 'Exportado' : 'Exportar'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
