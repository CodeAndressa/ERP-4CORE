import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn } from '../services/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch {
      setError('Não foi possível entrar. Confira seus dados e se a API está em execução.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f7fb] px-4 py-10 text-slate-950">
      <div className="w-full max-w-md rounded-[22px] border border-violet-100 bg-white px-8 py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-violet-600">4Core</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Acesso à plataforma</h1>
        <p className="mb-8 mt-3 text-sm text-slate-600">Entre para acompanhar a operação, os clientes e a saúde financeira da empresa.</p>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            E-mail
            <input required type="email" className="mt-2 w-full rounded-full border border-violet-100 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100" placeholder="nome@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Senha
            <input required type="password" className="mt-2 w-full rounded-full border border-violet-100 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="rounded-[22px] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
          <button disabled={loading} className="w-full rounded-full bg-violet-600 px-4 py-3 font-semibold text-white transition hover:bg-violet-700 disabled:cursor-wait disabled:opacity-70">{loading ? 'Entrando...' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  );
}
