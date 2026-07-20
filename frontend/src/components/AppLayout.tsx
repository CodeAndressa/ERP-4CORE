import { Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Bell, Sparkles, LogOut, Command, BarChart3, BookOpen, Brain, Building2, Calendar, CalendarDays, ChevronDown, DollarSign, FileText, FolderOpen, Gauge, Kanban, LayoutDashboard, Lightbulb, Megaphone, MessageCircle, MessageSquare, MoreHorizontal, ScrollText, Settings2, Target, Users, WalletCards } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import MainMenu from './MainMenu';
import { NotificationsMenu } from './NotificationsMenu';
import { AIDrawer } from '../shared/components/ai/AIDrawer';
import { useUIStore } from '../core/store/useUIStore';
import { useAuthStore } from '../core/store/useAuthStore';

const t = {
  modulos: 'Módulos',
  visao: 'Visão Geral',
  metricas: 'Métricas',
  metricasSite: 'Métricas do Site',
  calendario: 'Calendário',
  inteligencia: 'Inteligência IA',
  sugestoes: 'Sugestões',
  relatorios: 'Relatórios',
  configuracoes: 'Configurações',
  orcamentos: 'orçamentos',
  acoes: 'ações',
  resultados: 'Nenhum resultado',
};

type HeaderTab = { label: string; path: string; icon: JSX.Element };

