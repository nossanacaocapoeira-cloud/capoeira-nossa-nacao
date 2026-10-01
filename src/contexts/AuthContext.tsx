import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Profile, UserRole } from '../types/database';

interface SignUpPayload {
  email: string;
  password: string;
  fullName: string;
  nickname?: string;
  dateOfBirth: string;
  address: string;
  whatsapp: string;
  whatsappNormalized: string;
  guardianName?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  role: UserRole | null;
  isAdmin: boolean;
  isStudent: boolean;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; profile?: Profile | null }>;
  signUp: (data: SignUpPayload) => Promise<{ error: Error | null; profile?: Profile | null; session?: Session | null; user?: User | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch student/admin profile from public.profiles
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar perfil do usuário:', error.message);
        return null;
      }
      return data as Profile | null;
    } catch (err) {
      console.error('Erro inesperado ao buscar perfil:', err);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const p = await fetchProfile(user.id);
    if (p) {
      setProfile(p);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function initAuth() {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          const userProfile = await fetchProfile(initialSession.user.id);
          if (isMounted) setProfile(userProfile);
        }
      } catch (err) {
        console.error('Erro na inicialização da autenticação:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        if (!isMounted) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          const userProfile = await fetchProfile(currentSession.user.id);
          if (isMounted) setProfile(userProfile);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error };
      }

      let fetchedProfile: Profile | null = null;
      if (data.user) {
        fetchedProfile = await fetchProfile(data.user.id);
        setProfile(fetchedProfile);
        setUser(data.user);
        setSession(data.session);
      }

      return { error: null, profile: fetchedProfile };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signUp = async (payload: SignUpPayload) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: payload.email.trim(),
        password: payload.password,
        options: {
          data: {
            full_name: payload.fullName.trim(),
            nickname: payload.nickname?.trim() || null,
            date_of_birth: payload.dateOfBirth,
            address: payload.address.trim(),
            whatsapp: payload.whatsapp.trim(),
            whatsapp_normalized: payload.whatsappNormalized,
            guardian_name: payload.guardianName?.trim() || null,
          },
        },
      });

      if (error) {
        console.error('Supabase Auth Error:', error);
        return { error, session: null, user: null, profile: null };
      }

      let userProfile: Profile | null = null;
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        if (data.user) {
          userProfile = await fetchProfile(data.user.id);
          if (userProfile) {
            setProfile(userProfile);
          }
        }
      }

      return { error: null, session: data.session, user: data.user, profile: userProfile };
    } catch (err) {
      console.error('Supabase Auth Error:', err);
      return { error: err as Error, session: null, user: null, profile: null };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
    } catch (err) {
      console.error('Erro ao deslogar:', err);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/recuperar-senha',
      });
      return { error };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const role = profile?.role ?? null;
  const isAdmin = role === 'admin';
  const isStudent = role === 'student';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        role,
        isAdmin,
        isStudent,
        loading,
        isConfigured: isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
        resetPassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
