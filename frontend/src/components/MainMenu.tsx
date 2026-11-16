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
      // Raio de 10px, nao 16: item de menu com canto de botao e um dos sinais
      // mais faceis de interface montada sem referencia. O estado ativo e um
      // fundo solido, sem gradiente nem brilho: antes era gradiente mais duas
      // sombras empilhadas, e o resultado competia com o proprio conteudo.
      className="group relative flex h-10 items-center overflow-hidden rounded-[10px] text-sm outline-none transition-colors duration-150"
      style={{
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: collapsed ? 0 : '11px',
        padding: collapsed ? 0 : '0 12px',
        width: collapsed ? '40px' : '100%',
        marginInline: collapsed ? 'auto' : 0,
        fontWeight: active ? 600 : 450,
        color: active ? '#ffffff' : 'rgba(226, 219, 246, 0.70)',
        background: active ? 'var(--erp-sidebar-active)' : 'transparent',
      }}
    >
      {!active && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        />
      )}
      <Icon size={17} className="relative z-10 flex-shrink-0" strokeWidth={active ? 2.2 : 1.8} />
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
      // Os valores vem dos tokens, que ate agora so existiam no DESIGN.md. O
      // degrade ficou de duas paradas e quase imperceptivel: o de tres, com o
      // brilho radial borrado por cima, era decoracao de dashboard, nao marca.
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, var(--erp-sidebar-mid) 0%, var(--erp-sidebar-deep) 100%)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
      }}
    >

      <div
        className={`relative flex flex-shrink-0 ${sidebarCollapsed ? 'flex-col items-center gap-3 px-2 py-5' : 'items-center gap-2.5 px-5 py-6'}`}
      >
        <img
          src={sidebarCollapsed ? LOGO_MARK_SRC : LOGO_SRC}
          alt="4Core"
          className={sidebarCollapsed ? 'h-8 w-8 object-contain' : 'h-8 w-auto max-w-[150px] object-contain'}
        />
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-150 hover:bg-white/15 ${sidebarCollapsed ? '' : 'ml-auto'}`}
          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(226,219,246,0.75)' }}
        >
          {sidebarCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      <nav className="relative flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {!sidebarCollapsed && (
          <p
            className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.16em]"
            style={{ color: 'rgba(226,219,246,0.38)' }}
          >
            Áreas
          </p>
        )}
        <div className={sidebarCollapsed ? 'space-y-1.5' : 'space-y-0.5'}>
          {AREAS.map((area) => <AreaButton key={area.path} area={area} collapsed={sidebarCollapsed} />)}
        </div>
      </nav>
    </motion.aside>
  );
}
