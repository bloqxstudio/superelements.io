import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';

interface WorkspaceGateProps {
  children: React.ReactNode;
}

export const WorkspaceGate: React.FC<WorkspaceGateProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();

  // Wait for auth + profile to finish loading
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!activeWorkspace) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm text-center">
          <h2 className="text-lg font-semibold text-gray-900">Workspace não selecionado</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Selecione um workspace para continuar.
          </p>
          <Button className="mt-4" onClick={() => navigate('/workspace', { replace: true })}>
            Ir para seleção de workspace
          </Button>
        </div>
      </div>
    );
  }

  // Managers can only access / and /client-accounts
  if (activeWorkspace.role === 'manager') {
    const allowed =
      location.pathname === '/' ||
      location.pathname === '/client-accounts' ||
      location.pathname.startsWith('/client-accounts/');
    if (!allowed) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};
