import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { useUIStore } from '../../../core/store/useUIStore';
import { Button } from '../ui/Button';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  aiModule?: string;
  aiContext?: string;
  showAI?: boolean;
}

export function PageHeader({ eyebrow, title, description, action, aiModule, aiContext, showAI = true }: PageHeaderProps) {
  const openAIDrawer = useUIStore((s) => s.openAIDrawer);

  return (
    <div className="border-b border-violet-100 pb-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
          {eyebrow && <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600">{eyebrow}</p>}
          <h1 className="shrink-0 text-xl font-bold tracking-tight text-slate-950">{title}</h1>
          {description && <p className="min-w-0 truncate text-sm text-slate-600">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {showAI && (
            <Button variant="outline" size="sm" icon={<Sparkles size={14} />} onClick={() => openAIDrawer(aiModule ?? title, aiContext)}>
              Analisar com IA
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
