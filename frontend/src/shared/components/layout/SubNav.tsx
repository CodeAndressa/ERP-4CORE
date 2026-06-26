import { NavLink, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

interface TabItem {
  label: string;
  path: string;
  badge?: number;
  icon?: ReactNode;
}

interface SubNavProps {
  tabs: TabItem[];
}

export function SubNav({ tabs }: SubNavProps) {
  const { pathname } = useLocation();

  return (
    <nav
      className="flex items-center gap-1 px-1 pt-1"
      style={{ borderBottom: '1px solid var(--erp-border)' }}
    >
      {tabs.map((tab) => {
        const active = pathname === tab.path || pathname.startsWith(tab.path + '/');
        return (
          <NavLink
            key={tab.path}
            to={tab.path}
            className="relative flex items-center gap-2 px-3 py-3 text-sm font-medium transition-colors"
            style={{
              color: active ? 'var(--erp-text)' : 'var(--erp-text-muted)',
            }}
          >
            {tab.icon && <span className="opacity-70">{tab.icon}</span>}
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold text-white">
                {tab.badge}
              </span>
            )}
            {active && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                style={{ background: 'var(--erp-violet)' }}
              />
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
