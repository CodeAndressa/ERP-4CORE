import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { PageHeader, SectionCard, primaryButton } from '../components/ErpUi';

type Lead = { name: string; source_channel?: string; interest?: string; created_at?: string };
const stages = ['Novo lead', 'Qualificação', 'Diagnóstico', 'Proposta', 'Negociação'];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    api.get('/site/dashboard?days=90')
      .then((response) => {
        setConnected(Boolean(response.data.configured));
        setLeads(response.data.recent_leads || []);
      })
      .catch(() => undefined);
  }, []);

  const lane = (index: number) => index === 0 ? leads : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader eyebrow="Comercial" title="Pipeline de oportunidades" description="Organize cada conversa em uma etapa, defina o próximo passo e avance sem perder o contexto." action={<button className={primaryButton}>+ Novo lead</button>} />
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Leads de entrada', String(leads.length), connected ? 'Fonte: 4core.site' : 'Conecte o site para sincronizar'],
          ['Pipeline', String(leads.length), 'Oportunidades em andamento'],
          ['Follow-ups', '0', 'Aguardando dados comerciais'],
        ].map(([label, value, detail]) => (
          <div key={label} className="rounded-[28px] border border-violet-100 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{detail}</p>
          </div>
        ))}
        <div className="rounded-[28px] border border-violet-100 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Próxima ação</p>
          <Link to="/ai?scope=comercial" className="mt-3 block text-sm font-medium text-violet-700">Analisar prioridades com IA →</Link>
        </div>
      </div>
      <SectionCard title="Pipeline Kanban" subtitle="Arraste etapas na próxima evolução; por enquanto, cada item é a fonte real de entrada.">
        <div className="grid gap-4 overflow-x-auto pb-2 lg:grid-cols-5">
          {stages.map((stage, index) => (
            <div className="min-w-52 rounded-[24px] border border-violet-100 bg-violet-50/40 p-3" key={stage}>
              <div className="mb-3 flex justify-between">
                <p className="text-sm font-semibold text-slate-950">{stage}</p>
                <span className="text-xs text-slate-500">{lane(index).length}</span>
              </div>
              {lane(index).map((lead) => (
                <article className="mb-2 rounded-[20px] border border-violet-100 bg-white p-3" key={lead.name}>
                  <p className="font-medium text-slate-950">{lead.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{lead.interest || lead.source_channel || 'Contato pelo site'}</p>
                  <p className="mt-3 text-xs font-medium text-violet-700">Definir próximo passo</p>
                </article>
              ))}
              {!lane(index).length && <div className="rounded-[20px] border border-dashed border-violet-200 p-3 text-xs text-slate-500">Sem oportunidades nesta etapa</div>}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
