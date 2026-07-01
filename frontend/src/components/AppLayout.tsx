import { useEffect, useRef, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Bell, Sparkles, LogOut, Command, BarChart3, BookOpen, Brain, Building2, Calendar, CalendarDays, DollarSign, FileText, FolderOpen, Gauge, Kanban, LayoutDashboard, Lightbulb, Megaphone, MessageSquare, ScrollText, Settings2, Target, Users } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import MainMenu from './MainMenu';
import { AIDrawer } from '../shared/components/ai/AIDrawer';
import { useUIStore } from '../core/store/useUIStore';
import { useAuthStore } from '../core/store/useAuthStore';

const t = {
  modulos: 'M\u00f3dulos',
  visao: 'Vis\u00e3o Geral',
  metricas: 'M\u00e9tricas',
  metricasSite: 'M\u00e9tricas do Site',
  calendario: 'Calend\u00e1rio',
  inteligencia: 'Intelig\u00eancia IA',
  sugestoes: 'Sugest\u00f5es',
  relatorios: 'Relat\u00f3rios',
  configuracoes: 'Configura\u00e7\u00f5es',
  orcamentos: 'or\u00e7amentos',
  acoes: 'a\u00e7\u00f5es',
  resultados: 'Nenhum resultado',
};


type HeaderTab = { label: string; path: string; icon: JSX.Element };

const HEADER_TABS: { match: string[]; tabs: HeaderTab[] }[] = [
  {
    match: ['/dashboard', '/site-metrics'],
    tabs: [
      { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={14} /> },
      { label: 'Métricas do Site', path: '/site-metrics', icon: <BarChart3 size={14} /> },
    ],
  },
  {
    match: ['/comercial', '/clients', '/leads', '/proposals', '/contracts'],
    tabs: [
      { label: 'Funil', path: '/comercial/funil', icon: <Target size={14} /> },
      { label: 'Leads', path: '/comercial/leads', icon: <Users size={14} /> },
      { label: 'Pipeline', path: '/comercial/pipeline', icon: <Kanban size={14} /> },
      { label: 'Propostas', path: '/comercial/propostas', icon: <FileText size={14} /> },
      { label: 'Clientes', path: '/comercial/clientes', icon: <Building2 size={14} /> },
      { label: 'Contratos', path: '/comercial/contratos', icon: <ScrollText size={14} /> },
      { label: 'Agenda', path: '/comercial/agenda', icon: <Calendar size={14} /> },
      { label: 'Follow-up', path: '/comercial/followup', icon: <Bell size={14} /> },
    ],
  },
  {
    match: ['/financeiro', '/financial'],
    tabs: [
      { label: 'Visão Geral', path: '/financeiro', icon: <DollarSign size={14} /> },
      { label: 'Receita', path: '/financeiro/receita', icon: <BarChart3 size={14} /> },
      { label: 'Custos', path: '/financeiro/custos', icon: <FileText size={14} /> },
    ],
  },
  {
    match: ['/marketing'],
    tabs: [
      { label: 'Calendário', path: '/marketing/calendario', icon: <CalendarDays size={14} /> },
      { label: 'Posts', path: '/marketing/posts', icon: <FileText size={14} /> },
      { label: 'Ideias', path: '/marketing/ideias', icon: <Lightbulb size={14} /> },
      { label: 'Métricas', path: '/marketing/metricas', icon: <BarChart3 size={14} /> },
      { label: 'Campanhas', path: '/marketing/campanhas', icon: <Target size={14} /> },
      { label: 'Planejamento', path: '/marketing/planejamento', icon: <Megaphone size={14} /> },
    ],
  },
  {
    match: ['/ia', '/ai'],
    tabs: [
      { label: 'Chat & Insights', path: '/ia/chat', icon: <MessageSquare size={14} /> },
      { label: 'Sugestões', path: '/ia/sugestoes', icon: <Sparkles size={14} /> },
      { label: 'Análises', path: '/ia/analises', icon: <Brain size={14} /> },
      { label: 'Resumos', path: '/ia/resumos', icon: <Gauge size={14} /> },
    ],
  },
  {
    match: ['/relatorios', '/reports'],
    tabs: [
      { label: 'Visão Geral', path: '/relatorios', icon: <FolderOpen size={14} /> },
      { label: 'Financeiros', path: '/relatorios/financeiros', icon: <DollarSign size={14} /> },
      { label: 'Comerciais', path: '/relatorios/comerciais', icon: <Target size={14} /> },
    ],
  },
  {
    match: ['/settings', '/knowledge'],
    tabs: [
      { label: 'Configurações', path: '/settings', icon: <Settings2 size={14} /> },
      { label: 'Conhecimento', path: '/knowledge', icon: <BookOpen size={14} /> },
    ],
  },
];

