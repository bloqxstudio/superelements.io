import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { PhoneCollectionModal } from '@/components/PhoneCollectionModal';

export type AppRole = 'free' | 'pro' | 'admin';
export type WorkspaceRole = 'owner' | 'member' | 'manager';

export interface WorkspaceMembership {
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  role: WorkspaceRole;
}

export interface UserProfile {
  id: string;
  email: string;
  role: AppRole;
  phone?: string;
  workspaceMemberships: WorkspaceMembership[];
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  signUp: (email: string, password: string, phone?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

async function loadProfile(userId: string): Promise<UserProfile | null> {
  // Retry once on PGRST116 (no rows) — happens when auth token isn't propagated yet in new tabs
  let profileData: { id: string; email: string; phone?: string } | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, phone')
      .eq('id', userId)
      .single();

    if (!error) {
      profileData = data;
      break;
    }
    if (attempt === 0 && error.code === 'PGRST116') {
      await new Promise((r) => setTimeout(r, 600));
      continue;
    }
    console.error('Error fetching profile:', error);
    return null;
  }
  if (!profileData) return null;

  const [roleResult, membershipResult] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', userId).single(),
    supabase.from('workspace_members').select('workspace_id, role, workspaces(name, slug)').eq('user_id', userId),
  ]);

  if (roleResult.error) console.error('Error fetching role:', roleResult.error);

  const workspaceMemberships: WorkspaceMembership[] = (membershipResult.data || []).map((m) => ({
    workspace_id: m.workspace_id,
    workspace_name: (m.workspaces as { name: string; slug: string } | null)?.name ?? '',
    workspace_slug: (m.workspaces as { name: string; slug: string } | null)?.slug ?? '',
    role: m.role as WorkspaceRole,
  }));

  return {
    ...profileData,
    role: (roleResult.data?.role as AppRole) || 'free',
    workspaceMemberships,
  } as UserProfile;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  // Tracks the user ID currently being loaded so we can ignore stale results
  const loadingForUserRef = useRef<string | null>(null);
  // Prevents double-loading from bootstrapSession + onAuthStateChange INITIAL_SESSION
  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      // Get session once synchronously-ish before subscribing
      const { data: { session: initialSession } } = await supabase.auth.getSession();

      if (!isMounted) return;

      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        const uid = initialSession.user.id;
        loadingForUserRef.current = uid;
        setProfileLoading(true);
        const p = await loadProfile(uid);
        if (!isMounted || loadingForUserRef.current !== uid) return;
        setProfile(p);
        setProfileLoading(false);
      } else {
        setProfile(null);
      }

      initialLoadDoneRef.current = true;
      if (isMounted) setLoading(false);
    }

    void initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      // Skip INITIAL_SESSION — handled by initAuth above to avoid double fetch
      if (event === 'INITIAL_SESSION') return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === 'SIGNED_OUT') {
        loadingForUserRef.current = null;
        setProfile(null);
        setLoading(false);
        setProfileLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (!newSession?.user) {
          setProfile(null);
          setProfileLoading(false);
          setLoading(false);
          return;
        }

        // Only reload profile on SIGNED_IN; for token refresh just keep existing profile
        if (event !== 'SIGNED_IN') {
          if (!initialLoadDoneRef.current) setLoading(false);
          return;
        }

        const uid = newSession.user.id;
        loadingForUserRef.current = uid;
        setProfileLoading(true);
        try {
          const p = await loadProfile(uid);
          if (!isMounted || loadingForUserRef.current !== uid) return;
          setProfile(p);

          // Show phone modal for Google sign-in without phone
          if (p && !p.phone) {
            const isOAuth = newSession.user.app_metadata?.provider === 'google';
            if (isOAuth) setShowPhoneModal(true);
          }
        } catch (err) {
          console.error('Error loading profile on SIGNED_IN:', err);
          if (isMounted && loadingForUserRef.current === uid) setProfile(null);
        } finally {
          if (isMounted && loadingForUserRef.current === uid) setProfileLoading(false);
        }
      }

      if (!initialLoadDoneRef.current) {
        initialLoadDoneRef.current = true;
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, phone?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: phone ? { phone } : undefined,
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    return { error };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      localStorage.removeItem('superelements_active_workspace_id');
      sessionStorage.removeItem('superelements_admin_entered_workspace');
      loadingForUserRef.current = null;
      setUser(null);
      setSession(null);
      setProfile(null);
      setLoading(false);
      setProfileLoading(false);
    }
  };

  const handlePhoneModalComplete = async () => {
    setShowPhoneModal(false);
    if (user) {
      const p = await loadProfile(user.id);
      setProfile(p);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, session, profile, loading, profileLoading, signUp, signIn, signInWithGoogle, signOut }}
    >
      {children}
      <PhoneCollectionModal
        open={showPhoneModal}
        onComplete={handlePhoneModalComplete}
        userEmail={user?.email || ''}
      />
    </AuthContext.Provider>
  );
};
