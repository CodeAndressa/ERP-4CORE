import { Outlet } from 'react-router-dom';
import { SubNav } from '../../shared/components/layout/SubNav';

const TABS = [
  { label: 'Visão Geral', path: '/relatorios'              },
  { label: 'Financeiros', path: '/relatorios/financeiros'  },
  { label: 'Comerciais',  path: '/relatorios/comerciais'   },
];

export default function RelatoriosLayout() {
  return (
    <div>
      <SubNav tabs={TABS} />
      <div className="pt-6">
        <Outlet />
      </div>
    </div>
  );
}
