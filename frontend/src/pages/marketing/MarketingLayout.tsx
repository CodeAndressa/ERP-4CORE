import { Outlet } from 'react-router-dom';
import { BarChart2, CalendarDays, FileEdit, Lightbulb, Megaphone, Target } from 'lucide-react';
import { SubNav } from '../../shared/components/layout/SubNav';

const TABS = [
  { label: 'Calendário', path: '/marketing/calendario', icon: <CalendarDays size={14} /> },
  { label: 'Posts', path: '/marketing/posts', icon: <FileEdit size={14} /> },
  { label: 'Ideias', path: '/marketing/ideias', icon: <Lightbulb size={14} /> },
  { label: 'Métricas', path: '/marketing/metricas', icon: <BarChart2 size={14} /> },
  { label: 'Campanhas', path: '/marketing/campanhas', icon: <Target size={14} /> },
  { label: 'Planejamento', path: '/marketing/planejamento', icon: <Megaphone size={14} /> },
];

export default function MarketingLayout() {
  return (
    <div>
      <SubNav tabs={TABS} />
      <div className="pt-6">
        <Outlet />
      </div>
    </div>
  );
}
