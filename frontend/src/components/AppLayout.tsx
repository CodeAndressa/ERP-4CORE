import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Bell, Sparkles, Sun, Moon, LogOut, Command } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import MainMenu from './MainMenu';
import { AIDrawer } from '../shared/components/ai/AIDrawer';
import { Breadcrumb } from '../shared/components/layout/Breadcrumb';
import { useUIStore } from '../core/store/useUIStore';
import { useAuthStore } from '../core/store/useAuthStore';

// ─── command palette data ────────────────────────────────────────────────────
const COMMANDS = [
  { group: 'Módulos',     label: 'Dashboard',       path: '/dashboard',                  keys: 'dashboard visão geral' },
  { group: 'Comercial',   label: 'Leads',            path: '/comercial/leads',            keys: 'leads oportunidades comercial' },
  { group: 'Comercial',   label: 'Clientes',         path: '/comercial/clientes',         keys: 'clientes empresas' },
  { group: 'Comercial',   label: 'Pipeline',         path: '/comercial/pipeline',         keys: 'pipeline kanban funil' },
  { group: 'Comercial',   label: 'Propostas',        path: '/comercial/propostas',        keys: 'propostas orçamentos' },
  { group: 'Financeiro',  label: 'Visão Financeira', path: '/financeiro',                 keys: 'financeiro dinheiro' },
  { group: 'Financeiro',  label: 'Receitas',         path: '/financeiro/receitas',        keys: 'receitas entradas' },
  { group: 'Financeiro',  label: 'Despesas',         path: '/financeiro/despesas',        keys: 'despesas saídas custos' },
  { group: 'Financeiro',  label: 'Fluxo de Caixa',  path: '/financeiro/fluxo-caixa',     keys: 'fluxo caixa cash flow' },
  { group: 'Financeiro',  label: 'Projeções',        path: '/financeiro/projecoes',       keys: 'projeções previsão forecast' },
  { group: 'Marketing',   label: 'Calendário',       path: '/marketing/calendario',       keys: 'calendário editorial posts' },
  { group: 'Marketing',   label: 'Campanhas',        path: '/marketing/campanhas',        keys: 'campanhas marketing' },
  { group: 'Marketing',   label: 'Performance',      path: '/marketing/performance',      keys: 'performance métricas analytics' },
  { group: 'IA',          label: 'Chat com IA',      path: '/ia/chat',                    keys: 'chat ia inteligência assistente' },
  { group: 'IA',          label: 'Insights IA',      path: '/ia/sugestoes',               keys: 'insights sugestões recomendações' },
  { group: 'Sistema',     label: 'Relatórios',       path: '/reports',                    keys: 'relatórios reports pdf' },
  { group: 'Sistema',     label: 'Configurações',    path: '/settings',                   keys: 'configurações settings' },
  { group: 'Sistema',     label: 'Métricas do Site', path: '/site-metrics',               keys: 'site métricas analytics' },
];

