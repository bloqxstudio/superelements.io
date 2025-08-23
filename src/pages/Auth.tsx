import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Logo } from '@/components/Logo';
import { Mail, Lock, ArrowRight, Chrome } from 'lucide-react';
import authHeroImage from '@/assets/auth-hero-image.png';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('login');
  
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

    const { error } = activeTab === 'login' 
      ? await signIn(email, password)
      : await signUp(email, password);

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Email ou senha incorretos'
          : error.message === 'User already registered'
          ? 'Este email já está cadastrado'
          : 'Ocorreu um erro. Tente novamente.'
      );
    } else if (activeTab === 'signup') {
      setError(null);
      alert('Conta criada com sucesso! Você já pode fazer login.');
      setActiveTab('login');
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

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Layout */}
      <div className="hidden lg:grid lg:grid-cols-5 min-h-screen">
        {/* Left side - Hero Image */}
        <div className="lg:col-span-3 relative overflow-hidden bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5">
          <div className="absolute inset-0 flex items-center justify-center p-12">
            <div className="relative max-w-2xl">
              <img 
                src={authHeroImage} 
                alt="Welcome illustration" 
                className="w-full h-auto object-contain drop-shadow-2xl"
              />
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-primary/10 rounded-full blur-3xl"></div>
              <div className="absolute -top-6 -left-6 w-24 h-24 bg-primary/20 rounded-full blur-2xl"></div>
            </div>
          </div>
        </div>

        {/* Right side - Auth Form */}
        <div className="lg:col-span-2 flex items-center justify-center p-8">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <Logo />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  Bem-vindo de volta
                </h1>
                <p className="text-muted-foreground">
                  Acesse sua conta ou crie uma nova para começar
                </p>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-8">
                <TabsTrigger value="login" className="text-sm font-medium">
                  Entrar
                </TabsTrigger>
                <TabsTrigger value="signup" className="text-sm font-medium">
                  Cadastre-se
                </TabsTrigger>
              </TabsList>

              <div className="space-y-6">
                {/* Google Auth Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full h-11 font-medium border-2 hover:bg-accent hover:border-primary/20 transition-all"
                >
                  <Chrome className="h-4 w-4 mr-3" />
                  Entrar com Google
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-4 text-muted-foreground font-medium">
                      ou continue com email
                    </span>
                  </div>
                </div>

                <TabsContent value="login" className="mt-6">
                  <Card className="border-2 shadow-lg">
                    <CardContent className="p-6">
                      <form onSubmit={handleEmailAuth} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-sm font-medium text-foreground">
                            Email
                          </Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="email"
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                              disabled={loading}
                              placeholder="seu@email.com"
                              className="pl-10 h-11 bg-background border-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="password" className="text-sm font-medium text-foreground">
                            Senha
                          </Label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="password"
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                              disabled={loading}
                              placeholder="Sua senha"
                              minLength={6}
                              className="pl-10 h-11 bg-background border-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                            />
                          </div>
                        </div>

                        <Button 
                          type="submit" 
                          className="w-full h-11 font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all"
                          disabled={loading}
                        >
                          {loading ? (
                            <div className="flex items-center">
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                              Entrando...
                            </div>
                          ) : (
                            <>
                              Entrar
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </>
                          )}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="signup" className="mt-6">
                  <Card className="border-2 shadow-lg">
                    <CardContent className="p-6">
                      <form onSubmit={handleEmailAuth} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="email-signup" className="text-sm font-medium text-foreground">
                            Email
                          </Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="email-signup"
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                              disabled={loading}
                              placeholder="seu@email.com"
                              className="pl-10 h-11 bg-background border-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="password-signup" className="text-sm font-medium text-foreground">
                            Senha
                          </Label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="password-signup"
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                              disabled={loading}
                              placeholder="Mínimo 6 caracteres"
                              minLength={6}
                              className="pl-10 h-11 bg-background border-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                            />
                          </div>
                        </div>

                        <Button 
                          type="submit" 
                          className="w-full h-11 font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all"
                          disabled={loading}
                        >
                          {loading ? (
                            <div className="flex items-center">
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                              Criando conta...
                            </div>
                          ) : (
                            <>
                              Criar conta
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </>
                          )}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </TabsContent>

                {error && (
                  <Alert variant="destructive" className="border-2">
                    <AlertDescription className="font-medium">{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden min-h-screen relative">
        {/* Background Image with Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${authHeroImage})`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-background/60" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col min-h-screen">
          {/* Header */}
          <div className="flex-shrink-0 pt-12 pb-8 text-center">
            <div className="flex justify-center mb-6">
              <Logo />
            </div>
            <div className="px-6 space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Bem-vindo
              </h1>
              <p className="text-muted-foreground text-sm">
                Acesse sua conta ou crie uma nova
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="flex-1 flex items-start justify-center px-6 pb-12">
            <div className="w-full max-w-sm">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login" className="text-sm">
                    Entrar
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="text-sm">
                    Cadastrar
                  </TabsTrigger>
                </TabsList>

                <div className="space-y-4">
                  {/* Google Auth Button */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoogleAuth}
                    disabled={loading}
                    className="w-full h-11 font-medium bg-background/95 backdrop-blur-sm border-2 hover:bg-accent/95"
                  >
                    <Chrome className="h-4 w-4 mr-2" />
                    Google
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/60" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background/95 backdrop-blur-sm px-3 text-muted-foreground font-medium">
                        ou
                      </span>
                    </div>
                  </div>

                  <TabsContent value="login" className="mt-4">
                    <Card className="border-2 bg-background/95 backdrop-blur-sm shadow-xl">
                      <CardContent className="p-4">
                        <form onSubmit={handleEmailAuth} className="space-y-4">
                          <div className="space-y-2">
                            <Input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                              disabled={loading}
                              placeholder="Email"
                              className="h-11 bg-background/50 border-2"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Input
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                              disabled={loading}
                              placeholder="Senha"
                              minLength={6}
                              className="h-11 bg-background/50 border-2"
                            />
                          </div>

                          <Button 
                            type="submit" 
                            className="w-full h-11 font-medium"
                            disabled={loading}
                          >
                            {loading ? 'Entrando...' : 'Entrar'}
                          </Button>
                        </form>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="signup" className="mt-4">
                    <Card className="border-2 bg-background/95 backdrop-blur-sm shadow-xl">
                      <CardContent className="p-4">
                        <form onSubmit={handleEmailAuth} className="space-y-4">
                          <div className="space-y-2">
                            <Input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                              disabled={loading}
                              placeholder="Email"
                              className="h-11 bg-background/50 border-2"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Input
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                              disabled={loading}
                              placeholder="Senha (min. 6 chars)"
                              minLength={6}
                              className="h-11 bg-background/50 border-2"
                            />
                          </div>

                          <Button 
                            type="submit" 
                            className="w-full h-11 font-medium"
                            disabled={loading}
                          >
                            {loading ? 'Criando...' : 'Criar conta'}
                          </Button>
                        </form>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {error && (
                    <Alert variant="destructive" className="border-2 bg-background/95 backdrop-blur-sm">
                      <AlertDescription className="text-sm">{error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}