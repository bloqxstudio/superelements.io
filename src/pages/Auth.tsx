import React, { useEffect, useState } from 'react';
import './Auth.css';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, BellRing, CheckCircle, Eye, EyeOff, Loader2, PenLine, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { SinfyMark } from '@/features/sinfy/SinfyBrand';

type Mode = 'login' | 'signup';

/** O logo da Sinfy: símbolo + "sinfy." (ponto lima no escuro, verde-tinta no claro), como em brands/sinfy/DESIGN.md. */
const Wordmark = ({ dark }: { dark?: boolean }) => (
  <span className={dark ? 'sa-wordmark sa-wordmark--dark' : 'sa-wordmark'} aria-label="Sinfy">
    <SinfyMark />
    <span aria-hidden>
      sinfy<b>.</b>
    </span>
  </span>
);

/** O que a Sinfy entrega (a mesma oferta da /lp): só o que o produto faz hoje. */
const OUTCOMES = [
  { icon: PenLine, title: 'Posts e vídeos na marca', text: 'Os agentes criam posts, carrosséis e vídeos com a identidade de cada cliente.' },
  { icon: BellRing, title: 'O lead chega, o aviso também', text: 'Contato novo vai na hora para o WhatsApp da equipe, com a origem.' },
  { icon: TrendingUp, title: 'Venda que o cliente vê', text: 'Quais posts e campanhas viraram conversa e venda, num relatório só.' },
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
    <div className="sa">
      <aside className="sa-aside">
        <Wordmark dark />
        <div className="sa-offer">
          <div>
            <p className="sa-eyebrow">Feito com agentes de IA</p>
            <h2 className="sa-title">
              <span className="sa-title-line">Do post no Instagram</span>
              <span className="sa-title-line">à venda,</span>
              <span className="sa-title-line sa-title-soft">num lugar só.</span>
            </h2>
            <p className="sa-lead">Instagram, anúncios, site, WhatsApp e CRM juntos. Os agentes fazem o trabalho repetido; você decide e fecha.</p>
          </div>
          <ul className="sa-outcomes">
            {OUTCOMES.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <span className="sa-outcome-icon">
                  <Icon aria-hidden />
                </span>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="sa-foot">© Sinfy · Também faz sites em Elementor para cada cliente.</p>
      </aside>

      <main className="sa-main">
        <div className="sa-form-wrap">
          <div className="sa-mobile-head">
            <Wordmark />
            <p>Do post no Instagram à venda, num lugar só. Feito com agentes de IA.</p>
          </div>

          {sent ? (
            <div className="sa-stack">
              <span className="sa-done-icon">
                <CheckCircle aria-hidden />
              </span>
              <div className="sa-heading">
                <h1>Confira seu email</h1>
                <p>
                  Enviamos um link de confirmação para <strong>{email}</strong>. Clique nele para ativar a conta e depois entre.
                </p>
              </div>
              <button
                type="button"
                className="sa-button sa-button--primary"
                onClick={() => {
                  setSent(false);
                  switchMode('login');
                }}
              >
                Ir para o login
                <ArrowRight aria-hidden />
              </button>
            </div>
          ) : (
            <div className="sa-stack">
              <div className="sa-heading">
                <h1>{signup ? 'Criar sua conta' : 'Bem-vindo de volta'}</h1>
                <p>{signup ? 'Leva menos de um minuto. Depois você conecta Instagram, anúncios e site.' : 'Entre para ver seus leads, campanhas e conteúdos.'}</p>
              </div>

              <button type="button" onClick={google} disabled={loading} className="sa-button sa-button--google">
                <GoogleIcon />
                Continuar com Google
              </button>

              <div className="sa-divider">ou com email</div>

              <form onSubmit={submit} className="sa-fields">
                <div className="sa-field-group">
                  <Label htmlFor="email" className="sa-label">
                    Email
                  </Label>
                  <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} placeholder="voce@empresa.com" className="sa-field" />
                </div>

                <div className="sa-field-group">
                  <Label htmlFor="password" className="sa-label">
                    Senha
                  </Label>
                  <div className="sa-password">
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
                      className="sa-field"
                    />
                    <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Esconder a senha' : 'Mostrar a senha'} className="sa-eye">
                      {show ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                    </button>
                  </div>
                </div>

                {signup && (
                  <div className="sa-field-group">
                    <Label htmlFor="phone" className="sa-label">
                      Telefone
                    </Label>
                    <PhoneInput id="phone" value={phone} onChange={setPhone} disabled={loading} className="sa-field" />
                  </div>
                )}

                {error && (
                  <p role="alert" className="sa-error">
                    {error}
                  </p>
                )}

                <button type="submit" disabled={loading} className="sa-button sa-button--primary" style={{ marginTop: 4 }}>
                  {signup ? 'Criar conta' : 'Entrar'}
                  {loading ? <Loader2 className="animate-spin" aria-hidden /> : <ArrowRight aria-hidden />}
                </button>
              </form>

              <p className="sa-switch">
                {signup ? 'Já tem conta?' : 'Ainda não tem conta?'}{' '}
                <button type="button" onClick={() => switchMode(signup ? 'login' : 'signup')} className="sa-link">
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
