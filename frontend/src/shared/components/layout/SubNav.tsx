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
    <nav className="flex items-center gap-1 border-b border-white/8 px-6 pt-1">
      {tabs.map((tab) => {
        const active = pathname === tab.path || pathname.startsWith(tab.path + '/');
        return (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={[
              'relative flex items-center gap-2 px-3 py-3 text-sm font-medium transition-colors',
              active
                ? 'text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-violet-500 after:rounded-full'
                : 'text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            {tab.icon && <span className="text-current opacity-70">{tab.icon}</span>}
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold text-white">
                {tab.badge}
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
