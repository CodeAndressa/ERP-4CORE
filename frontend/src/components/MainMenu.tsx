import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Megaphone,
  Brain,
  FolderOpen,
  Settings2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useUIStore } from '../core/store/useUIStore';

const LOGO_SRC = '/Logo%20com%20Tipografia%204Core%20-%20Principal%20Transparente.png';

interface AreaItem {
  label: string;
  path: string;
  icon: LucideIcon;
  match: string[];
}

const AREAS: AreaItem[] = [
  { label: 'Visão Geral', path: '/dashboard', icon: LayoutDashboard, match: ['/dashboard', '/site-metrics'] },
  { label: 'Comercial', path: '/comercial', icon: Users, match: ['/comercial', '/clients', '/leads', '/proposals', '/contracts'] },
  { label: 'Financeiro', path: '/financeiro', icon: DollarSign, match: ['/financeiro', '/financial'] },
  { label: 'Marketing', path: '/marketing', icon: Megaphone, match: ['/marketing'] },
  { label: 'IA', path: '/ia', icon: Brain, match: ['/ia', '/ai'] },
  { label: 'Relatórios', path: '/relatorios', icon: FolderOpen, match: ['/relatorios', '/reports'] },
  { label: 'Sistema', path: '/settings', icon: Settings2, match: ['/settings', '/knowledge'] },
];

function isAreaActive(pathname: string, area: AreaItem) {
  return area.match.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function AreaButton({ area, collapsed }: { area: AreaItem; collapsed: boolean }) {
  const { pathname } = useLocation();
  const active = isAreaActive(pathname, area);
  const Icon = area.icon;

  return (
    <NavLink
      to={area.path}
      title={collapsed ? area.label : undefined}
      className={[
        'flex items-center rounded-full text-[13px] font-medium transition-colors',
        collapsed ? 'h-10 w-10 justify-center' : 'h-10 gap-3 px-3.5',
        active ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700',
      ].join(' ')}
    >
      <Icon size={16} className="flex-shrink-0" />
      {!collapsed && <span className="truncate">{area.label}</span>}
    </NavLink>
  );
}

export default function MainMenu() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 64 : 240 }}
      transition={{ type: 'spring', damping: 28, stiffness: 280 }}
      className="relative flex flex-shrink-0 flex-col"
      style={{ minHeight: '100vh', background: 'var(--erp-sidebar-bg)', borderRight: '1px solid var(--erp-border)' }}
    >
      <div className={`flex items-center px-3.5 py-4 ${sidebarCollapsed ? 'justify-center' : 'justify-start'}`} style={{ borderBottom: '1px solid var(--erp-border)' }}>
        <img
          src={LOGO_SRC}
          alt="4Core"
          className={sidebarCollapsed ? 'h-10 w-10 object-contain' : 'h-14 w-full max-w-[190px] object-contain object-left'}
        />
      </div>

      <nav className={`flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${sidebarCollapsed ? 'space-y-1' : 'space-y-1.5'}`}>
        {AREAS.map((area) => <AreaButton key={area.path} area={area} collapsed={sidebarCollapsed} />)}
      </nav>

      <div className="p-2" style={{ borderTop: '1px solid var(--erp-border)' }}>
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          className={`flex h-9 w-full items-center rounded-full text-slate-500 transition-colors hover:bg-violet-50 hover:text-violet-700 ${sidebarCollapsed ? 'justify-center' : 'justify-between px-3'}`}
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <><span className="text-xs">Recolher</span><ChevronLeft size={14} /></>}
        </button>
      </div>
    </motion.aside>
  );
}
