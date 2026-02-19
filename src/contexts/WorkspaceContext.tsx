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
  const { user, profile, loading: authLoading, profileLoading } = useAuth();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_WORKSPACE_KEY)
  );
  // Admin can "enter" any workspace — stored separately so it survives reload
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

  // Keep only valid persisted workspace; do not auto-select any workspace.
  // Important: do not clear persisted workspace while profile is transiently unavailable.
  useEffect(() => {
    if (authLoading) return;

    // Public/anonymous routes (e.g. /p/:token) must not wipe workspace selection.
    if (!user) return;

    // If session exists but profile is still loading/failed temporarily, keep current selection.
    // profileLoading=false AND profile=null means the fetch failed transiently; don't wipe workspace.
    if (profileLoading) return;
    if (!profile) return;

    if (workspaces.length === 0) {
      setActiveWorkspaceId(null);
      localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
      return;
    }

    if (activeWorkspaceId && !workspaces.some((w) => w.id === activeWorkspaceId)) {
      setActiveWorkspaceId(null);
      localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    }
  }, [authLoading, profileLoading, user, profile, workspaces, activeWorkspaceId]);

  const switchWorkspace = (workspaceId: string) => {
    const target = workspaces.find((w) => w.id === workspaceId);
    if (!target) return;
    setActiveWorkspaceId(workspaceId);
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
    // Clear any admin override when switching own workspaces
    setAdminEnteredWorkspace(null);
    sessionStorage.removeItem(ADMIN_ENTERED_WORKSPACE_KEY);
  };

  /** Admin enters any workspace to view its content */
  const enterWorkspace = (workspace: Workspace) => {
    setAdminEnteredWorkspace(workspace);
    sessionStorage.setItem(ADMIN_ENTERED_WORKSPACE_KEY, JSON.stringify(workspace));
  };

  /** Admin exits the entered workspace, returning to their own view */
  const exitWorkspace = () => {
    setAdminEnteredWorkspace(null);
    sessionStorage.removeItem(ADMIN_ENTERED_WORKSPACE_KEY);
  };

  // Active workspace: if admin entered one, use that; otherwise use own membership
  const ownActiveWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const activeWorkspace = isAdmin && adminEnteredWorkspace
    ? adminEnteredWorkspace
    : ownActiveWorkspace;

  const value: WorkspaceContextType = {
    activeWorkspace,
    workspaces,
    isLoading: authLoading || profileLoading,
    switchWorkspace,
    enterWorkspace,
    exitWorkspace,
    isAdmin,
    hasWorkspace: workspaces.length > 0 || (isAdmin && !!adminEnteredWorkspace),
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};
