import { Outlet } from 'react-router-dom';
import { BookOpen, Settings2 } from 'lucide-react';
import { SubNav } from '../../shared/components/layout/SubNav';

const TABS = [
  { label: 'Configurações', path: '/settings', icon: <Settings2 size={14} /> },
  { label: 'Conhecimento', path: '/knowledge', icon: <BookOpen size={14} /> },
];

export default function SistemaLayout() {
  return (
    <div>
      <SubNav tabs={TABS} />
      <div className="pt-6">
        <Outlet />
      </div>
    </div>
  );
}
