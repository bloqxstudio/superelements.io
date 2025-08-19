
import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'free' | 'pro' | 'admin';

interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

interface SubscriptionInfo {
  subscribed: boolean;
  role: UserRole;
  subscription_end?: string | null;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  subscription: SubscriptionInfo | null;
  isInitialized: boolean;
  isProfileLoading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setSubscription: (subscription: SubscriptionInfo | null) => void;
  setInitialized: (initialized: boolean) => void;
  setProfileLoading: (loading: boolean) => void;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  checkSubscription: () => Promise<void>;
  initialize: () => Promise<() => void>;
  resendConfirmation: (email: string) => Promise<{ error: any }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  subscription: null,
  isInitialized: false,
  isProfileLoading: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setSubscription: (subscription) => set({ subscription }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  setProfileLoading: (isProfileLoading) => set({ isProfileLoading }),

  signIn: async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error };
  },

  signUp: async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });

    return { error };
  },

  signInWithGoogle: async () => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    });

    return { error };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      user: null,
      session: null,
      profile: null,
      subscription: null,
    });
  },

  resendConfirmation: async (email: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: redirectUrl
      }
    });

    return { error };
  },

  fetchProfile: async () => {
    const { user } = get();
    console.log('🔍 fetchProfile called, user:', user?.id);
    if (!user) {
      console.log('❌ fetchProfile: No user found');
      return;
    }

    set({ isProfileLoading: true });
    try {
      console.log('📝 Fetching profile for user:', user.id);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('❌ Error fetching profile:', error);
        set({ profile: null, isProfileLoading: false });
        return;
      }

      console.log('✅ Profile loaded:', data);
      set({ profile: data, isProfileLoading: false });
    } catch (error) {
      console.error('❌ Exception fetching profile:', error);
      set({ profile: null, isProfileLoading: false });
    }
  },

  checkSubscription: async () => {
    const { session } = get();
    if (!session) return;

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      set({ subscription: data });
      
      // Also update profile if role changed
      await get().fetchProfile();
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  },

  initialize: async () => {
    console.log('🔐 Starting auth initialization...');
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`🔄 Auth state changed: ${event}`, session?.user?.id || 'no user');
        set({ session, user: session?.user ?? null });
        
        if (session?.user) {
          console.log('👤 User authenticated, loading profile and subscription...');
          try {
            await get().fetchProfile();
            await get().checkSubscription();
            console.log('✅ Profile and subscription loaded via auth state change');
          } catch (error) {
            console.error('❌ Error during auth state update:', error);
          }
        } else {
          console.log('👤 No user, clearing profile and subscription');
          set({ profile: null, subscription: null, isProfileLoading: false });
        }
      }
    );

    // Check for existing session
    console.log('🔍 Checking for existing session...');
    const { data: { session } } = await supabase.auth.getSession();
    console.log('📋 Existing session:', session?.user?.id || 'none');
    
    set({ session, user: session?.user ?? null });
    
    if (session?.user) {
      console.log('👤 Existing user found, loading profile and subscription...');
      try {
        await get().fetchProfile();
        await get().checkSubscription();
        console.log('✅ Profile and subscription loaded for existing session');
      } catch (error) {
        console.error('❌ Error loading existing session data:', error);
      }
    }
    
    // Set initialized after all loading attempts
    console.log('✅ Auth initialization complete');
    set({ isInitialized: true });

    // Return cleanup function
    return () => subscription.unsubscribe();
  },
}));
