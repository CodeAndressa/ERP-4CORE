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

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  aiModule,
  aiContext,
  showAI = true,
}: PageHeaderProps) {
  const openAIDrawer = useUIStore((s) => s.openAIDrawer);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-violet-400">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tighter text-white">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-xl text-sm text-slate-400 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        {showAI && (
          <Button
            variant="outline"
            size="sm"
            icon={<Sparkles size={14} />}
            onClick={() => openAIDrawer(aiModule ?? title, aiContext)}
          >
            Analisar com IA
          </Button>
        )}
      </div>
    </div>
  );
}
