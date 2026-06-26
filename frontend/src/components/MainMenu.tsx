import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, BarChart3, Users, Building2, Kanban, FileText, ScrollText,
  Bell, Calendar, DollarSign, TrendingUp, TrendingDown, RefreshCw,
  Megaphone, CalendarDays, FileEdit, Target, Lightbulb, BarChart2, Activity,
  MessageSquare, Sparkles, Brain, Gauge, FolderOpen, Settings2,
  ChevronDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useUIStore } from '../core/store/useUIStore';
import { NotifBadge } from '../shared/components/ui/Badge';

interface MenuItem { label: string; path: string; icon: LucideIcon; badge?: number; }
interface MenuGroup { label: string; items: MenuItem[]; defaultOpen?: boolean; }

const s = {
  visao: 'Vis\u00e3o Geral',
  metricasSite: 'M\u00e9tricas do Site',
  calendario: 'Calend\u00e1rio',
  metricas: 'M\u00e9tricas',
  inteligencia: 'Intelig\u00eancia IA',
  sugestoes: 'Sugest\u00f5es',
  analises: 'An\u00e1lises',
  relatorios: 'Relat\u00f3rios',
  configuracoes: 'Configura\u00e7\u00f5es',
};

const GROUPS: MenuGroup[] = [
  { label: s.visao, defaultOpen: true, items: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: s.metricasSite, path: '/site-metrics', icon: BarChart3 },
  ]},
  { label: 'Comercial', defaultOpen: true, items: [
    { label: 'Leads', path: '/comercial/leads', icon: Users, badge: 0 },
    { label: 'Clientes', path: '/comercial/clientes', icon: Building2 },
    { label: 'Pipeline', path: '/comercial/pipeline', icon: Kanban },
    { label: 'Propostas', path: '/comercial/propostas', icon: FileText, badge: 0 },
    { label: 'Contratos', path: '/contracts', icon: ScrollText },
    { label: 'Follow-up', path: '/comercial/followup', icon: Bell },
    { label: 'Agenda', path: '/comercial/agenda', icon: Calendar },
  ]},
  { label: 'Financeiro', defaultOpen: false, items: [
    { label: s.visao, path: '/financeiro', icon: DollarSign },
    { label: 'Receita', path: '/financeiro/receita', icon: TrendingUp },
    { label: 'Custos Fixos', path: '/financeiro/custos-fixos', icon: TrendingDown },
    { label: 'Custos Recorrentes', path: '/financeiro/custos-recorrentes', icon: RefreshCw },
  ]},
  { label: 'Marketing', defaultOpen: false, items: [
    { label: s.calendario, path: '/marketing/calendario', icon: CalendarDays },
    { label: 'Posts', path: '/marketing/posts', icon: FileEdit },
    { label: 'Campanhas', path: '/marketing/campanhas', icon: Target },
    { label: 'Ideias', path: '/marketing/ideias', icon: Lightbulb },
    { label: s.metricas, path: '/marketing/metricas', icon: BarChart2 },
    { label: 'Performance', path: '/marketing/performance', icon: Activity },
    { label: 'Planejamento', path: '/marketing/planejamento', icon: Megaphone },
  ]},
  { label: s.inteligencia, defaultOpen: false, items: [
    { label: 'Chat & Insights', path: '/ia/chat', icon: MessageSquare },
    { label: s.sugestoes, path: '/ia/sugestoes', icon: Sparkles },
    { label: s.analises, path: '/ia/analises', icon: Brain },
    { label: 'Resumos', path: '/ia/resumos', icon: Gauge },
  ]},
  { label: s.relatorios, defaultOpen: false, items: [
    { label: s.visao, path: '/relatorios', icon: FolderOpen },
    { label: 'Financeiros', path: '/relatorios/financeiros', icon: TrendingUp },
    { label: 'Comerciais', path: '/relatorios/comerciais', icon: Target },
  ]},
  { label: 'Sistema', defaultOpen: false, items: [
    { label: s.configuracoes, path: '/settings', icon: Settings2 },
  ]},
];

function SidebarGroup({ group, collapsed }: { group: MenuGroup; collapsed: boolean }) {
  const { pathname } = useLocation();
  const hasActive = group.items.some((item) => pathname === item.path || pathname.startsWith(item.path + '/'));
  const [open, setOpen] = useState(group.defaultOpen || hasActive);

  if (collapsed) {
    return <div className="mb-1 flex flex-col items-center gap-1">{group.items.slice(0, 3).map((item) => <CollapsedItem key={item.path} item={item} />)}</div>;
  }

  return (
    <div className="mb-2">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-3 py-1.5 text-left">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--erp-text-dim)' }}>{group.label}</span>
        <ChevronDown size={11} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--erp-text-dim)' }} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: 'easeInOut' }} className="overflow-hidden">
            <div className="space-y-1 pb-1 pt-0.5">{group.items.map((item) => <ExpandedItem key={item.path} item={item} />)}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExpandedItem({ item }: { item: MenuItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => [
        'flex items-center gap-2.5 rounded-full px-3.5 py-2 text-[13px] transition-all duration-150',
        isActive ? 'bg-violet-600 text-white font-semibold' : 'text-slate-600 hover:bg-white hover:text-violet-700',
      ].join(' ')}
    >
      <Icon size={14} className="flex-shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge != null && item.badge > 0 && <NotifBadge count={item.badge} />}
    </NavLink>
  );
}

function CollapsedItem({ item }: { item: MenuItem }) {
  const { pathname } = useLocation();
  const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
  const Icon = item.icon;
  return (
    <NavLink to={item.path} title={item.label} className={['relative flex h-9 w-9 items-center justify-center rounded-full transition-all', isActive ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-white hover:text-violet-700'].join(' ')}>
      <Icon size={15} />
      {item.badge != null && item.badge > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-violet-600 text-[8px] font-bold text-white">{item.badge}</span>}
    </NavLink>
  );
}

export default function MainMenu() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  return (
    <motion.aside initial={false} animate={{ width: sidebarCollapsed ? 64 : 240 }} transition={{ type: 'spring', damping: 28, stiffness: 280 }} className="relative flex flex-shrink-0 flex-col" style={{ minHeight: '100vh', background: 'var(--erp-sidebar-bg)', borderRight: '1px solid var(--erp-border)' }}>
      <div className={`flex items-center px-3.5 py-4 ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`} style={{ borderBottom: '1px solid var(--erp-border)' }}>
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-violet-600"><span className="text-xs font-bold text-white">4C</span></div>
        <AnimatePresence>{!sidebarCollapsed && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden"><p className="whitespace-nowrap text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>4Core</p><p className="whitespace-nowrap text-[10px]" style={{ color: 'var(--erp-text-muted)' }}>ERP Inteligente</p></motion.div>}</AnimatePresence>
      </div>
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{GROUPS.map((group) => <SidebarGroup key={group.label} group={group} collapsed={sidebarCollapsed} />)}</nav>
      <div className="p-2" style={{ borderTop: '1px solid var(--erp-border)' }}><button onClick={toggleSidebar} title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'} className={`flex h-9 w-full items-center rounded-full text-slate-500 transition-colors hover:bg-white hover:text-violet-700 ${sidebarCollapsed ? 'justify-center' : 'justify-between px-3'}`}>{sidebarCollapsed ? <ChevronRight size={14} /> : <><span className="text-xs">Recolher</span><ChevronLeft size={14} /></>}</button></div>
    </motion.aside>
  );
}
