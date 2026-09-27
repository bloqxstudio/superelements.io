import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { PhoneCollectionModal } from '@/components/PhoneCollectionModal';

export type AppRole = 'free' | 'pro' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  role: AppRole;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, phone?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  let profileData: { id: string; email: string; phone?: string } | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, phone')
      .eq('id', userId)
      .single();
    if (!error) { profileData = data; break; }
    if (attempt === 0 && error.code === 'PGRST116') {
      await new Promise((r) => setTimeout(r, 600));
      continue;
    }
    console.error('Error fetching profile:', error);
    return null;
  }
  if (!profileData) return null;

  const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', userId).single();

  return { ...profileData, role: (roleData?.role as AppRole) || 'free' };
}

/**
 * Só no servidor de dev: entra sozinho com a conta de `.env.development.local`
 * (DEV_AUTH_EMAIL / DEV_AUTH_PASSWORD) para pular a tela de login. O Supabase
 * recebe uma sessão real, então RLS funciona normalmente.
 * `__DEV_AUTH__` vem do vite.config e é sempre `null` em qualquer build.
 */
async function devAutoSignIn(): Promise<Session | null> {
  if (!__DEV_AUTH__) return null;
  const { data, error } = await supabase.auth.signInWithPassword(__DEV_AUTH__);
  if (error) {
    console.warn('[dev] Login automático falhou:', error.message);
    return null;
  }
  return data.session;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  // True once the initial getSession+fetchProfile completes
  const bootstrapDone = useRef(false);

  useEffect(() => {
    let cancelled = false;

    // Bootstrap: getSession → fetchProfile → done
    supabase.auth.getSession().then(async ({ data: { session: existing } }) => {
      if (cancelled) return;
      const s = existing ?? (await devAutoSignIn());
      if (cancelled) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const p = await fetchProfile(s.user.id);
        if (cancelled) return;
        setProfile(p);
      }
      bootstrapDone.current = true;
      setLoading(false);
    }).catch((err) => {
      console.error('Auth init error:', err);
      if (!cancelled) {
        bootstrapDone.current = true;
        setLoading(false);
      }
    });

    // Listener: only act on events that happen AFTER bootstrap
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (cancelled || !bootstrapDone.current) return;

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        return;
      }

      if (event === 'SIGNED_IN') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          fetchProfile(newSession.user.id).then((p) => {
            if (cancelled) return;
            setProfile(p);
            if (p && !p.phone && newSession.user.app_metadata?.provider === 'google') {
              setShowPhoneModal(true);
            }
          });
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, phone?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/`, data: phone ? { phone } : undefined },
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
      setUser(null);
      setSession(null);
      setProfile(null);
    }
  };

  const handlePhoneModalComplete = async () => {
    setShowPhoneModal(false);
    if (user) {
      const p = await fetchProfile(user.id);
      if (p) setProfile(p);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signInWithGoogle, signOut }}>
      {children}
      <PhoneCollectionModal open={showPhoneModal} onComplete={handlePhoneModalComplete} userEmail={user?.email || ''} />
    </AuthContext.Provider>
  );
};
