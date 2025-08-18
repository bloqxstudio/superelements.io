
import React from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Logo } from '@/components/Logo';
import { SimpleUserMenu } from '@/components/auth/SimpleUserMenu';

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const isLibraryPage = location.pathname === '/';

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
            
            {/* Admin Navigation */}
            {profile?.role === 'admin' && (
              <div className="flex items-center gap-2 mr-4">
                <button
                  onClick={() => navigate('/admin')}
                  className={`px-3 py-2 text-sm font-medium transition-colors rounded-md ${
                    location.pathname === '/admin' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => navigate('/admin/pricing')}
                  className={`px-3 py-2 text-sm font-medium transition-colors rounded-md ${
                    location.pathname === '/admin/pricing' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  Pricing
                </button>
                <button
                  onClick={() => navigate('/connections')}
                  className={`px-3 py-2 text-sm font-medium transition-colors rounded-md ${
                    location.pathname === '/connections' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  Connections
                </button>
              </div>
            )}
            
            {/* User Menu */}
            <SimpleUserMenu />
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
