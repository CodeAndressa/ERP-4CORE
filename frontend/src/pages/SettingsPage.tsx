import { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  CheckCircle, AlertCircle, Globe, DollarSign,
  Camera, Brain, Mail, Save,
} from 'lucide-react';
import { Card } from '../shared/components/ui/Card';

type IntegrationStatus = {
  site_analytics: boolean;
  financial: boolean;
  instagram: boolean;
  ai: boolean;
  email: boolean;
};

const INTEGRATIONS = [
  { key: 'site_analytics' as const, label: 'MÃ©tricas do Site',      desc: 'Supabase Â· acessos, conversÃµes e leads',       icon: Globe      },
  { key: 'financial'      as const, label: 'Financeiro',             desc: 'ASAAS Â· cobranÃ§as e pagamentos',               icon: DollarSign  },
  { key: 'instagram'      as const, label: 'Instagram Business',     desc: 'Meta Â· mÃ©tricas e conteÃºdo',                   icon: Camera      },
  { key: 'ai'             as const, label: 'Assistente IA',          desc: 'Groq Â· recomendaÃ§Ãµes e anÃ¡lises',              icon: Brain       },
  { key: 'email'          as const, label: 'E-mail transacional',    desc: 'Resend Â· avis?os e automaÃ§Ãµes',                 icon: Mail        },
];

export default function SettingsPage() {
  const [status, setStatus] = useState<IntegrationStatus>({
    site_analytics: false, financial: false, instagram: false, ai: false, email: false,
  });
  const [checked, setChecked] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<IntegrationStatus>('/integrations/status')
      .then(({ data }) => setStatus(data))
      .catch(() => undefined)
      .finally(() => setChecked(true));
  }, []);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const activeCount = Object.values(status).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>AdministraÃ§Ã£o</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>ConfiguraÃ§Ãµes</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>{activeCount} de {INTEGRATIONS.length} integraÃ§Ãµes ativas</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all"
          style={{
            background: saved ? 'rgba(52,211,153,0.12)' : 'var(--erp-violet)',
            color: saved ? '#34d399' : '#fff',
          }}
        >
          {saved ? <CheckCircle size={14} /> : <Save size={14} />}
          {saved ? 'Salvo!' : 'Salvar alteraÃ§Ãµes'}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Company data */}
        <Card padding="lg">
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--erp-text)' }}>Dados da empresa</p>
          <p className="text-xs mb-4" style={{ color: 'var(--erp-text-muted)' }}>Exibidos em documentos e comunicaÃ§Ãµes</p>
          <div className="space-y-3">
            {[
              { label: 'Nome da empresa', value: '4Core Consultoria EstratÃ©gica' },
              { label: 'CNPJ', value: '00.000.000/0001-00' },
              { label: 'E-mail financeiro', value: 'financeiro@4core.com.br' },
              { label: 'Telefone', value: '+55 (11) 90000-0000' },
            ].map((field) => (
              <div key={field.label}>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--erp-text-muted)' }}>{field.label}</label>
                <input
                  defaultValue={field.value}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}
                />
              </div>
            ))}
          </div>
        </Card>

        {/* Integration status */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Status das integraÃ§Ãµes</p>
            <span className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>
              {checked ? 'Leitura atual do backend' : 'Verificandoâ€¦'}
            </span>
          </div>
          <div className="space-y-3">
            {INTEGRATIONS.map(({ key, label, desc, icon: Icon }) => {
              const active = status[key];
              return (
                <div
                  key={key}
                  className="flex items-center gap-3 rounded-xl px-3 py-3"
                  style={{
                    background: active ? 'rgba(52,211,153,0.06)' : 'var(--erp-surface-2)',
                    border: `1px solid ${active ? 'rgba(52,211,153,0.2)' : 'var(--erp-border)'}`,
                  }}
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ background: active ? 'rgba(52,211,153,0.12)' : 'var(--erp-surface)' }}>
                    <Icon size={14} style={{ color: active ? '#34d399' : 'var(--erp-text-dim)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--erp-text)' }}>{label}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--erp-text-muted)' }}>{desc}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {active
                      ? <CheckCircle size={13} style={{ color: '#34d399' }} />
                      : <AlertCircle size={13} style={{ color: '#fbbf24' }} />}
                    <span className="text-xs font-medium" style={{ color: active ? '#34d399' : '#fbbf24' }}>
                      {active ? 'Ativa' : 'Pendente'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Team */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Equipe e acessos</p>
            <button className="text-xs font-medium" style={{ color: 'var(--erp-violet-light)' }}>
              + Convidar
            </button>
          </div>
          <div className="space-y-2">
            {[
              { name: 'SÃ³cia 4Core', email: 'socia@4core.com.br', role: 'Admin' },
            ].map((user) => (
              <div key={user.email} className="flex items-center gap-3 rounded-xl px-3 py-3"
                style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)' }}>
                <div className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ background: 'var(--erp-violet-dim)', color: 'var(--erp-violet-light)', fontWeight: 700, fontSize: 12 }}>
                  {user.name[0]}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--erp-text)' }}>{user.name}</p>
                  <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>{user.email}</p>
                </div>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ background: 'var(--erp-violet-dim)', color: 'var(--erp-violet-light)' }}>
                  {user.role}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Setup guide */}
        <Card padding="lg">
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--erp-text)' }}>Como ativar uma integraÃ§Ã£o</p>
          <div className="space-y-3">
            {[
              'Copie os valores da variÃ¡vel no painel da Vercel (Settings â†’ Environment Variables)',
              'Adicione a chave correspondente no `.env` local para desenvolvimento',
              'Atualize esta tela e confirme o status no painel acima',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full mt-0.5"
                  style={{ background: 'var(--erp-violet-dim)', color: 'var(--erp-violet-light)', fontSize: 10, fontWeight: 700 }}>
                  {i + 1}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}>{step}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
