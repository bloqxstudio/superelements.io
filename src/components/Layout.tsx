import React, { useEffect } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useConnectionsStore } from '@/store/connectionsStore';
import { Users, Download, Link, Building2 } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { connections, isLoading, fetchConnections } = useConnectionsStore();

  useEffect(() => {
    if (user && !isLoading) {
      fetchConnections();
    }
  }, [user, activeWorkspace?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-background w-full flex">
      {/* Sidebar lateral */}
      {user && <AppSidebar />}

      {/* Área principal */}
      <div className={`flex-1 flex flex-col min-w-0 ${user ? 'md:ml-64' : ''}`}>
        {/* Header topo — apenas para admin ou usuário não logado */}
        <header className="border-b bg-white sticky top-0 z-50 w-full">
          <div className="w-full px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Lado esquerdo: vazio quando logado (logo fica no sidebar) */}
              <div />

              {/* Lado direito: admin options + avatar */}
              <div className="flex items-center gap-3">
                {loading ? null : user ? (
                  <>
                    {activeWorkspace && (
                      <button
                        type="button"
                        onClick={() => navigate('/workspace')}
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                        title="Trocar workspace"
                      >
                        <span className="max-w-[160px] truncate">{activeWorkspace.name}</span>
                        <span className="rounded-full bg-emerald-200 px-1.5 py-0.5 text-[10px] uppercase">Ativo</span>
                      </button>
                    )}
                    {/* Opções exclusivas de admin no header */}
                    {profile?.role === 'admin' && (
                      <>
                        <Button
                          variant={location.pathname === '/connections' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => navigate('/connections')}
                        >
                          <Link className="h-4 w-4 mr-2" />
                          Connections
                        </Button>
                        <Button
                          variant={location.pathname === '/admin/users' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => navigate('/admin/users')}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Usuários
                        </Button>
                        <Button
                          variant={location.pathname === '/admin/resources' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => navigate('/admin/resources')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Gerenciar Recursos
                        </Button>
                        <Button
                          variant={location.pathname === '/admin/workspaces' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => navigate('/admin/workspaces')}
                        >
                          <Building2 className="h-4 w-4 mr-2" />
                          Workspaces
                        </Button>
                      </>
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
