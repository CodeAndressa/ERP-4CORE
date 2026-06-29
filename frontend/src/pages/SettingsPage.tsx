import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AlertCircle, Brain, Camera, CheckCircle, DollarSign, Globe, Mail, Save, Shield, UserPlus, Users } from 'lucide-react';
import { Card } from '../shared/components/ui/Card';

type IntegrationStatus = {
  site_analytics: boolean;
  financial: boolean;
  instagram: boolean;
  ai: boolean;
  email: boolean;
  contract_storage?: boolean;
};

type User = {
  id: number;
  full_name: string;
  email: string;
  is_active: boolean;
};

const INTEGRATIONS = [
  { key: 'site_analytics' as const, label: 'Métricas do Site', desc: 'Supabase · acessos, conversões e leads', icon: Globe },
  { key: 'financial' as const, label: 'Financeiro', desc: 'ASAAS · cobranças e pagamentos', icon: DollarSign },
  { key: 'instagram' as const, label: 'Instagram Business', desc: 'Meta · métricas e conteúdo', icon: Camera },
  { key: 'ai' as const, label: 'Assistente IA', desc: 'Groq · recomendações e análises', icon: Brain },
  { key: 'email' as const, label: 'E-mail transacional', desc: 'Resend · avisos e automações', icon: Mail },
  { key: 'contract_storage' as const, label: 'Contratos PDF', desc: 'Supabase Storage · arquivos vinculados a clientes', icon: Shield },
];

