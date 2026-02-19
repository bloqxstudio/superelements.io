import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface WorkspaceGateProps {
  children: React.ReactNode;
}

export const WorkspaceGate: React.FC<WorkspaceGateProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { activeWorkspace, isLoading: wsLoading } = useWorkspace();
  const location = useLocation();

  if (authLoading || wsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Todos os usuários autenticados precisam de workspace ativo.
  if (!activeWorkspace) {
    return <Navigate to="/workspace" replace />;
  }

  // Managers can only access /inicio and /client-accounts
  if (activeWorkspace.role === 'manager') {
    const allowed =
      location.pathname === '/inicio' ||
      location.pathname === '/client-accounts' ||
      location.pathname.startsWith('/client-accounts/');
    if (!allowed) {
      return <Navigate to="/inicio" replace />;
    }
  }

  return <>{children}</>;
};
