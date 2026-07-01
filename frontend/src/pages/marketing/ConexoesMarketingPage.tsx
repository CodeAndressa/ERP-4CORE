import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy, ExternalLink, Link2, RefreshCw, ShieldAlert,
  CheckCircle2, XCircle, Clock, Info,
} from 'lucide-react';
import { API_BASE_URL, api } from '../../services/api';
import { Card, CardHeader } from '../../shared/components/ui/Card';

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface IgProfile {
  id?: string;
  username?: string;
  name?: string;
  followers_count?: number;
  media_count?: number;
  profile_picture_url?: string;
}

interface MetaPage {
  id: string;
  name: string;
  category?: string;
  access_token?: string;
  tasks?: string[];
  instagram_business_account?: { id: string; username?: string };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        background: ok ? '#d1fae5' : '#fef3c7',
        color: ok ? '#065f46' : '#92400e',
      }}>
      {ok
        ? <CheckCircle2 size={12} />
        : <XCircle size={12} />}
      {label}
    </span>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ConexoesMarketingPage() {
  const [fbStatus, setFbStatus] = useState<MetaStatus | null>(null);
  const [igProfile, setIgProfile] = useState<IgProfile | null>(null);
  const [igError, setIgError] = useState<string | null>(null);
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [message, setMessage] = useState('');
  const redirectUri = useMemo(() => `${window.location.origin}/marketing/conexoes`, []);
  // Evita dupla execução do callback OAuth (React StrictMode roda effects 2x em dev)
  const callbackFired = useRef(false);

  function errorDetail(error: any, fallback: string) {
    return error?.response?.data?.detail || error?.message || fallback;
  }

  function loadStatus() {
    api.get<MetaStatus>('/marketing/meta/status')
      .then(({ data }) => setFbStatus(data))
      .catch((err) => setMessage(
        `Status Meta falhou (${err?.response?.status ?? 'sem status'}) em ${API_BASE_URL}/marketing/meta/status: ${errorDetail(err, 'erro desconhecido')}`
      ));
  }

  function loadIgProfile() {
    api.get<IgProfile>('/marketing/meta/instagram/profile')
      .then(({ data }) => { setIgProfile(data); setIgError(null); })
      .catch((err) => setIgError(errorDetail(err, 'Não foi possível carregar o perfil do Instagram.')));
  }

  useEffect(() => {
    loadStatus();
    loadIgProfile();
  }, []);

  // Processa callback do OAuth — useRef evita duplo disparo do StrictMode em dev
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code || callbackFired.current) return;
    callbackFired.current = true;

    // Remove o ?code= da URL antes de chamar a API para evitar reuso acidental
    window.history.replaceState({}, '', '/marketing/conexoes');

    setOauthLoading(true);
    api.get('/marketing/meta/callback', { params: { code, redirect_uri: redirectUri } })
      .then(({ data }) => {
        setPages(data.pages ?? []);
        setMessage('Conexão autorizada. Escolha a página da 4Core e copie os valores para as variáveis de ambiente.');
        loadIgProfile();
      })
      .catch((err) => setMessage(err?.response?.data?.detail || 'Não foi possível concluir a conexão com a Meta.'))
      .finally(() => setOauthLoading(false));
  }, [redirectUri]);

  async function connectMeta() {
    setOauthLoading(true);
    setMessage('');
    try {
      const { data } = await api.get('/marketing/meta/auth-url', { params: { redirect_uri: redirectUri } });
      window.location.assign(data.url);
    } catch (err: any) {
      setMessage(`Conectar Meta falhou (${err?.response?.status ?? 'sem status'}): ${errorDetail(err, 'Configure META_APP_ID e META_APP_SECRET no backend.')}`);
      setOauthLoading(false);
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

  const fbConnected = Boolean(fbStatus?.page_connected);
  const igConnected = Boolean(igProfile?.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--erp-violet-light)' }}>Marketing</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Conexões</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--erp-text-muted)' }}>
          Gerencie as integrações das plataformas de marketing.
        </p>
      </div>

      {message && (
        <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}>
          <ShieldAlert size={15} className="mt-0.5 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* ── Instagram ──────────────────────────────────────────────────────── */}
      <Card padding="lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              {/* Instagram gradient icon */}
              <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white text-sm font-bold shrink-0"
                style={{ background: 'linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)' }}>
                IG
              </div>
              <div>
                <CardHeader title="Instagram" subtitle="Instagram Business Account · Meta Graph API" />
              </div>
            </div>

            {/* Aviso sobre o fluxo OAuth */}
            <div className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
              style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', color: 'var(--erp-text-muted)' }}>
              <Info size={13} className="mt-0.5 shrink-0" />
              <span>
                O Instagram Business usa autenticação via <strong style={{ color: 'var(--erp-text)' }}>Facebook</strong> — ao clicar,
                abrirá o login do Facebook para autorizar o acesso à conta Instagram vinculada. Isso é normal.
              </span>
            </div>

            <div className="mt-3 space-y-2 text-sm" style={{ color: 'var(--erp-text-muted)' }}>
              {igConnected && igProfile ? (
                <>
                  <div className="flex items-center gap-2">
                    <StatusBadge ok={true} label="Conectado" />
                    {igProfile.username && (
                      <span style={{ color: 'var(--erp-text)' }}>@{igProfile.username}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 mt-2">
                    <div className="rounded-xl p-3 text-center" style={{ background: 'var(--erp-surface-2)' }}>
                      <p className="text-lg font-bold" style={{ color: 'var(--erp-text)' }}>
                        {(igProfile.followers_count ?? 0).toLocaleString('pt-BR')}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>Seguidores</p>
                    </div>
                    <div className="rounded-xl p-3 text-center" style={{ background: 'var(--erp-surface-2)' }}>
                      <p className="text-lg font-bold" style={{ color: 'var(--erp-text)' }}>
                        {igProfile.media_count ?? 0}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>Publicações</p>
                    </div>
                    <div className="rounded-xl p-3 text-center" style={{ background: 'var(--erp-surface-2)' }}>
                      <p className="text-xs font-medium" style={{ color: 'var(--erp-text)' }}>
                        {igProfile.id}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>Account ID</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge ok={false} label="Não vinculado" />
                  </div>
                  {/* Instruções de vinculação */}
                  <div className="rounded-xl p-3 space-y-1.5 text-xs"
                    style={{ background: '#fef9c3', border: '1px solid #fde047', color: '#713f12' }}>
                    <p className="font-semibold">Como vincular o Instagram à página Facebook:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Acesse sua <strong>Página do Facebook</strong> (4Core Consultoria)</li>
                      <li>Vá em <strong>Configurações → Instagram</strong></li>
                      <li>Clique em <strong>"Conectar conta do Instagram"</strong></li>
                      <li>Faça login com a conta Instagram da 4Core</li>
                      <li>Volte aqui e clique em <strong>"Conectar via Meta"</strong></li>
                    </ol>
                    <a
                      href={`https://www.facebook.com/${fbStatus?.page_id ?? ''}/settings/?tab=instagram`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold mt-1"
                      style={{ color: '#1877f2' }}
                    >
                      Abrir configurações da página <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={connectMeta}
            disabled={oauthLoading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold shrink-0"
            style={{
              background: 'linear-gradient(135deg, #ee2a7b, #6228d7)',
              color: '#fff',
              opacity: oauthLoading ? 0.7 : 1,
            }}
          >
            {oauthLoading ? <RefreshCw size={16} className="animate-spin" /> : <Link2 size={16} />}
            {igConnected ? 'Reconectar via Meta' : 'Conectar via Meta'}
          </button>
        </div>
      </Card>

      {/* ── Facebook Page ──────────────────────────────────────────────────── */}
      <Card padding="lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white text-sm font-bold shrink-0"
                style={{ background: '#1877f2' }}>
                f
              </div>
              <div>
                <CardHeader title="Facebook" subtitle="Página de negócios · usada como ponte para Instagram" />
              </div>
            </div>

            <div className="mt-3 space-y-1.5 text-sm" style={{ color: 'var(--erp-text-muted)' }}>
              <div className="flex items-center gap-2">
                <StatusBadge ok={fbConnected} label={fbConnected ? 'Página conectada' : 'Não configurado'} />
              </div>
              {fbStatus && (
                <>
                  <p>App ID: <strong style={{ color: 'var(--erp-text)' }}>{fbStatus.app_id || '—'}</strong></p>
                  <p>Page ID: <strong style={{ color: 'var(--erp-text)' }}>{fbStatus.page_id || '—'}</strong></p>
                  <p>Token: <strong style={{ color: 'var(--erp-text)' }}>{fbStatus.token || '—'}</strong></p>
                  <p className="text-xs mt-1 opacity-70">
                    A página Facebook é necessária para acessar a API de negócios do Instagram.
                  </p>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={connectMeta}
            disabled={oauthLoading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold shrink-0"
            style={{
              background: '#1877f2',
              color: '#fff',
              opacity: oauthLoading ? 0.7 : 1,
            }}
          >
            {oauthLoading ? <RefreshCw size={16} className="animate-spin" /> : <Link2 size={16} />}
            {fbConnected ? 'Reconectar Facebook' : 'Conectar Facebook'}
          </button>
        </div>
      </Card>

      {/* ── WhatsApp ───────────────────────────────────────────────────────── */}
      <Card padding="lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white text-sm font-bold shrink-0"
                style={{ background: '#25d366' }}>
                W
              </div>
              <div>
                <CardHeader title="WhatsApp" subtitle="WhatsApp Business API · em breve" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{ background: '#e0e7ff', color: '#3730a3' }}>
                <Clock size={12} />
                Em breve
              </span>
              <span className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                Envio de campanhas e atendimento automatizado
              </span>
            </div>
          </div>
          <button
            disabled
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold shrink-0 opacity-40 cursor-not-allowed"
            style={{ background: '#25d366', color: '#fff' }}
          >
            <Link2 size={16} />
            Conectar WhatsApp
          </button>
        </div>
      </Card>

      {/* ── Páginas OAuth (após callback) ────────────────────────────────── */}
      {pages.length > 0 && (
        <Card padding="lg">
          <CardHeader title="Páginas disponíveis" subtitle="Selecione a página 4Core e copie as variáveis de ambiente" />
          <div className="mt-3 space-y-3">
            {pages.map((page) => (
              <div key={page.id}
                className="flex flex-col gap-3 rounded-xl p-4 md:flex-row md:items-center md:justify-between"
                style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)' }}>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--erp-text)' }}>{page.name}</p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                    ID {page.id} · {page.category ?? 'Página'}
                    {page.instagram_business_account?.username
                      ? ` · Instagram @${page.instagram_business_account.username}`
                      : ' · sem Instagram vinculado'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyEnv(page)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold"
                  style={{ background: '#fff', border: '1px solid var(--erp-border)', color: 'var(--erp-text)' }}
                >
                  <Copy size={14} />
                  Copiar variáveis
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Instruções ────────────────────────────────────────────────────── */}
      <Card padding="lg">
        <CardHeader title="Configuração no painel da Meta" subtitle="Adicione a URL de redirecionamento no app" />
        <div className="mt-3 space-y-2 text-sm" style={{ color: 'var(--erp-text-muted)' }}>
          <p>Em <strong style={{ color: 'var(--erp-text)' }}>Valid OAuth Redirect URIs</strong>, adicione:</p>
          <code className="block rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--erp-surface-2)', color: 'var(--erp-text)' }}>
            {redirectUri}
          </code>
          <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--erp-violet-light)' }}>
            Abrir painel de apps <ExternalLink size={13} />
          </a>
        </div>
      </Card>
    </div>
  );
}
