import { PageHeader, SectionCard, StatusBadge, primaryButton } from '../components/ErpUi';

const posts = [
  ['01 jul', 'Checklist de conformidade', 'Instagram', 'Em produção'],
  ['04 jul', 'Case Grupo Atlas', 'LinkedIn', 'Aprovação'],
  ['08 jul', 'Guia Portaria 671', 'E-mail', 'Agendado'],
  ['10 jul', 'Bastidores 4Core', 'Stories', 'Ideia'],
];

export default function MarketingPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader eyebrow="Marketing" title="Calendário e performance" description="Planeje campanhas, organize o conteúdo e acompanhe a contribuição do marketing para o comercial." action={<button className={primaryButton}>+ Planejar conteúdo</button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Alcance', '24.800', '+18% no mês'],
          ['Engajamento', '6,2%', 'Média por conteúdo'],
          ['Leads gerados', '18', 'Últimos 30 dias'],
          ['Conteúdos no mês', '12', '8 publicados'],
        ].map(([label, value, detail]) => (
          <div key={label} className="rounded-[22px] border border-violet-100 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{detail}</p>
          </div>
        ))}
      </div>
      <SectionCard title="Calendário editorial" subtitle="Próximos conteúdos e seus responsáveis">
        <div className="space-y-3">
          {posts.map(([date, title, channel, status]) => (
            <div className="flex flex-col gap-3 rounded-[24px] border border-violet-100 bg-white p-4 sm:flex-row sm:items-center" key={title}>
              <p className="w-16 text-sm font-semibold text-violet-700">{date}</p>
              <div className="flex-1">
                <p className="font-medium text-slate-950">{title}</p>
                <p className="mt-1 text-xs text-slate-500">{channel} · Responsável: Marketing</p>
              </div>
              <StatusBadge tone={status === 'Agendado' ? 'emerald' : status === 'Aprovação' ? 'amber' : 'violet'}>{status}</StatusBadge>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
