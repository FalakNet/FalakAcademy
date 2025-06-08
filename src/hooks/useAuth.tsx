import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile, UserRole } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create one
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            name: 'User',
            email: user?.email || '',
            role: 'USER',
          })
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        setProfile(newProfile);
      } else if (error) {
        throw error;
      } else {
        setProfile(data);
      }
    } catch (error) {
      // Set a default profile to prevent app from breaking
      setProfile({
        id: userId,
        name: 'User',
        email: user?.email || '',
        role: 'USER',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error refreshing profile:', error);
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name
          }
        }
      });

      if (error) throw error;

      // The trigger will automatically create the profile with email
      // But we can also manually create it as a fallback
      if (data.user && !data.session) {
        // User needs to confirm email, but we can still create the profile
        await supabase.from('profiles').insert({
          id: data.user.id,
          name,
          email,
          role: 'USER',
        });
      }
    } catch (error) {
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // First, try to refresh the session to check if it's still valid
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      // If refresh fails or returns no session, the session is already invalid
      if (refreshError || !refreshData.session) {
        // Clear local state without calling signOut on server
        setSession(null);
        setUser(null);
        setProfile(null);
        return;
      }

      // If we have a valid session, proceed with normal signOut
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        // Handle specific session-related errors
        if (error.message?.includes('session_not_found') || 
            error.message?.includes('Session from session_id claim in JWT does not exist') ||
            error.message?.includes('Auth session missing!')) {
          // Clear local state since session is already gone
          setSession(null);
          setUser(null);
          setProfile(null);
          return;
        }
        throw error;
      }
    } catch (error) {
      // If any unexpected error occurs, still clear local state
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  };

  const hasRole = (role: UserRole): boolean => {
    return profile?.role === role;
  };

  const isAdmin = (): boolean => {
    return profile?.role === 'COURSE_ADMIN' || profile?.role === 'SUPERADMIN';
  };

  const isSuperAdmin = (): boolean => {
    return profile?.role === 'SUPERADMIN';
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    refreshProfile,
    hasRole,
    isAdmin,
    isSuperAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}