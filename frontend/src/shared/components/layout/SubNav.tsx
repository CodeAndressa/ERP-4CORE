import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

interface TabItem {
  label: string;
  path: string;
  badge?: number;
  icon?: ReactNode;
}

export function SubNav({ tabs }: { tabs: TabItem[] }) {
  const { pathname } = useLocation();
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1 rounded-full border border-violet-100 bg-white p-1">
      {tabs.map((tab) => {
        const active = pathname === tab.path || pathname.startsWith(`${tab.path}/`);
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors"
            style={{
              background: active ? 'var(--erp-violet)' : 'transparent',
              color: active ? '#fff' : 'var(--erp-text-muted)',
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.badge != null && tab.badge > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-bold text-white">{tab.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
