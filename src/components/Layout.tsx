
import React from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const handleLogoClick = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background w-full flex flex-col">
      {/* Simplified Header */}
      <header className="border-b bg-white sticky top-0 z-50 w-full">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Title - Now clickable */}
            <div className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity" onClick={handleLogoClick}>
              <Logo />
              <div>
                <p className="text-sm text-muted-foreground">Elementor Library</p>
              </div>
            </div>
            
            {/* Navigation */}
            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <Button
                    variant={location.pathname === '/' ? 'default' : 'ghost'}
                    onClick={() => navigate('/')}
                  >
                    Library
                  </Button>
                  {/* Only show Connections for admin users */}
                  {profile?.role === 'admin' && (
                    <Button
                      variant={location.pathname === '/connections' ? 'default' : 'ghost'}
                      onClick={() => navigate('/connections')}
                    >
                      Connections
                    </Button>
                  )}
                  <UserAvatar />
                </>
              ) : (
                <Button onClick={() => navigate('/auth')}>
                  Entrar
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - full width for all pages */}
      <main className="flex-1 min-w-0">
        <div className="h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