export default function SettingsPage() {
  const [status, setStatus] = useState<IntegrationStatus>({ site_analytics: false, financial: false, instagram: false, ai: false, email: false, contract_storage: false });
  const [users, setUsers] = useState<User[]>([]);
  const [checked, setChecked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userMessage, setUserMessage] = useState('');
  const [userError, setUserError] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });

  function loadUsers() {
    return api.get<User[]>('/auth/users').then(({ data }) => setUsers(data));
  }

  useEffect(() => {
    api.get<IntegrationStatus>('/integrations/status')
      .then(({ data }) => setStatus(data))
      .catch(() => undefined)
      .finally(() => setChecked(true));
    loadUsers().catch(() => undefined);
  }, []);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function createUser() {
    setUserError('');
    setUserMessage('');
    if (!form.full_name || !form.email || !form.password) {
      setUserError('Preencha nome, e-mail e senha.');
      return;
    }
    if (form.password.length < 6) {
      setUserError('Use uma senha com pelo menos 6 caracteres.');
      return;
    }

    setCreatingUser(true);
    try {
      const { data } = await api.post<User>('/auth/users', form);
      setUsers((prev) => [data, ...prev]);
      setForm({ full_name: '', email: '', password: '' });
      setUserMessage('Usuário criado com sucesso.');
    } catch (e: any) {
      setUserError(e?.response?.data?.detail || 'Erro ao criar usuário.');
    } finally {
      setCreatingUser(false);
    }
  }

  const activeCount = Object.values(status).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--erp-violet-light)' }}>Administração</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Configurações</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--erp-text-muted)' }}>{activeCount} de {INTEGRATIONS.length} integrações ativas</p>
        </div>
        <button onClick={handleSave} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all" style={{ background: saved ? '#ecfdf5' : 'var(--erp-violet)', color: saved ? '#047857' : '#fff' }}>
          {saved ? <CheckCircle size={14} /> : <Save size={14} />}
          {saved ? 'Salvo!' : 'Salvar alterações'}
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card padding="lg">
          <p className="mb-4 text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Dados da empresa</p>
          <p className="mb-4 text-xs" style={{ color: 'var(--erp-text-muted)' }}>Exibidos em documentos e comunicações</p>
          <div className="space-y-3">
            {[
              { label: 'Nome da empresa', value: '4Core Consultoria Estratégica' },
              { label: 'CNPJ', value: '00.000.000/0001-00' },
              { label: 'E-mail financeiro', value: 'financeiro@4core.com.br' },
              { label: 'Telefone', value: '+55 (11) 90000-0000' },
            ].map((field) => (
              <div key={field.label}>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>{field.label}</label>
                <input defaultValue={field.value} className="w-full rounded-full px-3 py-2 text-sm outline-none" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
              </div>
            ))}
          </div>
        </Card>

        <Card padding="lg">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Status das integrações</p>
            <span className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>{checked ? 'Leitura atual do backend' : 'Verificando...'}</span>
          </div>
          <div className="space-y-3">
            {INTEGRATIONS.map(({ key, label, desc, icon: Icon }) => {
              const active = status[key];
              return (
                <div key={key} className="flex items-center gap-3 rounded-[22px] px-3 py-3" style={{ background: active ? '#ecfdf5' : 'var(--erp-surface-2)', border: `1px solid ${active ? '#bbf7d0' : 'var(--erp-border)'}` }}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: active ? '#d1fae5' : 'var(--erp-surface)' }}><Icon size={14} style={{ color: active ? '#047857' : 'var(--erp-text-dim)' }} /></div>
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium" style={{ color: 'var(--erp-text)' }}>{label}</p><p className="truncate text-xs" style={{ color: 'var(--erp-text-muted)' }}>{desc}</p></div>
                  <div className="flex shrink-0 items-center gap-1.5">{active ? <CheckCircle size={13} style={{ color: '#047857' }} /> : <AlertCircle size={13} style={{ color: '#b45309' }} />}<span className="text-xs font-medium" style={{ color: active ? '#047857' : '#b45309' }}>{active ? 'Ativa' : 'Pendente'}</span></div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card padding="lg">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Usuários do sistema</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}>Crie acessos internos para a plataforma</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-700"><Shield size={15} /></div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <input value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} placeholder="Nome completo" className="rounded-full px-3 py-2 text-sm outline-none" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
            <input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@empresa.com" type="email" className="rounded-full px-3 py-2 text-sm outline-none" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
            <input value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="Senha inicial" type="password" className="rounded-full px-3 py-2 text-sm outline-none" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }} />
          </div>
          <button onClick={createUser} disabled={creatingUser} className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: 'var(--erp-violet)' }}><UserPlus size={14} />{creatingUser ? 'Criando...' : 'Criar usuário'}</button>
          {(userError || userMessage) && <p className="mt-3 text-sm" style={{ color: userError ? '#be123c' : '#047857' }}>{userError || userMessage}</p>}

          <div className="mt-5 space-y-2">
            {users.map((user) => (
              <div key={user.id} className="flex items-center gap-3 rounded-[22px] px-3 py-3" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)' }}>
                <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'var(--erp-violet-dim)', color: 'var(--erp-violet-light)', fontWeight: 700, fontSize: 12 }}>{user.full_name[0]}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium" style={{ color: 'var(--erp-text)' }}>{user.full_name}</p><p className="truncate text-xs" style={{ color: 'var(--erp-text-muted)' }}>{user.email}</p></div>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: user.is_active ? '#ecfdf5' : 'var(--erp-surface)', color: user.is_active ? '#047857' : 'var(--erp-text-muted)' }}>{user.is_active ? 'Ativo' : 'Inativo'}</span>
              </div>
            ))}
            {users.length === 0 && <div className="flex items-center gap-2 rounded-[22px] border border-dashed border-violet-100 px-3 py-4 text-sm" style={{ color: 'var(--erp-text-muted)' }}><Users size={14} />Nenhum usuário encontrado</div>}
          </div>
        </Card>

        <Card padding="lg">
          <p className="mb-3 text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Como ativar uma integração</p>
          <div className="space-y-3">
            {[
              'Copie os valores da variável no painel da Vercel em Settings → Environment Variables',
              'Adicione a chave correspondente no .env local para desenvolvimento',
              'Atualize esta tela e confirme o status no painel acima',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3"><div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--erp-violet-dim)', color: 'var(--erp-violet-light)', fontSize: 10, fontWeight: 700 }}>{i + 1}</div><p className="text-sm leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}>{step}</p></div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
