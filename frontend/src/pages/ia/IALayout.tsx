import { Outlet } from 'react-router-dom';
import { Brain, Gauge, MessageSquare, Sparkles } from 'lucide-react';
import { SubNav } from '../../shared/components/layout/SubNav';

const TABS = [
  { label: 'Chat & Insights', path: '/ia/chat', icon: <MessageSquare size={14} /> },
  { label: 'Sugestões', path: '/ia/sugestoes', icon: <Sparkles size={14} /> },
  { label: 'Análises', path: '/ia/analises', icon: <Brain size={14} /> },
  { label: 'Resumos', path: '/ia/resumos', icon: <Gauge size={14} /> },
];

export default function IALayout() {
  return (
    <div>
      <SubNav tabs={TABS} />
      <div className="pt-6">
        <Outlet />
      </div>
    </div>
  );
}
