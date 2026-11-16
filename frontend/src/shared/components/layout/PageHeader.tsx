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

// `showAI` agora nasce desligado. O cabecalho global ja tem "Analisar com IA"
// em toda tela, e os dois juntos deixavam o mesmo botao duas vezes na mesma
// altura da pagina. Quem quiser o atalho no contexto da tela pede por ele.
export function PageHeader({ eyebrow, title, description, action, aiModule, aiContext, showAI = false }: PageHeaderProps) {
  const openAIDrawer = useUIStore((s) => s.openAIDrawer);

  return (
    // A classe `page-header` é o gancho que deixa a área de Marketing virar este
    // cabeçalho numa faixa com a cor da seção, sem que cada tela precise saber
    // disso. Fora de Marketing ele continua discreto, como no resto do ERP.
    <div className="page-header border-b border-violet-100 pb-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1 lg:flex-row lg:items-baseline lg:gap-3">
          {eyebrow && <p className="page-header__eyebrow shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--erp-text-dim)]">{eyebrow}</p>}
          <h1 className="page-header__title shrink-0 text-2xl font-bold tracking-tight text-[color:var(--erp-text)]">{title}</h1>
          {/* Sem `truncate`: cortar a frase com reticencias e pior que deixa-la
              quebrar numa segunda linha quando o espaco aperta. */}
          {description && <p className="page-header__description min-w-0 text-sm text-[color:var(--erp-text-muted)]">{description}</p>}
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
