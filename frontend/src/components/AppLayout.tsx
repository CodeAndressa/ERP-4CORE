import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Bell, Sparkles, LogOut, Command } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import MainMenu from './MainMenu';
import { AIDrawer } from '../shared/components/ai/AIDrawer';
import { Breadcrumb } from '../shared/components/layout/Breadcrumb';
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

const COMMANDS = [
  { group: t.modulos, label: 'Dashboard', path: '/dashboard', keys: 'dashboard visao geral' },
  { group: 'Comercial', label: 'Leads', path: '/comercial/leads', keys: 'leads oportunidades comercial' },
  { group: 'Comercial', label: 'Clientes', path: '/comercial/clientes', keys: 'clientes empresas' },
  { group: 'Comercial', label: 'Pipeline', path: '/comercial/pipeline', keys: 'pipeline kanban funil' },
  { group: 'Comercial', label: 'Propostas', path: '/comercial/propostas', keys: `propostas ${t.orcamentos}` },
  { group: 'Financeiro', label: t.visao, path: '/financeiro', keys: 'financeiro controle caixa' },
  { group: 'Financeiro', label: 'Receita', path: '/financeiro/receita', keys: 'receita entradas asaas' },
  { group: 'Financeiro', label: 'Custos Fixos', path: '/financeiro/custos-fixos', keys: 'custos fixos despesas' },
  { group: 'Financeiro', label: 'Custos Recorrentes', path: '/financeiro/custos-recorrentes', keys: 'custos recorrentes mensalidades' },
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
      <div className="absolute inset-0 bg-slate-950/25 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative w-full max-w-lg overflow-hidden rounded-[28px] bg-white" style={{ border: '1px solid var(--erp-border-strong)' }} initial={{ y: -16, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: -12, scale: 0.97 }} transition={{ type: 'spring', duration: 0.25 }}>
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
    '/financeiro/custos-fixos': 'Custos Fixos',
    '/financeiro/custos-recorrentes': 'Custos Recorrentes',
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
  const { logout } = useAuthStore();
  const { pathname } = useLocation();
  const title = pageTitle(pathname);

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

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--erp-bg)', color: 'var(--erp-text)' }}>
      <MainMenu />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 px-5 py-2 backdrop-blur-2xl" style={{ background: 'var(--erp-header-bg)', borderBottom: '1px solid var(--erp-border)' }}>
          <div className="flex min-w-0 items-center gap-3"><div className="hidden h-8 w-1 rounded-full sm:block" style={{ background: 'var(--erp-violet)' }} /><div className="min-w-0 truncate"><Breadcrumb /></div></div>
          <div className="flex items-center gap-2">
            <button onClick={openCommand} className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs transition sm:flex" style={{ border: '1px solid var(--erp-border)', background: '#fff', color: 'var(--erp-text-muted)' }}><Search size={13} /><span>Buscar</span><kbd className="ml-1 rounded-full px-1.5 py-0.5 text-[10px]" style={{ border: '1px solid var(--erp-border)', background: 'var(--erp-surface-2)', color: 'var(--erp-text-muted)' }}>Ctrl K</kbd></button>
            <button onClick={() => openAIDrawer(title)} className="flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-white px-3 py-1.5 text-xs font-semibold text-violet-600 transition hover:bg-violet-50"><Sparkles size={13} /><span className="hidden sm:inline">Analisar com IA</span></button>
            <button className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white transition-colors" style={{ color: 'var(--erp-text-muted)', border: '1px solid var(--erp-border)' }}><Bell size={16} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-violet-500" /></button>
            <button onClick={logout} className="flex h-8 w-8 items-center justify-center rounded-full bg-white transition-colors hover:text-violet-600" style={{ color: 'var(--erp-text-muted)', border: '1px solid var(--erp-border)' }} title="Sair"><LogOut size={15} /></button>
          </div>
        </header>
        <main className="flex-1 overflow-auto"><div className="p-6 lg:p-8"><Outlet /></div></main>
      </div>
      <AIDrawer />
      <AnimatePresence>{commandOpen && <CommandPalette onClose={closeCommand} />}</AnimatePresence>
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#fff', color: 'var(--erp-text)', border: '1px solid var(--erp-border)', borderRadius: '18px', fontSize: '13px' } }} />
    </div>
  );
}
