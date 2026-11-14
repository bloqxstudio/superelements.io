import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { PhoneCollectionModal } from '@/components/PhoneCollectionModal';
import { avatarUrlOf, displayName } from '@/features/profile/profile';
import { useCrm } from '@/features/crm/crmStore';
import { useProjectStore } from '@/features/projects/projectStore';
import { resetIara } from '@/features/iara/store';

export type AppRole = 'free' | 'pro' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  role: AppRole;
  phone?: string;
  /** O nome que a pessoa escreveu em /perfil (vazio: sai do e-mail em `name`). */
  fullName?: string;
  /** Nome para mostrar: `fullName` ou o tirado do e-mail. */
  name: string;
  avatarPath?: string;
  avatarUrl?: string;
  createdAt?: string;
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
  /** Lê o perfil de novo (depois de mudar nome, foto ou telefone). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  let profileData: { id: string; email: string; phone?: string | null; full_name?: string | null; avatar_path?: string | null; created_at?: string } | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, phone, full_name, avatar_path, created_at')
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

  return {
    id: profileData.id,
    email: profileData.email,
    phone: profileData.phone ?? undefined,
    fullName: profileData.full_name?.trim() || undefined,
    name: displayName(profileData.full_name, profileData.email),
    avatarPath: profileData.avatar_path ?? undefined,
    avatarUrl: avatarUrlOf(profileData.avatar_path),
    createdAt: profileData.created_at,
    role: (roleData?.role as AppRole) || 'free',
  };
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

/**
 * Voltou do Google agora? Lido ao carregar o módulo, antes de o cliente do Supabase limpar o endereço
 * (`?code=` no PKCE, `#access_token=` no implícito). Assim a pergunta do telefone aparece depois do login
 * pelo Google, e não a cada recarga de quem entrou antes (revisão de 2026-11-13).
 */
const cameFromOAuth = typeof window !== 'undefined' && /[?&#](code|access_token)=/.test(window.location.search + window.location.hash);

const asksPhone = (p: UserProfile | null, u: User | null | undefined) => !!p && !p.phone && u?.app_metadata?.provider === 'google';

/** Saiu da conta ou outra pessoa entrou: as listas da conta anterior não podem seguir na memória (revisão de 2026-11-13). */
function resetAccountStores() {
  useCrm.getState().reset();
  useProjectStore.getState().reset();
  resetIara();
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  // True once the initial getSession+fetchProfile completes
  const bootstrapDone = useRef(false);
  // De quem é o perfil carregado (ou sendo lido): só um id novo pede outra leitura
  const profileFor = useRef<string | null>(null);

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
        profileFor.current = s.user.id;
        const p = await fetchProfile(s.user.id);
        if (cancelled) return;
        setProfile(p);
        // Revisão de 2026-11-13: o SIGNED_IN da volta do Google sai durante o `_initialize` do auth-js, antes
        // daqui terminar, e era ignorado pelo ouvinte; a pergunta do telefone nunca abria. Decide aqui.
        if (cameFromOAuth && asksPhone(p, s.user)) setShowPhoneModal(true);
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
        profileFor.current = null;
        setSession(null);
        setUser(null);
        setProfile(null);
        setShowPhoneModal(false);
        resetAccountStores();
        return;
      }

      // Troca de e-mail confirmada ou senha nova: o usuário do login muda
      if (event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        return;
      }

      if (event === 'SIGNED_IN') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        // O auth-js emite SIGNED_IN de novo a cada volta à aba (`_recoverAndRefresh`): com o mesmo usuário,
        // nada de reler o perfil (2 consultas) nem de abrir a pergunta do telefone (revisão de 2026-11-13).
        const next = newSession?.user;
        if (!next || next.id === profileFor.current) return;
        if (profileFor.current) resetAccountStores();
        profileFor.current = next.id;
        setProfile(null);
        fetchProfile(next.id).then((p) => {
          if (cancelled || profileFor.current !== next.id) return;
          setProfile(p);
          if (asksPhone(p, next)) setShowPhoneModal(true);
        });
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
      profileFor.current = null;
      setUser(null);
      setSession(null);
      setProfile(null);
      setShowPhoneModal(false);
      resetAccountStores();
    }
  };

  const refreshProfile = async () => {
    const id = user?.id;
    if (!id) return;
    const p = await fetchProfile(id);
    if (p) setProfile(p);
  };

  const handlePhoneModalComplete = async () => {
    setShowPhoneModal(false);
    if (user) {
      const p = await fetchProfile(user.id);
      if (p) setProfile(p);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signInWithGoogle, signOut, refreshProfile }}>
      {children}
      <PhoneCollectionModal open={showPhoneModal} onComplete={handlePhoneModalComplete} userEmail={user?.email || ''} />
    </AuthContext.Provider>
  );
};
