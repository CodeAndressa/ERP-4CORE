import { useState } from 'react';
import { ArrowRight, CheckCircle, Clock, Download, FileText, Kanban, Megaphone, TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader } from '../../shared/components/ui/Card';

interface Report {
  id: number;
  title: string;
  area: string;
  period: string;
  status: 'pronto' | 'atualizando';
  path?: string;
}

const QUICK_REPORTS = [
  { id: 1, label: 'Posição financeira', icon: TrendingUp, path: '/relatorios/financeiros' },
  { id: 2, label: 'Contas a receber', icon: FileText, path: '/financeiro/receita' },
  { id: 3, label: 'Clientes ativos', icon: Users, path: '/comercial/clientes' },
  { id: 4, label: 'Funil de vendas', icon: Kanban, path: '/comercial/pipeline' },
  { id: 5, label: 'Conteúdo publicado', icon: Megaphone, path: '/marketing/posts' },
  { id: 6, label: 'Resumo financeiro', icon: TrendingUp, path: '/relatorios/financeiros' },
];

const SAVED_REPORTS: Report[] = [
  { id: 1, title: 'Resultado gerencial', area: 'Financeiro', period: 'Junho 2026', status: 'pronto', path: '/relatorios/financeiros' },
  { id: 2, title: 'Fluxo de caixa realizado', area: 'Financeiro', period: 'Junho 2026', status: 'pronto', path: '/relatorios/financeiros' },
  { id: 3, title: 'Pipeline comercial', area: 'CRM', period: 'Junho 2026', status: 'pronto', path: '/relatorios/comerciais' },
  { id: 4, title: 'Performance de marketing', area: 'Marketing', period: 'Junho 2026', status: 'atualizando', path: '/marketing/metricas' },
  { id: 5, title: 'Análise de clientes e churn', area: 'CRM', period: 'Maio-Junho 2026', status: 'pronto', path: '/relatorios/comerciais' },
];

export default function RelatoriosOverview() {
  const [exported, setExported] = useState<number[]>([]);

  function handleExport(id: number) {
    setExported((previous) => [...previous, id]);
    setTimeout(() => setExported((previous) => previous.filter((item) => item !== id)), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-violet-100 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">Relatórios</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Inteligência de Gestão</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Consolide indicadores e exporte relatórios para análise executiva.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card padding="lg">
          <CardHeader title="Relatórios rápidos" subtitle="Acesso direto aos módulos" />
          <div className="mt-4 space-y-2">
            {QUICK_REPORTS.map((report) => {
              const Icon = report.icon;
              return (
                <Link key={report.id} to={report.path} className="group flex items-center gap-3 rounded-full border border-violet-100 bg-white px-3 py-3 transition-colors hover:border-violet-200 hover:bg-violet-50/70">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-50">
                    <Icon size={13} className="text-violet-700" />
                  </div>
                  <span className="flex-1 text-sm text-slate-800">{report.label}</span>
                  <ArrowRight size={12} className="text-slate-400 group-hover:text-violet-700" />
                </Link>
              );
            })}
          </div>
        </Card>

        <Card className="lg:col-span-2" padding="lg">
          <CardHeader title="Relatórios salvos" subtitle="Últimos relatórios gerados" />
          <div className="mt-4 space-y-3">
            {SAVED_REPORTS.map((report) => {
              const done = exported.includes(report.id);
              return (
                <div key={report.id} className="flex flex-col gap-3 rounded-[18px] border border-violet-100 bg-white px-4 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-950">{report.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{report.area} · {report.period}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      {report.status === 'pronto' ? <CheckCircle size={12} className="text-emerald-600" /> : <Clock size={12} className="text-amber-600" />}
                      <span className={`text-xs font-medium ${report.status === 'pronto' ? 'text-emerald-700' : 'text-amber-700'}`}>{report.status === 'pronto' ? 'Pronto' : 'Atualizando'}</span>
                    </div>
                    {report.path && <Link to={report.path} className="text-xs font-medium text-violet-700">Abrir</Link>}
                    <button onClick={() => handleExport(report.id)} className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-violet-100 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'}`}>
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