const MOBILE_AREAS = [
  { label: 'Visão', path: '/dashboard', icon: <LayoutDashboard size={17} /> },
  { label: 'Comerc.', path: '/comercial/funil', icon: <Users size={17} /> },
  { label: 'Fin.', path: '/financeiro', icon: <DollarSign size={17} /> },
  { label: 'Mkt', path: '/marketing/calendario', icon: <Megaphone size={17} /> },
  { label: 'IA', path: '/ia/chat', icon: <Brain size={17} /> },
  { label: 'Relat.', path: '/relatorios', icon: <FolderOpen size={17} /> },
  { label: 'Sist.', path: '/settings', icon: <Settings2 size={17} /> },
];

function MobileBottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 px-1 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-1.5 backdrop-blur-xl lg:hidden" style={{ borderColor: 'var(--erp-border)' }} aria-label="Navegação principal">
      <div className="grid grid-cols-7 gap-0.5">
        {MOBILE_AREAS.map((item) => {
          const active = pathname === item.path || pathname.startsWith(`${item.path.split('/').slice(0, 2).join('/')}/`);
          return (
            <NavLink key={item.path} to={item.path} className="flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[9px] font-semibold" style={{ background: active ? 'var(--erp-violet)' : 'transparent', color: active ? '#fff' : 'var(--erp-text-muted)' }}>
              {item.icon}
              <span className="leading-none">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
function getHeaderTabs(pathname: string) {
  return HEADER_TABS.find((group) => group.match.some((path) => pathname === path || pathname.startsWith(`${path}/`)))?.tabs ?? [];
}

function HeaderAreaNav({ pathname }: { pathname: string }) {
  const tabs = getHeaderTabs(pathname);
  if (!tabs.length) return <div />;

  return (
    <nav className="min-w-0 flex-1 overflow-x-auto px-0.5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Navegação da área">
      <div className="inline-flex min-w-max items-center gap-1 rounded-2xl border bg-white/90 p-1 shadow-[0_10px_28px_rgba(43,22,92,0.08)] backdrop-blur-xl" style={{ borderColor: 'var(--erp-border)' }}>
        {tabs.map((tab) => {
          const active = pathname === tab.path || (tab.path !== '/financeiro' && tab.path !== '/relatorios' && pathname.startsWith(`${tab.path}/`));
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-all sm:h-8 sm:gap-2"
              style={{
                background: active ? 'linear-gradient(135deg, #2b165c 0%, #3f2479 100%)' : 'transparent',
                color: active ? '#fff' : 'var(--erp-text-muted)',
                boxShadow: active ? '0 8px 18px rgba(43,22,92,0.20)' : 'none',
              }}
            >
              {tab.icon}
              {tab.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
const COMMANDS = [
  { group: t.modulos, label: 'Dashboard', path: '/dashboard', keys: 'dashboard visao geral' },
  { group: 'Comercial', label: 'Leads', path: '/comercial/leads', keys: 'leads oportunidades comercial' },
  { group: 'Comercial', label: 'Clientes', path: '/comercial/clientes', keys: 'clientes empresas' },
  { group: 'Comercial', label: 'Pipeline', path: '/comercial/pipeline', keys: 'pipeline kanban funil' },
  { group: 'Comercial', label: 'Propostas', path: '/comercial/propostas', keys: `propostas ${t.orcamentos}` },
  { group: 'Financeiro', label: t.visao, path: '/financeiro', keys: 'financeiro controle caixa' },
  { group: 'Financeiro', label: 'Receita', path: '/financeiro/receita', keys: 'receita entradas asaas' },
  { group: 'Financeiro', label: 'Custos', path: '/financeiro/custos', keys: 'custos fixos recorrentes despesas mensalidades contas pagar' },
  { group: 'Marketing', label: t.calendario, path: '/marketing/calendario', keys: 'calendario editorial posts' },
  { group: 'Marketing', label: 'Campanhas', path: '/marketing/campanhas', keys: 'campanhas marketing' },
  { group: 'Marketing', label: t.metricas, path: '/marketing/metricas', keys: 'performance metricas analytics' },
  { group: 'IA', label: 'Chat com IA', path: '/ia/chat', keys: 'chat ia inteligencia assistente' },
  { group: 'IA', label: 'Insights IA', path: '/ia/sugestoes', keys: 'insights sugestoes recomendacoes' },
  { group: 'Sistema', label: t.relatorios, path: '/reports', keys: 'relatorios reports pdf' },
  { group: 'Sistema', label: t.configuracoes, path: '/settings', keys: 'configuracoes settings' },
  { group: 'Sistema', label: t.metricasSite, path: '/site-metrics', keys: 'site metricas analytics' },
];

function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = query.trim()
    ? COMMANDS.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()) || c.keys.toLowerCase().includes(query.toLowerCase()))
    : COMMANDS.slice(0, 8);

  useEffect(() => { setActiveIndex(0); }, [query]);

  const go = (path: string) => { navigate(path); onClose(); };
  const grouped = filtered.reduce<Record<string, typeof COMMANDS>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((i) => Math.min(i + 1, filtered.length - 1)); }
      if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
      if (event.key === 'Enter') { event.preventDefault(); if (filtered[activeIndex]) go(filtered[activeIndex].path); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filtered, activeIndex]);

  let globalIndex = 0;

  return (
    <motion.div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[15vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-violet-950/10 backdrop-blur-[2px]" onClick={onClose} />
      <motion.div className="relative w-full max-w-lg overflow-hidden rounded-[22px] bg-white" style={{ border: '1px solid var(--erp-border-strong)' }} initial={{ y: -16, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: -12, scale: 0.97 }} transition={{ type: 'spring', duration: 0.25 }}>
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid var(--erp-border)' }}>
          <Search size={16} className="flex-shrink-0" style={{ color: 'var(--erp-text-muted)' }} />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Buscar ${t.modulos.toLowerCase()}, ${t.acoes}...`} className="flex-1 bg-transparent text-sm outline-none" style={{ color: 'var(--erp-text)' }} />
          <kbd className="hidden rounded-full px-2 py-0.5 text-[10px] sm:block" style={{ border: '1px solid var(--erp-border)', background: 'var(--erp-surface-2)', color: 'var(--erp-text-muted)' }}>ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-2 [scrollbar-width:none]">
          {filtered.length === 0 ? <p className="py-8 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>{t.resultados}</p> : Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--erp-text-dim)' }}>{group}</p>
              {items.map((cmd) => {
                const isActive = globalIndex++ === activeIndex;
                return <button key={cmd.path} onClick={() => go(cmd.path)} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors" style={{ background: isActive ? 'var(--erp-violet-dim)' : 'transparent', color: isActive ? 'var(--erp-text)' : 'var(--erp-text-muted)' }}><Command size={13} className="flex-shrink-0" style={{ color: 'var(--erp-text-dim)' }} />{cmd.label}{isActive && <kbd className="ml-auto text-[10px]" style={{ color: 'var(--erp-text-dim)' }}>Enter</kbd>}</button>;
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 px-4 py-2.5 text-[10px]" style={{ borderTop: '1px solid var(--erp-border)', color: 'var(--erp-text-dim)' }}><span>Setas para navegar</span><span>Enter para selecionar</span><span>ESC para fechar</span></div>
      </motion.div>
    </motion.div>
  );
}

function pageTitle(pathname: string): string {
  const map: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/site-metrics': t.metricasSite,
    '/comercial/leads': 'Leads',
    '/comercial/clientes': 'Clientes',
    '/comercial/pipeline': 'Pipeline',
    '/comercial/propostas': 'Propostas',
    '/comercial/followup': 'Follow-up',
    '/comercial/agenda': 'Agenda',
    '/financeiro': 'Financeiro',
    '/financeiro/receita': 'Receita',
    '/financeiro/custos': 'Custos',
    '/financeiro/custos-fixos': 'Custos',
    '/financeiro/custos-recorrentes': 'Custos',
    '/marketing/calendario': t.calendario,
    '/marketing/campanhas': 'Campanhas',
    '/marketing/metricas': t.metricas,
    '/ia/chat': 'Chat com IA',
    '/reports': t.relatorios,
    '/settings': t.configuracoes,
    '/financial': 'Financeiro',
    '/clients': 'Clientes',
    '/leads': 'Leads',
    '/marketing': 'Marketing',
    '/contracts': 'Contratos',
    '/knowledge': 'Conhecimento',
    '/ai': 'Assistente IA',
    '/proposals': 'Propostas',
  };
  return map[pathname] ?? '4Core';
}

export default function AppLayout() {
  const { commandOpen, openCommand, closeCommand, openAIDrawer } = useUIStore();
  const { token, initialized, fetchMe, logout } = useAuthStore();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const title = pageTitle(pathname);

  useEffect(() => {
    if (!initialized) fetchMe();
  }, [initialized, fetchMe]);

  useEffect(() => {
    if (initialized && !token) navigate('/login', { replace: true });
  }, [initialized, token, navigate]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        commandOpen ? closeCommand() : openCommand();
      }
      if (event.key === 'Escape') closeCommand();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commandOpen]);

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f7fb] text-sm text-slate-500">
        Carregando acesso...
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--erp-bg)', color: 'var(--erp-text)' }}>
      <MainMenu />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-14 items-center gap-2 px-3 py-2 backdrop-blur-2xl sm:gap-4 sm:px-5" style={{ background: 'var(--erp-header-bg)', borderBottom: '1px solid var(--erp-border)' }}>
          <HeaderAreaNav pathname={pathname} />
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button onClick={openCommand} className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs transition sm:flex" style={{ border: '1px solid var(--erp-border)', background: '#fff', color: 'var(--erp-text-muted)' }}><Search size={13} /><span>Buscar</span><kbd className="ml-1 rounded-full px-1.5 py-0.5 text-[10px]" style={{ border: '1px solid var(--erp-border)', background: 'var(--erp-surface-2)', color: 'var(--erp-text-muted)' }}>Ctrl K</kbd></button>
            <button onClick={() => openAIDrawer(title)} className="hidden items-center gap-1.5 rounded-full border border-violet-500/25 bg-white px-3 py-1.5 text-xs font-semibold text-violet-600 transition hover:bg-violet-50 sm:flex"><Sparkles size={13} /><span className="hidden sm:inline">Analisar com IA</span></button>
            <button className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white transition-colors" style={{ color: 'var(--erp-text-muted)', border: '1px solid var(--erp-border)' }}><Bell size={16} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-violet-500" /></button>
            <button onClick={logout} className="flex h-8 w-8 items-center justify-center rounded-full bg-white transition-colors hover:text-violet-600" style={{ color: 'var(--erp-text-muted)', border: '1px solid var(--erp-border)' }} title="Sair"><LogOut size={15} /></button>
          </div>
        </header>
        <main className="flex-1 overflow-auto"><div className="px-3 pb-28 pt-4 sm:p-6 lg:p-8"><Outlet /></div></main>
      </div>
      <MobileBottomNav pathname={pathname} />
      <AIDrawer />
      <AnimatePresence>{commandOpen && <CommandPalette onClose={closeCommand} />}</AnimatePresence>
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#fff', color: 'var(--erp-text)', border: '1px solid var(--erp-border)', borderRadius: '18px', fontSize: '13px' } }} />
    </div>
  );
}