function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = query.trim()
    ? COMMANDS.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.keys.toLowerCase().includes(query.toLowerCase())
      )
    : COMMANDS.slice(0, 8);

  useEffect(() => { setActiveIndex(0); }, [query]);

  const go = (path: string) => { navigate(path); onClose(); };

  const grouped = filtered.reduce<Record<string, typeof COMMANDS>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
      if (e.key === 'Enter')     { e.preventDefault(); if (filtered[activeIndex]) go(filtered[activeIndex].path); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filtered, activeIndex]);

  let globalIndex = 0;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[15vh]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: 'var(--erp-surface)',
          border: '1px solid var(--erp-border-strong)',
        }}
        initial={{ y: -16, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: -12, scale: 0.97 }}
        transition={{ type: 'spring', duration: 0.25 }}
      >
        {/* Search bar */}
        <div
          className="flex items-center gap-3 px-4 py-3.5"
          style={{ borderBottom: '1px solid var(--erp-border)' }}
        >
          <Search size={16} className="flex-shrink-0" style={{ color: 'var(--erp-text-muted)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar módulos, ações…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--erp-text)' }}
          />
          <kbd
            className="hidden rounded px-1.5 py-0.5 text-[10px] sm:block"
            style={{ border: '1px solid var(--erp-border)', background: 'var(--erp-surface-2)', color: 'var(--erp-text-muted)' }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2 [scrollbar-width:none]">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhum resultado</p>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <p
                  className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--erp-text-dim)' }}
                >
                  {group}
                </p>
                {items.map((cmd) => {
                  const isActive = globalIndex++ === activeIndex;
                  return (
                    <button
                      key={cmd.path}
                      onClick={() => go(cmd.path)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                      style={{
                        background: isActive ? 'var(--erp-violet-dim)' : 'transparent',
                        color: isActive ? 'var(--erp-text)' : 'var(--erp-text-muted)',
                      }}
                    >
                      <Command size={13} className="flex-shrink-0" style={{ color: 'var(--erp-text-dim)' }} />
                      {cmd.label}
                      {isActive && (
                        <kbd className="ml-auto text-[10px]" style={{ color: 'var(--erp-text-dim)' }}>↵</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          className="px-4 py-2.5 flex items-center gap-4 text-[10px]"
          style={{ borderTop: '1px solid var(--erp-border)', color: 'var(--erp-text-dim)' }}
        >
          <span>↑↓ navegar</span>
          <span>↵ selecionar</span>
          <span>ESC fechar</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

function pageTitle(pathname: string): string {
  const map: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/site-metrics': 'Métricas do Site',
    '/comercial/leads': 'Leads',
    '/comercial/clientes': 'Clientes',
    '/comercial/pipeline': 'Pipeline',
    '/comercial/propostas': 'Propostas',
    '/comercial/followup': 'Follow-up',
    '/comercial/agenda': 'Agenda',
    '/financeiro': 'Financeiro',
    '/financeiro/receitas': 'Receitas',
    '/financeiro/despesas': 'Despesas',
    '/financeiro/fluxo-caixa': 'Fluxo de Caixa',
    '/financeiro/contas-pagar': 'Contas a Pagar',
    '/financeiro/contas-receber': 'Contas a Receber',
    '/financeiro/projecoes': 'Projeções',
    '/marketing/calendario': 'Calendário',
    '/marketing/campanhas': 'Campanhas',
    '/marketing/performance': 'Performance',
    '/ia/chat': 'Chat com IA',
    '/reports': 'Relatórios',
    '/settings': 'Configurações',
    '/financial': 'Financeiro',
    '/clients': 'Clientes',
    '/leads': 'Leads',
    '/marketing': 'Marketing',
    '/contracts': 'Contratos',
    '/knowledge': 'Conhecimento',
    '/ai': 'Assistente IA',
    '/proposals': 'Propostas',
  };
  return map[pathname] ?? 'ERP';
}

export default function AppLayout() {
  const { commandOpen, openCommand, closeCommand, openAIDrawer, theme, toggleTheme } = useUIStore();
  const { logout } = useAuthStore();
  const { pathname } = useLocation();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        commandOpen ? closeCommand() : openCommand();
      }
      if (e.key === 'Escape') { closeCommand(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commandOpen]);

  return (
    <div
      className="flex min-h-screen"
      style={{ background: 'var(--erp-bg)', color: 'var(--erp-text)' }}
    >
      <MainMenu />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-5 py-3.5 backdrop-blur-xl"
          style={{
            background: 'var(--erp-header-bg)',
            borderBottom: '1px solid var(--erp-border)',
          }}
        >
          <div className="flex flex-col justify-center min-w-0">
            <Breadcrumb />
            <p className="mt-0.5 text-base font-semibold" style={{ color: 'var(--erp-text)' }}>
              {pageTitle(pathname)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Ctrl+K shortcut */}
            <button
              onClick={openCommand}
              className="hidden items-center gap-2 rounded-xl px-3 py-2 text-xs transition sm:flex"
              style={{
                border: '1px solid var(--erp-border)',
                background: 'var(--erp-surface)',
                color: 'var(--erp-text-muted)',
              }}
            >
              <Search size={13} />
              <span>Buscar</span>
              <kbd
                className="ml-1 rounded px-1 py-0.5 text-[10px]"
                style={{ border: '1px solid var(--erp-border)', background: 'var(--erp-surface-2)', color: 'var(--erp-text-dim)' }}
              >
                ⌘K
              </kbd>
            </button>

            {/* AI Button */}
            <button
              onClick={() => openAIDrawer(pageTitle(pathname))}
              className="flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/8 px-3 py-2 text-xs font-medium text-violet-300 transition hover:border-violet-500/50 hover:bg-violet-500/14"
            >
              <Sparkles size={13} />
              <span className="hidden sm:inline">Analisar com IA</span>
            </button>

            {/* Notifications */}
            <button
              className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
              style={{ color: 'var(--erp-text-muted)' }}
            >
              <Bell size={16} />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-violet-500" />
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-white/6"
              style={{ color: 'var(--erp-text-muted)' }}
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Logout */}
            <button
              onClick={logout}
              className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:text-rose-400"
              style={{ color: 'var(--erp-text-muted)' }}
              title="Sair"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>

        {/* Page content — full width, no max-w cap */}
        <main className="flex-1 overflow-auto">
          <div className="p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* AI Drawer */}
      <AIDrawer />

      {/* Command Palette */}
      <AnimatePresence>
        {commandOpen && <CommandPalette onClose={closeCommand} />}
      </AnimatePresence>

      {/* Toast notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--erp-surface-2)',
            color: 'var(--erp-text)',
            border: '1px solid var(--erp-border)',
            borderRadius: '12px',
            fontSize: '13px',
          },
        }}
      />
    </div>
  );
}
