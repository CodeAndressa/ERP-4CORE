import { Outlet } from 'react-router-dom';
import { SubNav } from '../../shared/components/layout/SubNav';

const TABS = [
  { label: 'Calendário',   path: '/marketing/calendario'   },
  { label: 'Posts',        path: '/marketing/posts'        },
  { label: 'Ideias',       path: '/marketing/ideias'       },
  { label: 'Métricas',     path: '/marketing/metricas'     },
  { label: 'Campanhas',    path: '/marketing/campanhas'    },
  { label: 'Planejamento', path: '/marketing/planejamento' },
];

export default function MarketingLayout() {
  return (
    <div>
      <SubNav tabs={TABS} />
      <div className="pt-6">
        <Outlet />
      </div>
    </div>
  );
}
