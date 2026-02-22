import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PhoneInput } from '@/components/ui/phone-input';
import { Mail, Lock, ArrowLeft, Phone, CheckCircle } from 'lucide-react';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'initial' | 'login' | 'signup' | 'confirm-email'>('initial');
  const [isSignUp, setIsSignUp] = useState(false);
  
  const { signIn, signUp, signInWithGoogle, user, loading: authLoading } = useAuth();
  const { activeWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const navigate = useNavigate();

  // Redirect if already authenticated (e.g. user visits /auth while logged in)
  // If workspace is selected, go to /inicio. Otherwise, force /workspace selection.
  useEffect(() => {
    if (authLoading || workspaceLoading) return;

    if (user) {
      navigate(activeWorkspace ? '/' : '/workspace', { replace: true });
    }
  }, [user, activeWorkspace, authLoading, workspaceLoading, navigate]);

  const handleLoginClick = () => {
    if (!email || !email.includes('@')) {
      setError('Por favor, insira um email válido');
      return;
    }
    setError(null);
    setStep('login');
    setIsSignUp(false);
  };

  const handleSignupClick = () => {
    if (!email || !email.includes('@')) {
      setError('Por favor, insira um email válido');
      return;
    }
    setError(null);
    setStep('signup');
    setIsSignUp(true);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validations for signup
    if (isSignUp) {
      if (password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres');
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('As senhas não coincidem');
        setLoading(false);
        return;
      }
      if (!phone || phone.length < 11) {
        setError('Por favor, insira um número de telefone válido');
        setLoading(false);
        return;
      }
    }

    const { error } = isSignUp
      ? await signUp(email, password, phone)
      : await signIn(email, password);

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Email ou senha incorretos'
          : error.message === 'User already registered'
          ? 'Este email já está cadastrado'
          : error.message === 'Signup requires a valid password'
          ? 'A senha deve ter pelo menos 6 caracteres'
          : 'Ocorreu um erro. Tente novamente.'
      );
      setLoading(false);
    } else if (isSignUp) {
      setStep('confirm-email');
      setLoading(false);
    } else {
      // Deixa o useEffect reagir ao user/activeWorkspace após o onAuthStateChange
      // completar o fetchProfile. Não navegamos manualmente para evitar redirect
      // prematuro antes do profile (e workspaceMemberships) estar disponível.
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    
    const { error } = await signInWithGoogle();
    
    if (error) {
      setError('Erro ao fazer login com Google. Tente novamente.');
    }
    
    setLoading(false);
  };

  const handleBack = () => {
    setStep('initial');
    setPassword('');
    setConfirmPassword('');
    setPhone('');
    setError(null);
  };

  // Shared video panel
  const VideoPanel = () => (
    <div className="w-full lg:w-2/5 relative flex items-center justify-center p-4 lg:p-8">
      <div className="relative w-40 h-28 sm:w-56 sm:h-36 md:w-64 md:h-44 lg:w-full lg:h-96 lg:max-w-md">
        <video
          src="/sp3.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="w-full h-full object-cover rounded-lg shadow-2xl"
          style={{
            transform: 'perspective(1000px) rotateY(-15deg) rotateX(5deg)',
            boxShadow: '20px 20px 60px rgba(0,0,0,0.8)',
          }}
        />
      </div>
    </div>
  );

  // Email confirmation success screen
  if (step === 'confirm-email') {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row bg-black">
        <VideoPanel />
        <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
          <div className="w-full max-w-lg">
            <Card className="bg-white border-0 shadow-2xl">
              <CardContent className="p-6 sm:p-10">
                <div className="text-center space-y-6 sm:space-y-8">
                  <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-7 w-7 sm:h-8 sm:w-8 text-green-600" />
                  </div>

                  <div className="space-y-3">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                      Conta criada com sucesso!
                    </h1>
                    <p className="text-gray-600 text-base sm:text-lg">
                      Enviamos um email de confirmação para <strong>{email}</strong>
                    </p>
                    <p className="text-gray-500 text-sm sm:text-base">
                      Verifique sua caixa de entrada e clique no link para ativar sua conta.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={() => { setStep('login'); setIsSignUp(false); }}
                      className="w-full h-12 sm:h-14 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-medium"
                    >
                      Fazer login agora
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleBack}
                      className="w-full h-12 sm:h-14 text-base font-medium"
                    >
                      Voltar ao início
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'login' || step === 'signup') {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row bg-black">
        <VideoPanel />
        <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
          <div className="w-full max-w-lg">
            <Card className="bg-white border-0 shadow-2xl">
              <CardContent className="p-6 sm:p-10">
                <div className="space-y-6 sm:space-y-8">
                  <button
                    onClick={handleBack}
                    className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </button>

                  <div className="text-center space-y-2">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                      {isSignUp ? 'Criar conta' : 'Fazer login'}
                    </h1>
                    <p className="text-gray-600 text-base sm:text-lg">
                      {isSignUp
                        ? 'Crie sua senha para finalizar o cadastro'
                        : 'Digite sua senha para continuar'}
                    </p>
                  </div>

                  <form onSubmit={handleAuth} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-gray-700 text-sm sm:text-base">
                        Email
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          disabled
                          className="pl-12 h-12 sm:h-14 bg-gray-50 border-gray-200 text-base"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-gray-700 text-sm sm:text-base">
                        Senha
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={loading}
                          placeholder={isSignUp ? 'Crie uma senha (mín. 6 caracteres)' : 'Sua senha'}
                          minLength={6}
                          className="pl-12 h-12 sm:h-14 border-gray-200 text-base"
                        />
                      </div>
                    </div>

                    {isSignUp && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="confirmPassword" className="text-gray-700 text-sm sm:text-base">
                            Confirmar Senha
                          </Label>
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <Input
                              id="confirmPassword"
                              type="password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              required
                              disabled={loading}
                              placeholder="Repita sua senha"
                              minLength={6}
                              className="pl-12 h-12 sm:h-14 border-gray-200 text-base"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="phone" className="text-gray-700 text-sm sm:text-base">
                            Telefone
                          </Label>
                          <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                            <PhoneInput
                              value={phone}
                              onChange={setPhone}
                              disabled={loading}
                              className="pl-12 h-12 sm:h-14 border-gray-200 text-base"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-12 sm:h-14 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-medium"
                      disabled={loading}
                    >
                      {loading ? (
                        <div className="flex items-center">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3" />
                          {isSignUp ? 'Criando conta...' : 'Entrando...'}
                        </div>
                      ) : (
                        isSignUp ? 'Criar conta' : 'Entrar'
                      )}
                    </Button>
                  </form>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-black">
      <VideoPanel />

      {/* Auth Form */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
        <div className="w-full max-w-lg">
          <Card className="bg-white border-0 shadow-2xl">
            <CardContent className="p-6 sm:p-10">
              <div className="space-y-6 sm:space-y-8">
                <div className="space-y-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                    Acesse o Super Elements
                  </h1>
                  <p className="text-gray-600 text-sm">
                    Faça login na sua conta ou crie uma
                  </p>
                </div>

                <div className="space-y-5">
                  {/* Continue with Google */}
                  <Button
                    type="button"
                    onClick={handleGoogleAuth}
                    disabled={loading}
                    variant="outline"
                    className="w-full h-12 sm:h-14 font-medium border-gray-200 hover:bg-gray-50 text-base"
                  >
                    <svg className="w-5 h-5 mr-3 flex-shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue com Google
                  </Button>

                  {/* OR separator */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-4 bg-white text-gray-500 text-sm font-medium">Ou</span>
                    </div>
                  </div>

                  {/* Email Input */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-700 text-sm sm:text-base">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                        placeholder="Preencha seu email"
                        className="pl-12 h-12 sm:h-14 border-gray-200 text-base"
                      />
                    </div>
                  </div>

                  {/* Login and Signup Buttons */}
                  <div className="space-y-3">
                    <Button
                      type="button"
                      onClick={handleLoginClick}
                      disabled={loading || !email}
                      className="w-full h-12 sm:h-14 font-medium bg-primary hover:bg-primary/90 text-primary-foreground text-base"
                    >
                      Já tenho uma conta - Fazer login
                    </Button>

                    <Button
                      type="button"
                      onClick={handleSignupClick}
                      disabled={loading || !email}
                      variant="outline"
                      className="w-full h-12 sm:h-14 font-medium border-gray-200 hover:bg-gray-50 text-base"
                    >
                      Criar nova conta
                    </Button>
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
