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
      // Test Supabase connection first
      console.log('Testing Supabase connection...');
      console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
      console.log('Supabase Anon Key exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
      
      // Try a simple health check first
      const { data: healthCheck, error: healthError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);
      
      if (healthError) {
        console.error('Supabase health check failed:', healthError);
        throw new Error(`Supabase connection failed: ${healthError.message}`);
      }
      
      console.log('Supabase connection successful, loading profile...');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create one
        console.log('Profile not found, creating new profile...');
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
          console.error('Error creating profile:', createError);
          throw createError;
        }

        console.log('Profile created successfully:', newProfile);
        setProfile(newProfile);
      } else if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      } else {
        console.log('Profile loaded successfully:', data);
        setProfile(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      
      // Provide more specific error information
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.error('Network error details:');
        console.error('- Check if Supabase URL is correct:', import.meta.env.VITE_SUPABASE_URL);
        console.error('- Check if you have internet connectivity');
        console.error('- Check if Supabase project is active and not paused');
        console.error('- Check browser network tab for CORS or other network errors');
      }
      
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
      console.error('Sign up error:', error);
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
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // First, try to refresh the session to check if it's still valid
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      // If refresh fails or returns no session, the session is already invalid
      if (refreshError || !refreshData.session) {
        console.warn('Session already expired or invalid, clearing local state');
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
          console.warn('Session already expired or not found, clearing local state');
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
      console.warn('Error during signOut, clearing local state:', error);
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