const HEADER_TABS: { match: string[]; tabs: HeaderTab[]; overflow?: HeaderTab[] }[] = [
  {
    match: ['/dashboard', '/site-metrics'],
    tabs: [
      { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={14} /> },
      { label: 'Métricas do Site', path: '/site-metrics', icon: <BarChart3 size={14} /> },
    ],
  },
  {
    // Grupo principal segue o mesmo fluxo operacional nomeado no PRODUCT.md
    // (Leads, Pipeline, Follow-up, Agenda, Funil); destinos de referência/ocasionais
    // ficam no overflow para não estourar o limite de itens visíveis por vez.
    match: ['/comercial', '/clients', '/leads', '/proposals', '/contracts'],
    tabs: [
      { label: 'Leads', path: '/comercial/leads', icon: <Users size={14} /> },
      { label: 'Pipeline', path: '/comercial/pipeline', icon: <Kanban size={14} /> },
      { label: 'Follow-up', path: '/comercial/followup', icon: <Bell size={14} /> },
      { label: 'Agenda', path: '/comercial/agenda', icon: <Calendar size={14} /> },
      { label: 'Funil', path: '/comercial/funil', icon: <Target size={14} /> },
    ],
    overflow: [
      { label: 'Propostas', path: '/comercial/propostas', icon: <FileText size={14} /> },
      { label: 'Clientes', path: '/comercial/clientes', icon: <Building2 size={14} /> },
      { label: 'Contratos', path: '/comercial/contratos', icon: <ScrollText size={14} /> },
    ],
  },
  {
    match: ['/financeiro', '/financial'],
    tabs: [
      { label: 'Visão Geral', path: '/financeiro', icon: <DollarSign size={14} /> },
      { label: 'Cobranças', path: '/financeiro/cobrancas', icon: <WalletCards size={14} /> },
      { label: 'Receita', path: '/financeiro/receita', icon: <BarChart3 size={14} /> },
      { label: 'Custos', path: '/financeiro/custos', icon: <FileText size={14} /> },
    ],
  },
  {
    // Mensagens é a tela padrão de marketing; Estúdio fica no overflow por enquanto.
    match: ['/marketing'],
    tabs: [
      { label: 'Mensagens', path: '/marketing/mensagens', icon: <MessageCircle size={14} /> },
      { label: 'Métricas', path: '/marketing/metricas', icon: <BarChart3 size={14} /> },
      { label: 'Calendário', path: '/marketing/calendario', icon: <CalendarDays size={14} /> },
      { label: 'Posts', path: '/marketing/posts', icon: <FileText size={14} /> },
    ],
    overflow: [
      { label: 'Estúdio', path: '/marketing/estudio', icon: <Sparkles size={14} /> },
      { label: 'Ideias', path: '/marketing/ideias', icon: <Lightbulb size={14} /> },
      { label: 'Campanhas', path: '/marketing/campanhas', icon: <Target size={14} /> },
      { label: 'Planejamento', path: '/marketing/planejamento', icon: <Megaphone size={14} /> },
      { label: 'Conexões', path: '/marketing/conexoes', icon: <Settings2 size={14} /> },
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

const MOBILE_PRIMARY = [
  { label: 'Visão', path: '/dashboard', icon: <LayoutDashboard size={19} />, match: ['/dashboard', '/site-metrics'] },
  { label: 'Comercial', path: '/comercial/leads', icon: <Users size={19} />, match: ['/comercial', '/clients', '/leads', '/proposals', '/contracts'] },
  { label: 'Financeiro', path: '/financeiro', icon: <DollarSign size={19} />, match: ['/financeiro', '/financial'] },
  { label: 'Marketing', path: '/marketing/mensagens', icon: <Megaphone size={19} />, match: ['/marketing'] },
];

const MOBILE_MORE = [
  { label: 'IA', path: '/ia/chat', icon: <Brain size={18} />, match: ['/ia', '/ai'] },
  { label: 'Relatórios', path: '/relatorios', icon: <FolderOpen size={18} />, match: ['/relatorios', '/reports'] },
  { label: 'Sistema', path: '/settings', icon: <Settings2 size={18} />, match: ['/settings', '/knowledge'] },
];

function pathActive(pathname: string, match: string[]) {
  return match.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-2">
      <div className="h-4 w-4 animate-spin rounded-full border-2" style={{ borderColor: 'var(--erp-border)', borderTopColor: 'var(--erp-violet)' }} />
      <span className="text-sm" style={{ color: 'var(--erp-text-muted)' }}>Carregando...</span>
    </div>
  );
}

function MobileBottomNav({ pathname }: { pathname: string }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MOBILE_MORE.some((item) => pathActive(pathname, item.match));

  useEffect(() => { setMoreOpen(false); }, [pathname]);

  return (
    <>
      <AnimatePresence>
        {moreOpen && (
          <motion.div className="fixed inset-0 z-40 bg-violet-950/12 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMoreOpen(false)}>
            <motion.div
              className="absolute inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] rounded-2xl border bg-white p-2 shadow-[0_18px_45px_rgba(43,22,92,0.18)]"
              style={{ borderColor: 'var(--erp-border)' }}
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="grid gap-1.5">
                {MOBILE_MORE.map((item) => {
                  const active = pathActive(pathname, item.match);
                  return (
                    <NavLink key={item.path} to={item.path} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold" style={{ background: active ? 'var(--erp-violet-dim)' : 'transparent', color: active ? 'var(--erp-violet)' : 'var(--erp-text)' }}>
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: active ? 'var(--erp-violet)' : 'var(--erp-surface-2)', color: active ? '#fff' : 'var(--erp-text-muted)' }}>{item.icon}</span>
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-white/95 px-2 pt-1.5 backdrop-blur-xl lg:hidden" style={{ borderColor: 'var(--erp-border)', paddingBottom: 'max(0.45rem, env(safe-area-inset-bottom))' }} aria-label="Navegação principal">
        <div className="grid grid-cols-5 gap-1">
          {MOBILE_PRIMARY.map((item) => {
            const active = pathActive(pathname, item.match);
            return (
              <NavLink key={item.path} to={item.path} className="flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold" style={{ background: active ? 'var(--erp-violet)' : 'transparent', color: active ? '#fff' : 'var(--erp-text-muted)' }}>
                {item.icon}
                <span className="max-w-full truncate leading-none">{item.label}</span>
              </NavLink>
            );
          })}
          <button type="button" onClick={() => setMoreOpen((value) => !value)} className="flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold" style={{ background: moreOpen || moreActive ? 'var(--erp-violet)' : 'transparent', color: moreOpen || moreActive ? '#fff' : 'var(--erp-text-muted)' }}>
            <MoreHorizontal size={19} />
            <span className="leading-none">Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}

function getHeaderGroup(pathname: string) {
  return HEADER_TABS.find((group) => group.match.some((path) => pathname === path || pathname.startsWith(`${path}/`)));
}

function isTabActive(pathname: string, tab: HeaderTab) {
  return pathname === tab.path || (tab.path !== '/financeiro' && tab.path !== '/relatorios' && pathname.startsWith(`${tab.path}/`));
}

function HeaderOverflowMenu({ pathname, tabs }: { pathname: string; tabs: HeaderTab[] }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const active = tabs.some((tab) => isTabActive(pathname, tab));

  function positionMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 208;
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)),
      top: rect.bottom + 6,
    });
  }

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    const reposition = () => positionMenu();
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!open) positionMenu();
          setOpen((value) => !value);
        }}
        className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition-colors sm:min-h-8 sm:rounded-xl"
        style={{ background: active ? 'var(--erp-violet)' : 'transparent', color: active ? '#fff' : 'var(--erp-text-muted)' }}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Mais
        <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-50 w-52 rounded-xl border bg-white p-1"
          style={{ left: position.left, top: position.top, borderColor: 'var(--erp-border)', boxShadow: '0 6px 8px rgba(43,22,92,0.14)' }}
        >
          {tabs.map((tab) => {
            const tabActive = isTabActive(pathname, tab);
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors"
                style={{ background: tabActive ? 'var(--erp-violet-dim)' : 'transparent', color: tabActive ? 'var(--erp-violet)' : 'var(--erp-text)' }}
              >
                {tab.icon}
                {tab.label}
              </NavLink>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}

function HeaderAreaNav({ pathname }: { pathname: string }) {
  const group = getHeaderGroup(pathname);
  if (!group?.tabs.length) return <div />;

  return (
    <nav className="min-w-0 flex-1 overflow-x-auto px-0.5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Navegação da área">
      <div className="inline-flex min-w-max items-center gap-1 rounded-xl border bg-white/90 p-1 backdrop-blur-xl sm:rounded-2xl" style={{ borderColor: 'var(--erp-border)' }}>
        {group.tabs.map((tab) => {
          const active = isTabActive(pathname, tab);
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors sm:min-h-8 sm:gap-2 sm:rounded-xl"
              style={{ background: active ? 'var(--erp-violet)' : 'transparent', color: active ? '#fff' : 'var(--erp-text-muted)' }}
            >
              {tab.icon}
              {tab.label}
            </NavLink>
          );
        })}
        {group.overflow?.length ? <HeaderOverflowMenu pathname={pathname} tabs={group.overflow} /> : null}
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
  { group: 'Financeiro', label: 'Cobranças', path: '/financeiro/cobrancas', keys: 'cobrancas recebidas confirmadas pendentes vencidas assinaturas avulsas' },
  { group: 'Financeiro', label: 'Receita', path: '/financeiro/receita', keys: 'receita entradas asaas' },
  { group: 'Financeiro', label: 'Custos', path: '/financeiro/custos', keys: 'custos fixos recorrentes despesas mensalidades contas pagar' },
  { group: 'Marketing', label: t.calendario, path: '/marketing/calendario', keys: 'calendario editorial posts' },
  { group: 'Marketing', label: 'Estúdio de conteúdo', path: '/marketing/estudio', keys: 'criar arte aprovar agendar instagram' },
  { group: 'Marketing', label: 'Mensagens', path: '/marketing/mensagens', keys: 'mensagens dm direct instagram responder' },
  { group: 'Marketing', label: 'Campanhas', path: '/marketing/campanhas', keys: 'campanhas marketing' },
  { group: 'Marketing', label: t.metricas, path: '/marketing/metricas', keys: 'performance metricas analytics' },
  { group: 'IA', label: 'Chat com IA', path: '/ia/chat', keys: 'chat ia inteligencia assistente' },
  { group: 'IA', label: 'Insights IA', path: '/ia/sugestoes', keys: 'insights sugestoes recomendacoes' },
  { group: 'Sistema', label: t.relatorios, path: '/relatorios', keys: 'relatorios reports pdf' },
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
    <motion.div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh] sm:pt-[15vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-violet-950/10 backdrop-blur-[2px]" onClick={onClose} />
      <motion.div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white sm:rounded-[22px]" style={{ border: '1px solid var(--erp-border-strong)' }} initial={{ y: -16, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: -12, scale: 0.97 }} transition={{ duration: 0.2 }}>
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
                return <button key={cmd.path} onClick={() => go(cmd.path)} className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors" style={{ background: isActive ? 'var(--erp-violet-dim)' : 'transparent', color: isActive ? 'var(--erp-text)' : 'var(--erp-text-muted)' }}><Command size={13} className="flex-shrink-0" style={{ color: 'var(--erp-text-dim)' }} />{cmd.label}{isActive && <kbd className="ml-auto text-[10px]" style={{ color: 'var(--erp-text-dim)' }}>Enter</kbd>}</button>;
              })}
            </div>
          ))}
        </div>
        <div className="hidden items-center gap-4 px-4 py-2.5 text-[10px] sm:flex" style={{ borderTop: '1px solid var(--erp-border)', color: 'var(--erp-text-dim)' }}><span>Setas para navegar</span><span>Enter para selecionar</span><span>ESC para fechar</span></div>
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
    '/financeiro/cobrancas': 'Cobranças',
    '/financeiro/receita': 'Receita',
    '/financeiro/custos': 'Custos',
    '/financeiro/custos-fixos': 'Custos',
    '/financeiro/custos-recorrentes': 'Custos',
    '/marketing/calendario': t.calendario,
    '/marketing/estudio': 'Estúdio de conteúdo',
    '/marketing/mensagens': 'Mensagens',
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
  }, [commandOpen, closeCommand, openCommand]);

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
        <header className="sticky top-0 z-30 flex min-h-14 items-center gap-2 px-2 py-2 backdrop-blur-2xl sm:gap-4 sm:px-5" style={{ background: 'var(--erp-header-bg)', borderBottom: '1px solid var(--erp-border)' }}>
          <HeaderAreaNav pathname={pathname} />
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button onClick={openCommand} className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs transition sm:flex" style={{ border: '1px solid var(--erp-border)', background: '#fff', color: 'var(--erp-text-muted)' }}><Search size={13} /><span>Buscar</span><kbd className="ml-1 rounded-full px-1.5 py-0.5 text-[10px]" style={{ border: '1px solid var(--erp-border)', background: 'var(--erp-surface-2)', color: 'var(--erp-text-muted)' }}>Ctrl K</kbd></button>
            <button onClick={() => openAIDrawer(title)} className="hidden items-center gap-1.5 rounded-full border border-violet-500/25 bg-white px-3 py-1.5 text-xs font-semibold text-violet-600 transition hover:bg-violet-50 sm:flex"><Sparkles size={13} /><span className="hidden sm:inline">Analisar com IA</span></button>
            <NotificationsMenu />
            <button onClick={logout} className="flex h-9 w-9 items-center justify-center rounded-full bg-white transition-colors hover:text-violet-600 sm:h-8 sm:w-8" style={{ color: 'var(--erp-text-muted)', border: '1px solid var(--erp-border)' }} title="Sair" aria-label="Sair"><LogOut size={15} /></button>
          </div>
        </header>
        <main className="flex-1 overflow-auto"><div className="px-3 pb-24 pt-3 sm:p-6 lg:p-8"><Suspense fallback={<RouteFallback />}><Outlet /></Suspense></div></main>
      </div>
      <MobileBottomNav pathname={pathname} />
      <AIDrawer />
      <AnimatePresence>{commandOpen && <CommandPalette onClose={closeCommand} />}</AnimatePresence>
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#fff', color: 'var(--erp-text)', border: '1px solid var(--erp-border)', borderRadius: '16px', fontSize: '13px' } }} />
    </div>
  );
}
