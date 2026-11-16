import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import BranchedMenu, { type SecaoRamo } from '../shared/components/ui/BranchedMenu';
import { NAV, areaFor } from '../core/navigation';
import { useUIStore } from '../core/store/useUIStore';

const LOGO_SRC = '/Logo%20com%20Tipografia%204Core%20-%20Principal%20Transparente.png';
const LOGO_MARK_SRC = '/logo-mark.png';

/** O menu passou a mostrar área e telas na mesma árvore, como o do Lastro.
 *
 *  Antes a navegação era partida em dois: a sidebar dava a área e as abas do
 *  topo davam as telas dela. Quem estava em Marketing não via, sem clicar, que
 *  Financeiro tem Cobranças; e no celular, onde a sidebar some, o nível de área
 *  desaparecia por completo. Com a árvore, os dois níveis moram no mesmo lugar.
 *
 *  Recolhida, a sidebar volta a mostrar só os ícones das áreas: galho e rótulo
 *  não cabem em 64px, e insistir neles ali seria pior que a versão simples. */
export default function MainMenu() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const areaAtual = areaFor(pathname);

  const secoes = useMemo<SecaoRamo[]>(
    () =>
      NAV.flatMap((group) =>
        group.areas.map((area) => ({
          label: area.label,
          value: area.path,
          href: area.path,
          children: area.screens.map((screen) => ({
            value: screen.path,
            label: screen.label,
            href: screen.path,
            icon: <screen.icon size={15} />,
          })),
        })),
      ),
    [],
  );

  const telaAtiva = useMemo(() => {
    const todas = NAV.flatMap((g) => g.areas).flatMap((a) => a.screens);
    return (
      todas
        .filter((s) => pathname === s.path || pathname.startsWith(`${s.path}/`))
        .sort((a, b) => b.path.length - a.path.length)[0]?.path ?? ''
    );
  }, [pathname]);


  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 64 : 248 }}
      transition={{ type: 'spring', damping: 28, stiffness: 280 }}
      className="relative hidden flex-shrink-0 flex-col overflow-hidden lg:flex"
      // Os valores vêm dos tokens, que até agora só existiam no DESIGN.md. O
      // degradê ficou de duas paradas e quase imperceptível: o de três, com o
      // brilho radial borrado por cima, era decoração de dashboard, não marca.
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
          className={sidebarCollapsed ? 'h-9 w-9 object-contain' : 'h-11 w-auto max-w-[180px] object-contain'}
        />
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expandir menu (Ctrl+B)' : 'Recolher menu (Ctrl+B)'}
          aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-150 hover:bg-white/15 ${sidebarCollapsed ? '' : 'ml-auto'}`}
          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(226,219,246,0.75)' }}
        >
          {sidebarCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      <nav
        aria-label="Menu principal"
        className="relative flex-1 overflow-y-auto overflow-x-hidden px-2 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sidebarCollapsed ? (
          <div className="space-y-1.5">
            {NAV.flatMap((group) => group.areas).map((area) => {
              const ativo = area.path === areaAtual?.path;
              return (
                <button
                  key={area.path}
                  onClick={() => navigate(area.path)}
                  title={area.label}
                  aria-label={area.label}
                  aria-current={ativo ? 'page' : undefined}
                  className="mx-auto flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors duration-150"
                  style={{
                    background: ativo ? 'var(--erp-sidebar-active)' : 'transparent',
                    color: ativo ? '#fff' : 'rgba(226,219,246,0.70)',
                  }}
                >
                  <area.icon size={17} strokeWidth={ativo ? 2.2 : 1.8} />
                </button>
              );
            })}
          </div>
        ) : (
          NAV.map((group, indice) => (
            <div key={group.label} className={indice > 0 ? 'mt-4' : ''}>
              <p
                className="mb-1 px-3 text-xs font-semibold uppercase tracking-[0.16em]"
                style={{ color: 'rgba(226,219,246,0.34)' }}
              >
                {group.label}
              </p>
              {(() => {
                // Cada grupo desenha a sua propria arvore, entao o indice da
                // secao aberta e local a ela, nao global.
                const doGrupo = secoes.filter((s) => group.areas.some((a) => a.path === s.value));
                const aberta = doGrupo.findIndex((s) => s.value === areaAtual?.path);
                return (
                  <BranchedMenu
                    items={doGrupo}
                    value={telaAtiva}
                    defaultOpen={aberta}
                    onSelect={(_valor, item) => {
                      if ('href' in item && item.href) navigate(item.href);
                    }}
                  />
                );
              })()}
            </div>
          ))
        )}
      </nav>
    </motion.aside>
  );
}
