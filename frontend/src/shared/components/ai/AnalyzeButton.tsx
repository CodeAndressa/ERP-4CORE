import { Sparkles } from 'lucide-react';
import { useUIStore } from '../../../core/store/useUIStore';

interface AnalyzeButtonProps {
  module?: string;
  context?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function AnalyzeButton({ module = '', context = '', size = 'sm', className = '' }: AnalyzeButtonProps) {
  const openAIDrawer = useUIStore((s) => s.openAIDrawer);

  const sizeStyles = size === 'sm'
    ? 'px-3 py-1.5 text-xs gap-1.5'
    : 'px-4 py-2 text-sm gap-2';

  return (
    <button
      onClick={() => openAIDrawer(module, context)}
      className={[
        'inline-flex items-center rounded-xl border border-violet-500/30 bg-violet-500/8',
        'font-medium text-violet-300 transition-all',
        'hover:border-violet-500/50 hover:bg-violet-500/14 hover:text-violet-200',
        'active:scale-95',
        sizeStyles,
        className,
      ].join(' ')}
    >
      <Sparkles size={size === 'sm' ? 12 : 14} />
      Analisar com IA
    </button>
  );
}
