import React, { useEffect } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { useConnectionsStore } from '@/store/connectionsStore';
import { Users, Briefcase, Download } from 'lucide-react';

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { connections, isLoading, fetchConnections } = useConnectionsStore();

  // Bootstrap: carregar conexões globalmente ao montar o Layout (apenas com usuário logado)
  useEffect(() => {
    if (user && connections.length === 0 && !isLoading) {
      fetchConnections();
    }
  }, [user, connections.length, isLoading, fetchConnections]);
  const handleLogoClick = () => {
    navigate('/');
  };

  const handleHireExpert = () => {
    const phone = "+5551989249280";
    const message = encodeURIComponent("Quero contratar um especialista para meu projeto");
    const whatsappUrl = `https://api.whatsapp.com/send/?phone=${encodeURIComponent(phone)}&text=${message}&type=phone_number&app_absent=0`;
    window.open(whatsappUrl, '_blank');
  };
  return <div className="min-h-screen bg-background w-full flex flex-col">
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
              {user ? <>
                  {/* Show "Recursos" button for PRO and admin users */}
                  {profile?.role && ['pro', 'admin'].includes(profile.role) && (
                    <Button 
                      variant={location.pathname === '/resources' ? 'default' : 'ghost'}
                      onClick={() => navigate('/resources')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Recursos
                    </Button>
                  )}
                  
                  {/* Show "Contratar Especialista" button for FREE and PRO users */}
                  {profile?.role && ['free', 'pro'].includes(profile.role) && (
                    <Button 
                      className="bg-[#CDFD06] text-black hover:bg-[#b8e305] shadow-md transition-all"
                      onClick={handleHireExpert}
                    >
                      <Briefcase className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Contratar Especialista</span>
                    </Button>
                  )}
                  
                  {/* Only show admin options for admin users */}
                  {profile?.role === 'admin' && <>
                    <Button variant={location.pathname === '/connections' ? 'default' : 'ghost'} onClick={() => navigate('/connections')}>
                      Connections
                    </Button>
                    <Button variant={location.pathname === '/client-accounts' ? 'default' : 'ghost'} onClick={() => navigate('/client-accounts')}>
                      Client Accounts
                    </Button>
                    <Button variant={location.pathname === '/admin/users' ? 'default' : 'ghost'} onClick={() => navigate('/admin/users')}>
                      <Users className="h-4 w-4 mr-2" />
                      Usuários
                    </Button>
                    <Button variant={location.pathname === '/admin/resources' ? 'default' : 'ghost'} onClick={() => navigate('/admin/resources')}>
                      <Download className="h-4 w-4 mr-2" />
                      Gerenciar Recursos
                    </Button>
                  </>}
                  <UserAvatar />
                </> : <Button onClick={() => navigate('/auth')}>
                  Entrar
                </Button>}
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
    </div>;
};
export default Layout;