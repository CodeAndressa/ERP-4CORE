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
const LOGO_MARK_SRC = '/logo-mark.png';

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
      className="group relative flex h-11 items-center overflow-hidden rounded-2xl text-[13px] font-medium outline-none transition-[background-color,box-shadow,color] duration-200"
      style={{
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: collapsed ? 0 : '12px',
        padding: collapsed ? 0 : '0 14px',
        width: collapsed ? '40px' : '100%',
        marginInline: collapsed ? 'auto' : 0,
        color: active ? '#ffffff' : 'rgba(230,224,247,0.62)',
        background: active ? 'linear-gradient(135deg, #4a2a94 0%, #2b165c 100%)' : 'transparent',
        boxShadow: active ? '0 0 0 1px rgba(155,53,255,0.4), 0 10px 24px -6px rgba(123,0,255,0.5)' : 'none',
      }}
    >
      {!active && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{ background: 'rgba(255,255,255,0.07)' }}
        />
      )}
      <Icon size={18} className="relative z-10 flex-shrink-0 transition-transform duration-200 group-hover:scale-[1.08]" />
      {!collapsed && <span className="relative z-10 truncate">{area.label}</span>}
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
      className="relative hidden flex-shrink-0 flex-col overflow-hidden lg:flex"
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(175deg, #2b165c 0%, #1c0f42 48%, #12081f 100%)',
        borderRight: '1px solid rgba(155,53,255,0.16)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-28 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(123,0,255,0.4) 0%, rgba(123,0,255,0) 70%)', filter: 'blur(6px)' }}
      />

      <div
        className={`relative flex flex-shrink-0 items-center ${sidebarCollapsed ? 'justify-center px-2 py-6' : 'gap-2.5 px-5 py-6'}`}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <img
          src={sidebarCollapsed ? LOGO_MARK_SRC : LOGO_SRC}
          alt="4Core"
          className={sidebarCollapsed ? 'h-8 w-8 object-contain' : 'h-8 w-auto max-w-[150px] object-contain'}
        />
      </div>

      <nav className={`relative flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${sidebarCollapsed ? 'space-y-1.5' : 'space-y-1'}`}>
        {AREAS.map((area) => <AreaButton key={area.path} area={area} collapsed={sidebarCollapsed} />)}
      </nav>

      <button
        onClick={toggleSidebar}
        title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
        aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
        className="absolute -right-3 top-9 z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-transform duration-200 hover:scale-110"
        style={{ background: '#2b165c', border: '1px solid rgba(155,53,255,0.45)', color: '#e6ddff', boxShadow: '0 4px 10px rgba(0,0,0,0.35)' }}
      >
        {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  );
}
