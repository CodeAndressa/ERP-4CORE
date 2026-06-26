import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { PageHeader, SectionCard, StatusBadge, primaryButton } from '../components/ErpUi';

type IntegrationStatus = { site_analytics: boolean; financial: boolean; instagram: boolean; ai: boolean; email: boolean };
const initialStatus: IntegrationStatus = { site_analytics: false, financial: false, instagram: false, ai: false, email: false };

export default function SettingsPage() {
  const [status, setStatus] = useState<IntegrationStatus>(initialStatus);
  const [checked, setChecked] = useState(false);
  useEffect(() => { api.get<IntegrationStatus>('/integrations/status').then(({ data }) => setStatus(data)).catch(() => undefined).finally(() => setChecked(true)); }, []);
  const integrations = [
    ['Métricas do site', 'Supabase · acessos, conversões e leads', status.site_analytics],
    ['Financeiro', 'ASAAS · cobranças e pagamentos', status.financial],
    ['Instagram Business', 'Meta · métricas e conteúdo', status.instagram],
    ['Assistente IA', 'Groq · recomendações e análises', status.ai],
    ['E-mail transacional', 'Resend · avisos e automações', status.email],
  ];
  return <div className="mx-auto max-w-7xl space-y-6"><PageHeader eyebrow="Administração" title="Configurações e fontes de dados" description="Conecte cada fonte uma vez. As telas do ERP passam a usar os dados reais assim que a integração estiver ativa." action={<button className={primaryButton}>Salvar alterações</button>} /><div className="grid gap-6 lg:grid-cols-2"><SectionCard title="Dados da empresa" subtitle="Informações exibidas em documentos e comunicações"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-slate-400">Nome da empresa<input defaultValue="4Core Consultoria Estratégica" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5 text-sm text-white outline-none" /></label><label className="text-sm text-slate-400">E-mail financeiro<input defaultValue="financeiro@4core.com.br" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5 text-sm text-white outline-none" /></label></div></SectionCard><SectionCard title="Status das integrações" subtitle={checked ? 'Leitura atual do ambiente do backend' : 'Verificando o ambiente do backend…'}><div className="space-y-4">{integrations.map(([name, description, enabled]) => <div className="flex items-center justify-between gap-4" key={name as string}><div><p className="font-medium text-white">{name}</p><p className="text-xs text-slate-400">{description}</p></div><StatusBadge tone={enabled ? 'emerald' : 'amber'}>{enabled ? 'Ativa' : 'Pendente'}</StatusBadge></div>)}</div><a href="/docs/real-data-configuration.md" className="mt-5 inline-block text-sm font-medium text-violet-200 hover:text-white">Ver guia de configuração →</a></SectionCard><SectionCard title="Equipe e acessos" subtitle="Usuários autorizados"><div className="space-y-3"><div className="flex justify-between rounded-2xl bg-slate-950/30 p-4"><div><p className="font-medium text-white">Sócia 4Core</p><p className="text-xs text-slate-400">socia@4core.com.br</p></div><StatusBadge tone="violet">Admin</StatusBadge></div><button className="text-sm font-medium text-violet-200">+ Convidar integrante</button></div></SectionCard><SectionCard title="Próximo passo" subtitle="Para ativar uma integração"><div className="space-y-3 text-sm text-slate-300"><p>1. Copie os valores no `.env` da raiz.</p><p>2. Reinicie o backend.</p><p>3. Atualize esta tela e confira o status.</p></div></SectionCard></div></div>;
}