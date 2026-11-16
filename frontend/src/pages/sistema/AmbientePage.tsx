import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import { Button, Card } from '../../shared/components/ui';
import { PageHeader } from '../../shared/components/layout';

interface Variable {
  name: string;
  filled: boolean;
  required: boolean;
}

interface Group {
  key: string;
  name: string;
  unlocks: string;
  where: string;
  note: string;
  ready: boolean;
  missing: string[];
  variables: Variable[];
}

interface EnvStatus {
  environment: string;
  is_production: boolean;
  groups: Group[];
  ready_count: number;
  total_count: number;
  all_ready: boolean;
}

export default function AmbientePage() {
  const [status, setStatus] = useState<EnvStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<EnvStatus>('/settings/env-status');
      setStatus(data);
      setError('');
    } catch {
      setError('Não foi possível ler o status do ambiente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <p className="p-6 text-sm text-slate-500">Lendo o ambiente...</p>;
  if (error) return <p className="p-6 text-sm text-rose-600">{error}</p>;
  if (!status) return null;

  // Onde a pessoa corrige muda com o ambiente: local é o arquivo na máquina dela,
  // produção é o painel da Vercel seguido de redeploy.
  const fixLocation = status.is_production
    ? 'no painel da Vercel, em Settings > Environment Variables, seguido de Redeploy'
    : 'no arquivo .env na raiz do projeto, reiniciando o backend depois';

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sistema"
        title="Ambiente"
        description={`${status.ready_count} de ${status.total_count} integrações prontas`}
        showAI={false}
        action={<Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>Reconferir</Button>}
      />

      <div
        className="flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm"
        style={
          status.all_ready
            ? { borderColor: '#6ee7b7', background: '#ecfdf5', color: '#065f46' }
            : { borderColor: '#fcd34d', background: '#fffbeb', color: '#92400e' }
        }
      >
        {status.all_ready ? <ShieldCheck size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
        <span>
          Backend rodando como <strong>{status.environment}</strong>.{' '}
          {status.all_ready
            ? 'Tudo configurado.'
            : `Falta configurar ${status.total_count - status.ready_count} grupo(s). Corrija ${fixLocation}.`}
        </span>
      </div>

      <p className="text-xs text-slate-500">
        Esta tela nunca mostra o valor de uma chave, só se ela está preenchida.
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        {status.groups.map((group) => (
          <Card key={group.key}>
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  {group.ready
                    ? <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                    : <AlertTriangle size={15} className="shrink-0 text-amber-500" />}
                  {group.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">{group.unlocks}</p>
              </div>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={group.ready
                  ? { background: '#ecfdf5', color: '#065f46' }
                  : { background: '#fffbeb', color: '#92400e' }}
              >
                {group.ready ? 'pronto' : 'falta'}
              </span>
            </div>

            <ul className="mt-3 space-y-1">
              {group.variables.map((variable) => (
                <li key={variable.name} className="flex items-center gap-2 text-xs">
                  {variable.filled
                    ? <CheckCircle2 size={12} className="shrink-0 text-emerald-600" />
                    : <Circle size={12} className={`shrink-0 ${variable.required ? 'text-amber-500' : 'text-slate-300'}`} />}
                  <code className={variable.filled ? 'text-slate-700' : variable.required ? 'text-amber-700' : 'text-slate-400'}>
                    {variable.name}
                  </code>
                  {!variable.required && <span className="text-[10px] text-slate-400">opcional</span>}
                </li>
              ))}
            </ul>

            {!group.ready && (
              <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                <ExternalLink size={11} className="mt-0.5 shrink-0" />
                <span>Onde pegar: {group.where}</span>
              </p>
            )}
            {group.note && <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{group.note}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}
