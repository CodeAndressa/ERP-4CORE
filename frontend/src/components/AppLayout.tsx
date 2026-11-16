import { Suspense, useEffect, useRef, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Brain, Command, DollarSign, FolderOpen, LayoutDashboard, LogOut, Megaphone, Menu, MoreHorizontal, Search, Settings2, Sparkles, Users, X } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import MainMenu from './MainMenu';
import { NotificationsMenu } from './NotificationsMenu';
import { AIDrawer } from '../shared/components/ai/AIDrawer';
import { useUIStore } from '../core/store/useUIStore';
import { trailFor } from '../core/navigation';
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

/** Uma barra fina no topo, como a do Lastro, em vez de um spinner no meio de
 *  uma area vazia. A diferenca importa: o spinner centralizado empurra a tela
 *  para o nada por um instante, enquanto a barra diz "estou buscando" sem tirar
 *  nada do lugar. */
/** A sidebar como gaveta no celular, no padrao do Lastro: veu atras, painel
 *  deslizando da esquerda e fechamento por Esc, pelo veu ou ao navegar. */
function MobileDrawer({ open, onClose, pathname }: { open: boolean; onClose: () => void; pathname: string }) {
  useEffect(() => {
    if (!open) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', aoTeclar);
    // Trava a rolagem de tras: sem isso a pagina corre atras da gaveta aberta.
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = anterior;
    };
  }, [open, onClose]);

  // Fecha sozinha ao trocar de tela, senao continuaria aberta sobre o destino.
  useEffect(() => {
    onClose();

  }, [pathname]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-floating lg:hidden" role="dialog" aria-modal="true" aria-label="Menu principal">
          <motion.div
            className="absolute inset-0"
            style={{ background: 'rgb(var(--erp-ink) / 0.45)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute inset-y-0 left-0 w-[272px] max-w-[85vw] overflow-hidden"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <MainMenu />
            <button
              onClick={onClose}
              aria-label="Fechar menu"
              className="absolute right-2 top-5 flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: 'rgba(255,255,255,0.10)', color: 'rgba(226,219,246,0.8)' }}
            >
              <X size={16} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function RouteFallback() {
  return (
    <>
      <div className="erp-loading-bar" role="progressbar" aria-label="Carregando a tela" />
      <div className="min-h-[40vh]" aria-hidden />
    </>
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




/** Onde voce esta: a area e a tela, no topo de toda pagina. */
function HeaderTrail({ pathname }: { pathname: string }) {
  const { area, screen } = trailFor(pathname);
  if (!area) return <div className="min-w-0 flex-1" />;

  return (
    <nav aria-label="Trilha" className="flex min-w-0 flex-1 items-center gap-2">
      <NavLink
        to={area.path}
        className="flex shrink-0 items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold transition-colors hover:bg-[color:var(--erp-surface-2)]"
        style={{ color: 'var(--erp-text)' }}
      >
        <area.icon size={15} />
        {area.label}
      </NavLink>
      {screen && screen.label !== area.label && (
        <>
          <span aria-hidden className="shrink-0 text-sm" style={{ color: 'var(--erp-text-dim)' }}>
            /
          </span>
          <span className="truncate text-sm" style={{ color: 'var(--erp-text-muted)' }}>
            {screen.label}
          </span>
        </>
      )}
    </nav>
  );
}


const COMMANDS = [
  { group: t.modulos, label: 'Dashboard', path: '/dashboard', keys: 'dashboard visao geral' },
  { group: 'Comercial', label: 'Leads', path: '/comercial/leads', keys: 'leads oportunidades comercial' },
  { group: 'Comercial', label: 'Clientes', path: '/comercial/clientes', keys: 'clientes empresas' },
  { group: 'Comercial', label: 'Pipeline', path: '/comercial/pipeline', keys: 'pipeline kanban funil' },
  { group: 'Comercial', label: 'Prospecção', path: '/comercial/prospeccao', keys: 'prospectar empresas cnpj comercial campanha' },
  { group: 'Comercial', label: 'Propostas', path: '/comercial/propostas', keys: `propostas ${t.orcamentos}` },
  { group: 'Financeiro', label: t.visao, path: '/financeiro', keys: 'financeiro controle caixa' },
  { group: 'Financeiro', label: 'Cobranças', path: '/financeiro/cobrancas', keys: 'cobrancas recebidas confirmadas pendentes vencidas assinaturas avulsas' },
  { group: 'Financeiro', label: 'Receita', path: '/financeiro/receita', keys: 'receita entradas asaas' },
  { group: 'Financeiro', label: 'Custos', path: '/financeiro/custos', keys: 'custos fixos recorrentes despesas mensalidades contas pagar' },
  { group: 'Marketing', label: t.calendario, path: '/marketing/calendario', keys: 'calendario editorial posts' },
  { group: 'Marketing', label: 'Estúdio de conteúdo', path: '/marketing/estudio', keys: 'criar arte aprovar agendar instagram' },
  { group: 'Sistema', label: 'Ambiente', path: '/ambiente', keys: 'ambiente env variavel chave integracao configuracao' },
  { group: 'Marketing', label: 'Esteira de conteúdo', path: '/marketing/agente', keys: 'agente ia esteira concorrentes benchmark pauta copy custo instagram' },
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
    '/comercial/prospeccao': 'Prospecção',
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
    '/marketing/agente': 'Esteira de conteúdo',
    '/ambiente': 'Ambiente',
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
  const [drawerOpen, setDrawerOpen] = useState(false);
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
      // Ctrl+B recolhe e expande o menu, o mesmo atalho do Lastro.
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        useUIStore.getState().toggleSidebar();
        return;
      }
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
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-[color:var(--erp-surface-2)] lg:hidden"
            style={{ color: 'var(--erp-text-muted)' }}
          >
            <Menu size={18} />
          </button>
          <HeaderTrail pathname={pathname} />
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button onClick={openCommand} className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs transition sm:flex" style={{ border: '1px solid var(--erp-border)', background: '#fff', color: 'var(--erp-text-muted)' }}><Search size={13} /><span>Buscar</span><kbd className="ml-1 rounded-full px-1.5 py-0.5 text-[10px]" style={{ border: '1px solid var(--erp-border)', background: 'var(--erp-surface-2)', color: 'var(--erp-text-muted)' }}>Ctrl K</kbd></button>
            <button onClick={() => openAIDrawer(title)} className="hidden items-center gap-1.5 rounded-full border border-violet-500/25 bg-white px-3 py-1.5 text-xs font-semibold text-violet-600 transition hover:bg-violet-50 sm:flex"><Sparkles size={13} /><span className="hidden sm:inline">Analisar com IA</span></button>
            <NotificationsMenu />
            <button onClick={logout} className="flex h-9 w-9 items-center justify-center rounded-full bg-white transition-colors hover:text-violet-600 sm:h-8 sm:w-8" style={{ color: 'var(--erp-text-muted)', border: '1px solid var(--erp-border)' }} title="Sair" aria-label="Sair"><LogOut size={15} /></button>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
            {/* `pb-24` so abaixo de lg: e a folga da barra inferior, que nao
                existe no desktop e deixava 96px de vazio no pe de toda tela.
                `max-w-[1600px]` da um limite de leitura: sem ele o conteudo
                estica de borda a borda em monitor largo. */}
            <div className="mx-auto w-full max-w-[1600px] px-3 pb-24 pt-3 sm:p-6 lg:p-8 lg:pb-8"><Suspense fallback={<RouteFallback />}><Outlet /></Suspense></div></main>
      </div>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} pathname={pathname} />
      <MobileBottomNav pathname={pathname} />
      <AIDrawer />
      <AnimatePresence>{commandOpen && <CommandPalette onClose={closeCommand} />}</AnimatePresence>
      <Toaster
        position="bottom-right"
        /* A barra inferior do celular e z-50 e fica no rodape: sem essa folga
           o toast nascia atras dela e o feedback da acao sumia. */
        containerStyle={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
        containerClassName="sm:!bottom-4" toastOptions={{ style: { background: '#fff', color: 'var(--erp-text)', border: '1px solid var(--erp-border)', borderRadius: '16px', fontSize: '13px' } }} />
    </div>
  );
}
