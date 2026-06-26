import type { ReactNode } from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-16 px-8 text-center">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-xs text-xs text-slate-500 leading-relaxed">{description}</p>
      )}
      {action && (
        <div className="mt-5">
          <Button size="sm" variant="outline" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
