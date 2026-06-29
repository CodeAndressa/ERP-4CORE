import { Outlet } from 'react-router-dom';
import { Bell, Building2, Calendar, FileText, Kanban, ScrollText, Target, Users } from 'lucide-react';
import { SubNav } from '../../shared/components/layout/SubNav';

const TABS = [
  { label: 'Leads', path: '/comercial/leads', icon: <Users size={14} /> },
  { label: 'Clientes', path: '/comercial/clientes', icon: <Building2 size={14} /> },
  { label: 'Pipeline', path: '/comercial/pipeline', icon: <Kanban size={14} /> },
  { label: 'Funil', path: '/comercial/funil', icon: <Target size={14} /> },
  { label: 'Propostas', path: '/comercial/propostas', icon: <FileText size={14} /> },
  { label: 'Contratos', path: '/comercial/contratos', icon: <ScrollText size={14} /> },
  { label: 'Agenda', path: '/comercial/agenda', icon: <Calendar size={14} /> },
  { label: 'Follow-up', path: '/comercial/followup', icon: <Bell size={14} /> },
];

export default function ComercialLayout() {
  return (
    <div>
      <SubNav tabs={TABS} />
      <div className="pt-6">
        <Outlet />
      </div>
    </div>
  );
}
