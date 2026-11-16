import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '../core/store/useAuthStore';
import { API_BASE_URL } from '../services/api';

const LOGO_SRC = '/Logo%20com%20Tipografia%204Core%20-%20Principal%20Transparente.png';

/** A entrada da plataforma.
 *
 *  Era a última tela que o redesenho não tinha tocado: fundo quase branco,
 *  campos em `rounded-full` com anel violeta claro e `text-slate-950`, de antes
 *  de os tokens existirem. Era também a primeira coisa que alguém vê do sistema,
 *  e não parecia o mesmo produto do que vinha depois do login.
 *
 *  O fundo é a ameixa quase preta da identidade (#10001F, a mesma do feed), com
 *  um feixe de luz descendo do alto. O feixe é CSS: dois cones de gradiente
 *  borrados e girados, em vez de canvas ou WebGL. Numa tela que existe para
 *  receber um e-mail e uma senha, subir um contexto de GPU para desenhar luz
 *  seria custo de carregamento sem nada em troca.
 *
 *  O movimento do feixe está atrás de `prefers-reduced-motion`, e sem ele o
 *  desenho continua inteiro: a animação só balança o que já está lá. */
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      const code = (err as { code?: string })?.code;
      if (detail) {
        setError(String(detail));
      } else if (code === 'ERR_NETWORK') {
        setError(
          `Não foi possível conectar à API em ${API_BASE_URL}. Confira VITE_API_BASE_URL e se o backend está publicado.`,
        );
      } else {
        setError('Não foi possível entrar. Confira seus dados e se a API está em execução.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* ── O fundo ───────────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(130% 90% at 50% -10%, #2b0a52 0%, #16002c 45%, #0b0016 100%)',
        }}
      />

      {/* O feixe. Dois cones: um largo e fraco que dá o volume, e um estreito e
          forte que dá a aresta. Sem o estreito a luz vira neblina; sem o largo
          vira um risco. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="login-beam login-beam--wide"
          style={{
            background:
              'linear-gradient(180deg, rgba(155,53,255,0.42) 0%, rgba(123,0,255,0.16) 42%, rgba(123,0,255,0) 78%)',
          }}
        />
        <div
          className="login-beam login-beam--tight"
          style={{
            background:
              'linear-gradient(180deg, rgba(226,210,255,0.55) 0%, rgba(155,53,255,0.22) 38%, rgba(155,53,255,0) 72%)',
          }}
        />
        {/* A fonte da luz, no alto. É o que faz o feixe parecer sair de algum
            lugar em vez de começar no nada. */}
        <div
          className="absolute left-1/2 top-0 h-[180px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[70px]"
          style={{ background: 'rgba(179,110,255,0.42)' }}
        />
      </div>

      {/* A grade, bem fraca, só para a luz ter em que cair. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(70% 60% at 50% 35%, #000 0%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(70% 60% at 50% 35%, #000 0%, transparent 100%)',
        }}
      />

      {/* ── O cartão ──────────────────────────────────────────────────────── */}
      <div className="relative w-full max-w-[420px]">
        <div
          className="rounded-[26px] border px-7 py-9 sm:px-9"
          style={{
            borderColor: 'rgba(179,110,255,0.18)',
            background: 'rgba(22,4,44,0.62)',
            backdropFilter: 'blur(18px)',
            boxShadow: '0 30px 80px -30px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          {/* O logo em 56px de altura. Em 48px, dentro de um cartão de 420px, a
              tipografia da marca ficava ilegível. */}
          <img src={LOGO_SRC} alt="4Core" className="h-14 w-auto object-contain object-left" />

          <h1 className="mt-7 text-[1.75rem] font-bold leading-tight tracking-tight text-white">
            Acesso à plataforma
          </h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'rgba(226,219,246,0.62)' }}>
            Entre para acompanhar a operação, os clientes e a saúde financeira da empresa.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(226,219,246,0.5)' }}>
                E-mail
              </span>
              <input
                required
                type="email"
                autoComplete="email"
                className="login-field mt-2"
                placeholder="nome@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(226,219,246,0.5)' }}>
                Senha
              </span>
              <div className="relative mt-2">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="login-field pr-12"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {/* Ver a senha existe porque errar a digitação num campo mascarado
                    é o motivo mais comum de "não consigo entrar". */}
                <button
                  type="button"
                  onClick={() => setShowPassword((atual) => !atual)}
                  aria-label={showPassword ? 'Esconder a senha' : 'Mostrar a senha'}
                  className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl transition-colors hover:bg-white/10"
                  style={{ color: 'rgba(226,219,246,0.6)' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {error && (
              <p
                className="rounded-2xl px-4 py-3 text-sm"
                style={{
                  background: 'rgba(255,92,138,0.10)',
                  border: '1px solid rgba(255,92,138,0.28)',
                  color: '#ffb3c6',
                }}
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              disabled={loading}
              className="group mt-2 flex min-h-tap w-full items-center justify-center gap-2 rounded-2xl px-4 font-semibold text-white transition-transform active:translate-y-px disabled:cursor-wait disabled:opacity-70"
              style={{
                background: 'linear-gradient(180deg, #8f16ff 0%, #6a00d6 100%)',
                boxShadow: '0 12px 30px -12px rgba(143,22,255,0.85)',
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Entrando
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: 'rgba(226,219,246,0.32)' }}>
          4Core Consultoria · controle de ponto, acesso e conformidade
        </p>
      </div>
    </div>
  );
}
