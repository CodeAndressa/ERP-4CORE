import { Outlet, useLocation } from 'react-router-dom';
import ScheduleCoverageAlert from '../../shared/components/ScheduleCoverageAlert';

/** Cada tela de Marketing tem uma cor de identidade, declarada em `styles.css`
 *  sob `[data-mkt-section]`. O wrapper só diz em que seção estamos; as cores
 *  saem do CSS, para o resto do ERP continuar no índigo executivo.
 *
 *  Só identidade anda nessa cor. Status (aprovado, atenção, erro) mantém a cor
 *  semântica de sempre, inclusive na seção cujo acento é verde ou vermelho. */
function sectionFromPath(pathname: string): string {
  const slug = pathname.split('/').filter(Boolean)[1] ?? '';
  return slug || 'estudio';
}

export default function MarketingLayout() {
  const { pathname } = useLocation();

  // Fica no layout, e não em uma página só: o risco de ficar sem agendamento tem
  // que estar visível em qualquer tela de Marketing em que ela esteja trabalhando.
  return (
    <div className="space-y-5" data-mkt-section={sectionFromPath(pathname)}>
      <ScheduleCoverageAlert />
      <Outlet />
    </div>
  );
}
