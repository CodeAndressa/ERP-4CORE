import { Outlet } from 'react-router-dom';
import { SubNav } from '../../shared/components/layout/SubNav';

const TABS = [
  { label: 'Chat & Insights', path: '/ia/chat'      },
  { label: 'SugestÃµes',       path: '/ia/sugestoes'  },
  { label: 'AnÃ¡lises',        path: '/ia/analises'   },
  { label: 'Resumos',         path: '/ia/resumos'    },
];

export default function IALayout() {
  return (
    <div>
      <SubNav tabs={TABS} />
      <div className="pt-6">
        <Outlet />
      </div>
    </div>
  );
}
