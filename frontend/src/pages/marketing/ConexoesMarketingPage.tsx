import { useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, Link2, RefreshCw, ShieldAlert } from 'lucide-react';
import { API_BASE_URL, api } from '../../services/api';
import { Card, CardHeader } from '../../shared/components/ui/Card';

interface MetaStatus {
  configured: boolean;
  app_id?: string;
  redirect_uri?: string;
  page_connected: boolean;
  page_id?: string;
  token?: string;
  graph_version?: string;
  required_env: string[];
}

interface MetaPage {
  id: string;
  name: string;
  category?: string;
  access_token?: string;
  tasks?: string[];
  instagram_business_account?: { id: string; username?: string };
}

export default function ConexoesMarketingPage() {
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const redirectUri = useMemo(() => `${window.location.origin}/marketing/conexoes`, []);

  function errorDetail(error: any, fallback: string) {
    return error?.response?.data?.detail || error?.message || fallback;
  }

  function loadStatus() {
    api.get<MetaStatus>('/marketing/meta/status')
      .then(({ data }) => setStatus(data))
      .catch((error) => {
        setStatus(null);
        setMessage(`Status Meta falhou (${error?.response?.status ?? 'sem status'}) em ${API_BASE_URL}/marketing/meta/status: ${errorDetail(error, 'erro desconhecido')}`);
      });
  }

  useEffect(() => { loadStatus(); }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;
    setLoading(true);
    api.get('/marketing/meta/callback', { params: { code, redirect_uri: redirectUri } })
      .then(({ data }) => {
        setPages(data.pages ?? []);
        setMessage('Conexão autorizada. Escolha a página da 4Core e copie os valores para as variáveis de ambiente.');
        window.history.replaceState({}, '', '/marketing/conexoes');
      })
      .catch((error) => setMessage(error?.response?.data?.detail || 'Não foi possível concluir a conexão com a Meta.'))
      .finally(() => setLoading(false));
  }, [redirectUri]);

  async function connectMeta() {
    setLoading(true);
    setMessage('');
    try {
      const { data } = await api.get('/marketing/meta/auth-url', { params: { redirect_uri: redirectUri } });
      window.location.assign(data.url);
    } catch (error: any) {
      setMessage(`Conectar Meta falhou (${error?.response?.status ?? 'sem status'}) em ${API_BASE_URL}/marketing/meta/auth-url: ${errorDetail(error, 'Configure META_APP_ID e META_APP_SECRET no backend.')}`);
      setLoading(false);
    }
  }

  function copyEnv(page: MetaPage) {
    const content = [
      `META_PAGE_ID=${page.id}`,
      `META_PAGE_ACCESS_TOKEN=${page.access_token ?? ''}`,
      page.instagram_business_account?.id ? `INSTAGRAM_BUSINESS_ACCOUNT_ID=${page.instagram_business_account.id}` : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(content);
    setMessage('Variáveis copiadas. Cole no .env local e também na Vercel em Environment Variables.');
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--erp-violet-light)' }}>Marketing</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Conexões Meta</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--erp-text-muted)' }}>Conecte a página da 4Core para métricas, posts e campanhas.</p>
      </div>

      <Card padding="lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardHeader title="Facebook / Instagram" subtitle="OAuth da Meta Graph API" />
            <div className="mt-3 grid gap-2 text-sm" style={{ color: 'var(--erp-text-muted)' }}>
              <span>Redirect URI: <strong style={{ color: 'var(--erp-text)' }}>{redirectUri}</strong></span>
              <span>Backend API: <strong style={{ color: 'var(--erp-text)' }}>{API_BASE_URL}</strong></span>
              <span>App ID: <strong style={{ color: 'var(--erp-text)' }}>{status?.app_id || 'não configurado'}</strong></span>
              <span>Página conectada: <strong style={{ color: status?.page_connected ? '#059669' : '#b45309' }}>{status?.page_connected ? status.page_id : 'pendente'}</strong></span>
            </div>
          </div>
          <button type="button" onClick={connectMeta} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold" style={{ background: 'var(--erp-violet)', color: '#fff', opacity: loading ? 0.7 : 1 }}>
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Link2 size={16} />}
            Conectar Meta
          </button>
        </div>
      </Card>

      {message && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}>
          <ShieldAlert size={15} />
          {message}
        </div>
      )}

      <Card padding="lg">
        <CardHeader title="Páginas disponíveis" subtitle="Após autorizar, selecione a página 4Core e copie as variáveis" />
        <div className="space-y-3">
          {pages.map((page) => (
            <div key={page.id} className="flex flex-col gap-3 rounded-xl p-4 md:flex-row md:items-center md:justify-between" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)' }}>
              <div>
                <p className="font-semibold" style={{ color: 'var(--erp-text)' }}>{page.name}</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}>ID {page.id} · {page.category ?? 'Página'} {page.instagram_business_account?.username ? `· Instagram @${page.instagram_business_account.username}` : ''}</p>
              </div>
              <button type="button" onClick={() => copyEnv(page)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold" style={{ background: '#fff', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}>
                <Copy size={14} />
                Copiar variáveis
              </button>
            </div>
          ))}
          {!pages.length && <p className="py-8 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhuma página carregada ainda.</p>}
        </div>
      </Card>

      <Card padding="lg">
        <CardHeader title="Próximo passo na Meta" subtitle="Configuração necessária no painel de desenvolvedores" />
        <div className="space-y-2 text-sm" style={{ color: 'var(--erp-text-muted)' }}>
          <p>Na Meta, adicione esta URL em Valid OAuth Redirect URIs:</p>
          <code className="block rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--erp-surface-2)', color: 'var(--erp-text)' }}>{redirectUri}</code>
          <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--erp-violet-light)' }}>Abrir meus apps <ExternalLink size={13} /></a>
        </div>
      </Card>
    </div>
  );
}