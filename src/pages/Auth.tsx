import React, { useEffect, useState } from 'react';
import '@/styles/product.css';
import { useLocation, useNavigate } from 'react-router-dom';
import { BellRing, CheckCircle, Eye, EyeOff, Loader2, MapPin, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { cn } from '@/lib/utils';

type Mode = 'login' | 'signup';

const Logo = ({ dark }: { dark?: boolean }) => (
  <div className={cn('flex items-center gap-2 text-lg font-bold tracking-tight', dark ? 'text-white' : 'text-gray-900')}>
    <span className="h-3 w-3 rounded-[3px] bg-[#D2F525]" aria-hidden />
    Sinfy
  </div>
);

/** O que a Sinfy entrega (a mesma oferta da /lp): só o que o produto faz hoje. */
const OUTCOMES = [
  { icon: MapPin, title: 'Cada contato com origem', text: 'Anúncio, post ou página do site: você sabe de onde veio antes de responder.' },
  { icon: BellRing, title: 'O lead chega, o aviso também', text: 'Contato novo vai na hora para o WhatsApp da equipe, com nome e telefone.' },
  { icon: TrendingUp, title: 'Resultado que o cliente entende', text: 'Quais campanhas viraram conversa e venda, num relatório só.' },
];

const GoogleIcon = () => (
  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const errorText = (message: string) =>
  message === 'Invalid login credentials'
    ? 'Email ou senha incorretos.'
    : message === 'User already registered'
      ? 'Este email já tem conta. Entre com a sua senha.'
      : message === 'Email not confirmed'
        ? 'Confirme seu email pelo link que enviamos antes de entrar.'
        : message.includes('rate limit')
          ? 'Muitas tentativas. Aguarde um instante e tente de novo.'
          : 'Não deu certo. Tente de novo.';

export default function Auth() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const { signIn, signUp, signInWithGoogle, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';
  const signup = mode === 'signup';

  // Já logado (ou acabou de entrar): segue para onde a pessoa queria ir
  useEffect(() => {
    if (!authLoading && user) navigate(from, { replace: true });
  }, [user, authLoading, from, navigate]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (signup) {
      if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.');
      if (!phone || phone.length < 11) return setError('Informe um telefone válido, com DDD.');
    }
    setLoading(true);
    const { error: failure } = signup ? await signUp(email.trim(), password, phone) : await signIn(email.trim(), password);
    setLoading(false);
    if (failure) return setError(errorText(String(failure.message ?? '')));
    if (signup) setSent(true);
  };

  const google = async () => {
    setLoading(true);
    setError(null);
    const { error: failure } = await signInWithGoogle();
    if (failure) {
      setError('Não foi possível entrar com o Google. Tente de novo.');
      setLoading(false);
    }
  };

  return (
    <div className="se-product se-auth grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#09090B] p-12 text-white lg:flex">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} aria-hidden />
        <div className="relative">
          <Logo dark />
        </div>
        <div className="relative space-y-10">
          <div className="space-y-5">
            <p className="flex items-center gap-2 text-sm text-white/60">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D2F525]" aria-hidden />
              Instagram, anúncios, site, WhatsApp e CRM
            </p>
            <h2 className="max-w-md text-[2.75rem] font-semibold leading-[1.05] tracking-tight">
              Do anúncio à venda, <span className="text-[#D2F525]">num lugar só.</span>
            </h2>
            <p className="max-w-md text-base leading-relaxed text-white/60">
              Veja qual campanha vira conversa, responda cada lead a tempo e mostre ao cliente o que virou negócio.
            </p>
          </div>
          <ul className="max-w-md space-y-5">
            {OUTCOMES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[#D2F525]">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-white">{title}</p>
                  <p className="text-sm leading-relaxed text-white/50">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/40">© Sinfy · Sites em Elementor, posts e vídeos na marca de cada cliente também moram aqui.</p>
      </aside>

      <main className="flex items-center justify-center bg-white px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-10 space-y-3 lg:hidden">
            <Logo />
            <p className="text-sm text-gray-600">Do anúncio à venda, num lugar só: Instagram, anúncios, site, WhatsApp e CRM.</p>
          </div>

          {sent ? (
            <div className="space-y-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle className="h-6 w-6" aria-hidden />
              </span>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-gray-900">Confira seu email</h1>
                <p className="text-sm text-gray-600">
                  Enviamos um link de confirmação para <strong className="text-gray-900">{email}</strong>. Clique nele para ativar a conta e depois entre.
                </p>
              </div>
              <Button
                className="h-11 w-full"
                onClick={() => {
                  setSent(false);
                  switchMode('login');
                }}
              >
                Ir para o login
              </Button>
            </div>
          ) : (
            <div className="space-y-7">
              <div className="space-y-1.5">
                <h1 className="text-2xl font-semibold text-gray-900">{signup ? 'Criar sua conta' : 'Bem-vindo de volta'}</h1>
                <p className="text-sm text-gray-600">{signup ? 'Leva menos de um minuto. Depois você conecta Instagram, anúncios e site.' : 'Entre para ver seus leads, campanhas e conteúdos.'}</p>
              </div>

              <Button type="button" variant="outline" onClick={google} disabled={loading} className="h-11 w-full gap-3 border-gray-300 font-medium">
                <GoogleIcon />
                Continuar com Google
              </Button>

              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="h-px flex-1 bg-gray-200" />
                ou com email
                <span className="h-px flex-1 bg-gray-200" />
              </div>

              <form onSubmit={submit} className="space-y-4" noValidate={false}>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm text-gray-700">
                    Email
                  </Label>
                  <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} placeholder="voce@empresa.com" className="h-11 border-gray-300" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-sm text-gray-700">
                    Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={show ? 'text' : 'password'}
                      autoComplete={signup ? 'new-password' : 'current-password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      placeholder={signup ? 'Pelo menos 6 caracteres' : 'Sua senha'}
                      className="h-11 border-gray-300 pr-11"
                    />
                    <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Esconder a senha' : 'Mostrar a senha'} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                      {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                    </button>
                  </div>
                </div>

                {signup && (
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-sm text-gray-700">
                      Telefone
                    </Label>
                    <PhoneInput value={phone} onChange={setPhone} disabled={loading} className="h-11 border-gray-300" />
                  </div>
                )}

                {error && (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                )}

                <Button type="submit" disabled={loading} className="h-11 w-full font-medium">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                  {signup ? 'Criar conta' : 'Entrar'}
                </Button>
              </form>

              <p className="text-center text-sm text-gray-600">
                {signup ? 'Já tem conta?' : 'Ainda não tem conta?'}{' '}
                <button type="button" onClick={() => switchMode(signup ? 'login' : 'signup')} className="font-semibold text-gray-900 underline-offset-4 hover:underline">
                  {signup ? 'Entrar' : 'Criar conta'}
                </button>
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
