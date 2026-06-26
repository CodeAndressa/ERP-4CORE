import { PageHeader, SectionCard, StatusBadge, primaryButton } from '../components/ErpUi';

const reports = [
  ['Resultado gerencial', 'Financeiro', 'Junho 2026', 'Pronto'],
  ['Fluxo de caixa realizado', 'Financeiro', 'Junho 2026', 'Pronto'],
  ['Pipeline comercial', 'CRM', 'Junho 2026', 'Pronto'],
  ['Performance de marketing', 'Marketing', 'Junho 2026', 'Em atualização'],
];

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader eyebrow="Inteligência de gestão" title="Relatórios" description="Consolide os indicadores da operação em relatórios prontos para análise e decisão." action={<button className={primaryButton}>+ Criar relatório</button>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Relatórios rápidos" subtitle="Geração em poucos cliques">
          <div className="space-y-3">
            {['Posição financeira', 'Contas a receber', 'Clientes ativos', 'Funil de vendas', 'Conteúdo publicado'].map((item) => (
              <button key={item} className="w-full rounded-full border border-violet-100 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-violet-200 hover:text-violet-700">
                {item}<span className="float-right text-violet-700">Exportar</span>
              </button>
            ))}
          </div>
        </SectionCard>
        <SectionCard className="lg:col-span-2" title="Relatórios salvos" subtitle="Acesse ou atualize os últimos relatórios">
          <div className="space-y-3">
            {reports.map(([title, area, period, status]) => (
              <div className="flex flex-col justify-between gap-3 rounded-[24px] border border-violet-100 bg-white p-4 sm:flex-row sm:items-center" key={title}>
                <div>
                  <p className="font-medium text-slate-950">{title}</p>
                  <p className="mt-1 text-xs text-slate-500">{area} · {period}</p>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge tone={status === 'Pronto' ? 'emerald' : 'amber'}>{status}</StatusBadge>
                  <button className="text-sm font-medium text-violet-700">Abrir</button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
