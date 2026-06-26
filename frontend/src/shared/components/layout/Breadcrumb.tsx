import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const labels: Record<string, string> = {
  dashboard:        'Dashboard',
  comercial:        'Comercial',
  leads:            'Leads',
  clientes:         'Clientes',
  pipeline:         'Pipeline',
  funil:            'Funil',
  propostas:        'Propostas',
  agenda:           'Agenda',
  followup:         'Follow-up',
  financeiro:       'Financeiro',
  receitas:         'Receitas',
  despesas:         'Despesas',
  'fluxo-caixa':    'Fluxo de Caixa',
  'contas-pagar':   'Contas a Pagar',
  'contas-receber': 'Contas a Receber',
  mensalidades:     'Mensalidades',
  orcamento:        'Orçamento',
  conciliacao:      'Conciliação',
  projecoes:        'Projeções',
  marketing:        'Marketing',
  calendario:       'Calendário',
  posts:            'Posts',
  campanhas:        'Campanhas',
  metricas:         'Métricas',
  ia:               'Inteligência IA',
  chat:             'Chat',
  sugestoes:        'Sugestões',
  insights:         'Insights',
  relatorios:       'Relatórios',
  configuracoes:    'Configurações',
  'site-metrics':   'Métricas do Site',
  financial:        'Financeiro',
  clients:          'Clientes',
  contracts:        'Contratos',
  knowledge:        'Conhecimento',
  reports:          'Relatórios',
  settings:         'Configurações',
};

export function Breadcrumb() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  return (
    <nav className="flex items-center gap-1 text-xs text-slate-500" aria-label="Breadcrumb">
      <Link to="/dashboard" className="hover:text-slate-300 transition-colors">4Core</Link>
      {segments.map((seg, i) => {
        const path = '/' + segments.slice(0, i + 1).join('/');
        const label = labels[seg] ?? seg;
        const isLast = i === segments.length - 1;
        return (
          <span key={path} className="flex items-center gap-1">
            <ChevronRight size={12} className="text-slate-700" />
            {isLast ? (
              <span className="text-slate-300 font-medium">{label}</span>
            ) : (
              <Link to={path} className="hover:text-slate-300 transition-colors">{label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
