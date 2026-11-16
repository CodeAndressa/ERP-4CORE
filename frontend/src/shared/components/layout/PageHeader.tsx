import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { useUIStore } from '../../../core/store/useUIStore';
import { Button } from '../ui/Button';

interface PageHeaderProps {
  /** @deprecated A trilha do cabeçalho já diz a área. Aceito, e ignorado. */
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  aiModule?: string;
  aiContext?: string;
  showAI?: boolean;
}

/** O cabeçalho de tela.
 *
 *  O rótulo de área saiu: a trilha do topo já diz "Marketing / Estúdio", e
 *  repetir "MARKETING" colado no título era eco ocupando espaço. A prop
 *  continua sendo aceita para as telas não quebrarem, e é ignorada.
 *
 *  A descrição desceu para baixo do título. Lado a lado, os dois disputavam a
 *  mesma linha com as ações, e os três juntos espremiam tudo numa faixa só.
 *
 *  A borda inferior também saiu: com o título em 1.5rem e o espaço da página, a
 *  separação já se lê sem precisar de um risco.
 *
 *  `showAI` nasce desligado porque o cabeçalho global já tem "Analisar com IA"
 *  em toda tela. */
export function PageHeader({ title, description, action, aiModule, aiContext, showAI = false }: PageHeaderProps) {
  const openAIDrawer = useUIStore((s) => s.openAIDrawer);

  return (
    <div className="page-header flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="page-header__title text-2xl font-bold tracking-tight" style={{ color: 'var(--erp-text)' }}>
          {title}
        </h1>
        {description && (
          <p className="page-header__description mt-1 max-w-2xl text-sm" style={{ color: 'var(--erp-text-muted)' }}>
            {description}
          </p>
        )}
      </div>
      {(action || showAI) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
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
      )}
    </div>
  );
}
