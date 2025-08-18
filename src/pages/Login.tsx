import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Mail } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// Custom SVG Logo Component
const SuperElementsLogo = () => <svg width="32" height="32" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="27.7511" height="28" rx="3.58938" fill="#D2F525" />
    <path d="M14.771 14.5566C14.3617 14.9578 13.5534 15.2858 12.9746 15.2858H7.12158C6.54279 15.2858 6.40405 14.9578 6.81333 14.5566L13.2191 8.27801C13.6284 7.87686 14.4367 7.54858 15.0155 7.54858H20.8685C21.4473 7.54858 21.586 7.87686 21.1768 8.27801L14.771 14.5566Z" fill="#282828" />
    <path d="M14.7612 20.0894C14.352 20.4905 13.5436 20.8188 12.9648 20.8188H7.11182C6.53302 20.8188 6.39429 20.4905 6.80356 20.0894L13.2091 13.8108C13.6184 13.4096 14.4268 13.0815 15.0055 13.0815H20.8585C21.4373 13.0815 21.5761 13.4096 21.1668 13.8108L14.7612 20.0894Z" fill="#282828" />
  </svg>;

// Google Icon Component
const GoogleIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>;
const Login: React.FC = () => {
  const {
    user,
    signIn,
    signUp,
    signInWithGoogle,
    resendConfirmation
  } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('login');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [lastResendTime, setLastResendTime] = useState<number | null>(null);
  const isEmailNotConfirmed = error.toLowerCase().includes('email not confirmed') || error.toLowerCase().includes('email_not_confirmed');
  const canResend = !lastResendTime || Date.now() - lastResendTime > 60000; // 60 seconds cooldown

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const {
      error
    } = await signIn(email, password);
    if (error) {
      setError(error.message || 'Login failed');
    } else {
      toast({
        title: "Welcome back!",
        description: "You've been successfully logged in."
      });
    }
  };
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    const {
      error
    } = await signUp(email, password);
    if (error) {
      setError(error.message || 'Sign up failed');
    } else {
      toast({
        title: "Account created!",
        description: "Please check your email to verify your account."
      });
      setActiveTab('login');
    }
  };
  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError('');
    const {
      error
    } = await signInWithGoogle();
    if (error) {
      setError(error.message || 'Google login failed');
      setIsGoogleLoading(false);
    }
    // Note: If successful, the user will be redirected, so we don't need to set loading to false
  };
  const handleResendConfirmation = async () => {
    if (!canResend || !email) return;
    setError('');
    const {
      error
    } = await resendConfirmation(email);
    if (error) {
      setError(error.message || 'Failed to resend confirmation email');
    } else {
      toast({
        title: "Confirmation email sent!",
        description: "Please check your email for the confirmation link."
      });
      setLastResendTime(Date.now());
    }
  };
  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setLastResendTime(null);
  };
  useEffect(() => {
    resetForm();
  }, [activeTab]);

  // Redirect if already authenticated
  if (user) {
    return <Navigate to="/" replace />;
  }
  return <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <SuperElementsLogo />
          </div>
          <h1 className="text-2xl font-bold">SuperElements</h1>
          <p className="text-muted-foreground">Elementor Component Library</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              Sign in to access the component library
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Google Login Button */}
            <div className="space-y-4 mb-6">
              <Button onClick={handleGoogleLogin} disabled={isGoogleLoading} variant="outline" className="w-full flex items-center gap-3 py-6">
                {isGoogleLoading ? <div className="animate-spin h-4 w-4 border border-current border-t-transparent rounded-full"></div> : <GoogleIcon />}
                Continue with Google
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with email
                  </span>
                </div>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" required />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required />
                  </div>

                  {error && <div className="space-y-2">
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                      
                      {isEmailNotConfirmed && email && <div className="flex items-center gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={handleResendConfirmation} disabled={!canResend} className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Resend Confirmation
                          </Button>
                          {!canResend && <span className="text-xs text-muted-foreground">
                              Wait {Math.ceil((60000 - (Date.now() - (lastResendTime || 0))) / 1000)}s
                            </span>}
                        </div>}
                    </div>}

                  <Button type="submit" className="w-full">
                    Sign In
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" required />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a password" required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm your password" required />
                  </div>

                  {error && <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>}

                  <Button type="submit" className="w-full">
                    Create Account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center mt-6 text-sm text-muted-foreground">
          
        </div>
      </div>
    </div>;
};
export default Login;