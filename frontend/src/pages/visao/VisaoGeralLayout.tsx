import { Outlet } from 'react-router-dom';
import { BarChart3, LayoutDashboard } from 'lucide-react';
import { SubNav } from '../../shared/components/layout/SubNav';

const TABS = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={14} /> },
  { label: 'Métricas do Site', path: '/site-metrics', icon: <BarChart3 size={14} /> },
];

export default function VisaoGeralLayout() {
  return (
    <div>
      <SubNav tabs={TABS} />
      <div className="pt-6">
        <Outlet />
      </div>
    </div>
  );
}
