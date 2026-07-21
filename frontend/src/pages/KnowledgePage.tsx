import { BookOpen } from 'lucide-react';
import { Card } from '../shared/components/ui/Card';

export default function KnowledgePage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Conhecimento</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Base Operacional</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Processos, playbooks e aprendizados da equipe</p>
      </div>

      <Card padding="lg">
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--erp-violet-dim)' }}>
            <BookOpen size={22} style={{ color: 'var(--erp-violet-light)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--erp-text)' }}>Base de conhecimento em construção</p>
          <p className="max-w-sm text-xs leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}>
            Em breve dá para reunir aqui os processos, playbooks e materiais internos da equipe. Por enquanto essa área ainda não está conectada.
          </p>
        </div>
      </Card>
    </div>
  );
}
