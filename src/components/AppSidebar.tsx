import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Logo } from '@/components/Logo';
import { Home, Building2, Download, LayoutGrid, LogOut, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  path: string;
  active: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors text-left',
      active
        ? 'bg-primary text-primary-foreground'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    )}
  >
    <span className="flex-shrink-0">{icon}</span>
    <span>{label}</span>
  </button>
);

export const AppSidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { activeWorkspace, workspaces, exitWorkspace, isAdmin } = useWorkspace();

  // Detect if admin entered a workspace (vs. own membership)
  const isAdminInWorkspace = isAdmin && !!activeWorkspace && !workspaces.some((w) => w.id === activeWorkspace.id);

  // Manager role: can only access /inicio and /client-accounts
  const isManager = activeWorkspace?.role === 'manager';

  const isActive = (path: string) => {
    if (path === '/inicio') return location.pathname === '/inicio';
    if (path === '/') {
      return (
        location.pathname === '/' ||
        (location.pathname !== '/inicio' &&
          location.pathname !== '/client-accounts' &&
          !location.pathname.startsWith('/client-accounts/') &&
          location.pathname !== '/resources' &&
          location.pathname !== '/connections' &&
          location.pathname !== '/admin/users' &&
          location.pathname !== '/admin/resources' &&
          location.pathname !== '/admin/workspaces' &&
          location.pathname !== '/partners' &&
          location.pathname !== '/proposals'
          )
      );
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Show workspace content nav if: admin entered a workspace, OR member with a workspace
  const showWorkspaceNav = !!activeWorkspace;

  return (
    <div className="w-64 fixed inset-y-0 left-0 z-40 bg-white border-r border-gray-200 shadow-sm hidden md:flex flex-col">
      {/* Logo */}
      <div
        className="px-4 py-5 border-b border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => navigate('/inicio')}
      >
        <Logo />
      </div>

      {/* Admin "entered workspace" banner */}
      {isAdminInWorkspace && (
        <div className="px-3 py-2.5 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-amber-800 truncate">{activeWorkspace.name}</p>
              <p className="text-xs text-amber-600">Visualizando como admin</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-amber-700 hover:text-amber-900 hover:bg-amber-100 flex-shrink-0"
              onClick={() => {
                exitWorkspace();
                navigate('/workspace');
              }}
            >
              <LogOut className="h-3.5 w-3.5 mr-1" />
              Trocar
            </Button>
          </div>
        </div>
      )}

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <NavItem
          icon={<Home className="h-4 w-4" />}
          label="Início"
          path="/inicio"
          active={isActive('/inicio')}
          onClick={() => navigate('/inicio')}
        />

        {/* Workspace content nav — visible to members and to admin when inside a workspace */}
        {showWorkspaceNav && (
          <>
            <NavItem
              icon={<Building2 className="h-4 w-4" />}
              label="Clientes"
              path="/client-accounts"
              active={isActive('/client-accounts')}
              onClick={() => navigate('/client-accounts')}
            />

            {!isManager && (
              <NavItem
                icon={<FileText className="h-4 w-4" />}
                label="Propostas"
                path="/proposals"
                active={isActive('/proposals')}
                onClick={() => navigate('/proposals')}
              />
            )}

          </>
        )}

        {!isManager && profile?.role && ['pro', 'admin'].includes(profile.role) && (
          <NavItem
            icon={<Download className="h-4 w-4" />}
            label="Recursos"
            path="/resources"
            active={isActive('/resources')}
            onClick={() => navigate('/resources')}
          />
        )}

        {!isManager && (
          <NavItem
            icon={<LayoutGrid className="h-4 w-4" />}
            label="Componentes"
            path="/"
            active={isActive('/')}
            onClick={() => navigate('/')}
          />
        )}
      </nav>

      {/* Workspace indicator no rodapé */}
      {activeWorkspace && (
        <div className="px-3 py-3 border-t border-gray-100">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5 px-1">
            Workspace Ativo
          </p>
          <div className="rounded-lg bg-gray-50 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900 truncate">{activeWorkspace.name}</p>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Ativo
              </span>
            </div>
            <button
              className="mt-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              onClick={() => navigate('/workspace')}
            >
              Trocar workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
