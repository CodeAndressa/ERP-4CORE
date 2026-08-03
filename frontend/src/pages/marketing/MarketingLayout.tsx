import { Outlet } from 'react-router-dom';
import ScheduleCoverageAlert from '../../shared/components/ScheduleCoverageAlert';

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
