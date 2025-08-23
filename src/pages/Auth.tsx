import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Lock, ArrowLeft } from 'lucide-react';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  
  const { signIn, signUp, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const from = location.state?.from?.pathname || '/';

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = isSignUp 
      ? await signUp(email, password)
      : await signIn(email, password);

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Email ou senha incorretos'
          : error.message === 'User already registered'
          ? 'Este email já está cadastrado'
          : 'Ocorreu um erro. Tente novamente.'
      );
    } else if (isSignUp) {
      setError(null);
      alert('Conta criada com sucesso! Você já pode fazer login.');
      setIsSignUp(false);
    }
    
    setLoading(false);
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

  const handleBackToMain = () => {
    setShowEmailForm(false);
    setError(null);
    setEmail('');
    setPassword('');
  };

  if (showEmailForm) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-4">
            <button
              onClick={handleBackToMain}
              className="inline-flex items-center text-gray-400 hover:text-white transition-colors mb-8"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </button>
            
            <h1 className="text-3xl font-bold text-white">
              {isSignUp ? 'Criar conta' : 'Entrar'}
            </h1>
            <p className="text-gray-400">
              {isSignUp 
                ? 'Crie sua conta para começar' 
                : 'Entre com seu email e senha'
              }
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <form onSubmit={handleEmailAuth} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      placeholder="seu@email.com"
                      className="pl-10 h-12 bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-primary focus:ring-primary"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white">
                    Senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      placeholder="Sua senha"
                      minLength={6}
                      className="pl-10 h-12 bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-primary focus:ring-primary"
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      {isSignUp ? 'Criando conta...' : 'Entrando...'}
                    </div>
                  ) : (
                    isSignUp ? 'Criar conta' : 'Entrar'
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-gray-400 hover:text-white transition-colors"
                  disabled={loading}
                >
                  {isSignUp 
                    ? 'Já tem uma conta? Entrar'
                    : 'Não tem uma conta? Criar conta'}
                </button>
              </div>
            </CardContent>
          </Card>

          {error && (
            <Alert variant="destructive" className="bg-red-900 border-red-700">
              <AlertDescription className="text-red-100">{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-white">
            Access Clonify
          </h1>
          <p className="text-gray-400 text-lg">
            Sign in to your account or create a new one
          </p>
        </div>

        <div className="space-y-4">
          {/* Continue with Google */}
          <Button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full h-14 bg-transparent border-2 border-gray-600 text-white hover:bg-gray-800 font-medium rounded-xl transition-all"
          >
            <div className="flex items-center justify-center">
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </div>
          </Button>

          {/* OR separator */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-gray-900 text-gray-400 text-sm font-medium">OR</span>
            </div>
          </div>

          {/* Continue with Email */}
          <Button
            type="button"
            onClick={() => setShowEmailForm(true)}
            disabled={loading}
            className="w-full h-14 bg-gray-100 hover:bg-white text-gray-900 font-medium rounded-xl transition-all"
          >
            Continue with Email
          </Button>

          {/* Continue Button (placeholder for now) */}
          <Button
            type="button"
            disabled={true}
            className="w-full h-14 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-xl opacity-50 cursor-not-allowed"
          >
            Continue
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="bg-red-900 border-red-700 mt-6">
            <AlertDescription className="text-red-100">{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}