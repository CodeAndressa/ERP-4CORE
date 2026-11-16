import { Outlet } from 'react-router-dom';
import ScheduleCoverageAlert from '../../shared/components/ScheduleCoverageAlert';

/** A cor por seção foi removida: onze cores independentes brigavam com o roxo da
 *  sidebar e a faixa grande no topo dominava a tela sem informar nada que o
 *  título já não dissesse. Saber onde se está é trabalho do título e da trilha,
 *  não de pintar o cabeçalho. */
export default function MarketingLayout() {
  // Fica no layout, e não em uma página só: o risco de ficar sem agendamento tem
  // que estar visível em qualquer tela de Marketing em que ela esteja trabalhando.
  return (
    <div className="space-y-5">
      <ScheduleCoverageAlert />
      <Outlet />
    </div>
  );
}
