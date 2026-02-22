import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useConnectionsStore } from '@/store/connectionsStore';
import { Users, Download, Link, Building2 } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { Logo } from '@/components/Logo';

// Hamburger icon — três linhas com traço do meio mais curto (estilo moderno)
const HamburgerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="4" width="16" height="1.75" rx="0.875" fill="currentColor" />
    <rect x="2" y="9.125" width="11" height="1.75" rx="0.875" fill="currentColor" />
    <rect x="2" y="14.25" width="16" height="1.75" rx="0.875" fill="currentColor" />
  </svg>
);

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { isLoading, fetchConnections } = useConnectionsStore();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (user && !isLoading) {
      fetchConnections();
    }
  }, [user, activeWorkspace?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-background w-full flex">
      {/* Sidebar lateral */}
      {user && (
        <AppSidebar
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Área principal */}
      <div className={`flex-1 flex flex-col min-w-0 ${user ? 'md:ml-64' : ''}`}>
        {/* Header topo */}
        <header className="border-b bg-white sticky top-0 z-30 w-full">
          <div className="w-full px-4 md:px-6 py-3 md:py-4">
            <div className="flex items-center justify-between gap-3">

              {/* Esquerda: logo + hamburguer (mobile) */}
              {user ? (
                <div className="flex items-center gap-2 md:hidden">
                  <button
                    onClick={() => navigate('/')}
                    className="flex-shrink-0 hover:opacity-80 transition-opacity"
                    aria-label="Início"
                  >
                    <Logo />
                  </button>
                  <button
                    onClick={() => setMobileSidebarOpen(true)}
                    className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                    aria-label="Abrir menu"
                  >
                    <HamburgerIcon />
                  </button>
                </div>
              ) : (
                <div />
              )}

              {/* Direita: workspace badge + admin options + avatar */}
              <div className="flex items-center gap-2 flex-wrap justify-end ml-auto">
                {loading ? null : user ? (
                  <>
                    {activeWorkspace && (
                      <button
                        type="button"
                        onClick={() => navigate('/workspace')}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                        title="Trocar workspace"
                      >
                        <span className="max-w-[120px] md:max-w-[160px] truncate">{activeWorkspace.name}</span>
                        <span className="rounded-full bg-emerald-200 px-1.5 py-0.5 text-[10px] uppercase hidden sm:inline">Ativo</span>
                      </button>
                    )}
                    {/* Opções de admin — apenas desktop */}
                    {profile?.role === 'admin' && (
                      <div className="hidden lg:flex items-center gap-1">
                        <Button
                          variant={location.pathname === '/connections' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => navigate('/connections')}
                        >
                          <Link className="h-4 w-4 mr-1.5" />
                          Connections
                        </Button>
                        <Button
                          variant={location.pathname === '/admin/users' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => navigate('/admin/users')}
                        >
                          <Users className="h-4 w-4 mr-1.5" />
                          Usuários
                        </Button>
                        <Button
                          variant={location.pathname === '/admin/resources' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => navigate('/admin/resources')}
                        >
                          <Download className="h-4 w-4 mr-1.5" />
                          Recursos
                        </Button>
                        <Button
                          variant={location.pathname === '/admin/workspaces' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => navigate('/admin/workspaces')}
                        >
                          <Building2 className="h-4 w-4 mr-1.5" />
                          Workspaces
                        </Button>
                      </div>
                    )}
                    <UserAvatar />
                  </>
                ) : (
                  <Button onClick={() => navigate('/auth')}>Entrar</Button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Conteúdo da página */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
