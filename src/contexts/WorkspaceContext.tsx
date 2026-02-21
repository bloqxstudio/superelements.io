import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { WorkspaceRole } from '@/contexts/AuthContext';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

interface WorkspaceContextType {
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  isLoading: boolean;
  switchWorkspace: (workspaceId: string) => void;
  /** Admin only: enter any workspace by providing full details */
  enterWorkspace: (workspace: Workspace) => void;
  exitWorkspace: () => void;
  isAdmin: boolean;
  hasWorkspace: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};

const ACTIVE_WORKSPACE_KEY = 'superelements_active_workspace_id';
const ADMIN_ENTERED_WORKSPACE_KEY = 'superelements_admin_entered_workspace';

interface WorkspaceProviderProps {
  children: ReactNode;
}

export const WorkspaceProvider: React.FC<WorkspaceProviderProps> = ({ children }) => {
  const { user, profile, loading } = useAuth();

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_WORKSPACE_KEY)
  );

  const [adminEnteredWorkspace, setAdminEnteredWorkspace] = useState<Workspace | null>(() => {
    try {
      const raw = sessionStorage.getItem(ADMIN_ENTERED_WORKSPACE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const isAdmin = profile?.role === 'admin';

  const workspaces: Workspace[] = (profile?.workspaceMemberships ?? []).map((m) => ({
    id: m.workspace_id,
    name: m.workspace_name,
    slug: m.workspace_slug,
    role: m.role,
  }));

  // Once profile is loaded, validate the persisted workspace ID is still valid
  useEffect(() => {
    if (loading || !user || !profile) return;

    if (workspaces.length === 0) {
      setActiveWorkspaceId(null);
      localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
      return;
    }

    if (activeWorkspaceId && !workspaces.some((w) => w.id === activeWorkspaceId)) {
      // Auto-select first available workspace instead of clearing
      const first = workspaces[0];
      setActiveWorkspaceId(first.id);
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, first.id);
    }
  }, [loading, user, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchWorkspace = (workspaceId: string) => {
    const target = workspaces.find((w) => w.id === workspaceId);
    if (!target) return;
    setActiveWorkspaceId(workspaceId);
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
    setAdminEnteredWorkspace(null);
    sessionStorage.removeItem(ADMIN_ENTERED_WORKSPACE_KEY);
  };

  const enterWorkspace = (workspace: Workspace) => {
    setAdminEnteredWorkspace(workspace);
    sessionStorage.setItem(ADMIN_ENTERED_WORKSPACE_KEY, JSON.stringify(workspace));
  };

  const exitWorkspace = () => {
    setAdminEnteredWorkspace(null);
    sessionStorage.removeItem(ADMIN_ENTERED_WORKSPACE_KEY);
  };

  const ownActiveWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const activeWorkspace = isAdmin && adminEnteredWorkspace ? adminEnteredWorkspace : ownActiveWorkspace;

  const value: WorkspaceContextType = {
    activeWorkspace,
    workspaces,
    isLoading: loading,
    switchWorkspace,
    enterWorkspace,
    exitWorkspace,
    isAdmin,
    hasWorkspace: workspaces.length > 0 || (isAdmin && !!adminEnteredWorkspace),
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};
