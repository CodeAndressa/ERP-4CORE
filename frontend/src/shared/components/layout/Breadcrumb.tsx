import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const labels: Record<string, string> = {
  dashboard: 'Dashboard',
  comercial: 'Comercial',
  leads: 'Leads',
  clientes: 'Clientes',
  pipeline: 'Pipeline',
  funil: 'Funil',
  propostas: 'Propostas',
  agenda: 'Agenda',
  followup: 'Follow-up',
  financeiro: 'Financeiro',
  receita: 'Receita',
  receitas: 'Receita',
  'custos-fixos': 'Custos Fixos',
  'custos-recorrentes': 'Custos Recorrentes',
  marketing: 'Marketing',
  calendario: 'Calendário',
  posts: 'Posts',
  campanhas: 'Campanhas',
  metricas: 'Métricas',
  ia: 'Inteligência IA',
  chat: 'Chat',
  sugestoes: 'Sugestões',
  insights: 'Insights',
  relatorios: 'Relatórios',
  configuracoes: 'Configurações',
  'site-metrics': 'Métricas do Site',
  financial: 'Financeiro',
  clients: 'Clientes',
  contracts: 'Contratos',
  knowledge: 'Conhecimento',
  reports: 'Relatórios',
  settings: 'Configurações',
};

export function Breadcrumb() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  return (
    <nav className="flex min-w-0 items-center gap-1 truncate text-sm text-slate-500" aria-label="Breadcrumb">
      <Link to="/dashboard" className="transition-colors hover:text-violet-700">4Core</Link>
      {segments.map((seg, i) => {
        const path = '/' + segments.slice(0, i + 1).join('/');
        const label = labels[seg] ?? seg;
        const isLast = i === segments.length - 1;
        return (
          <span key={path} className="flex min-w-0 items-center gap-1">
            <ChevronRight size={12} className="text-slate-300" />
            {isLast ? (
              <span className="truncate text-base font-semibold text-slate-900">{label}</span>
            ) : (
              <Link to={path} className="transition-colors hover:text-violet-700">{label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
