import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { DEMO_USER } from './api';
import { hasBackend, supabase } from './supabase';

type AuthState = {
  userId: string | null;
  loading: boolean;
  /** Sends a 6-digit sign-in code by email (no passwords to leak). */
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  /** Demo mode only: skip email and sign in as a local user. */
  signInDemo(): void;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(hasBackend);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      userId,
      loading,
      async sendCode(email) {
        if (!supabase) return;
        const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
        if (error) throw error;
      },
      async verifyCode(email, code) {
        if (!supabase) return;
        const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
        if (error) throw error;
      },
      signInDemo() {
        setUserId(DEMO_USER.id);
      },
      async signOut() {
        if (supabase) await supabase.auth.signOut();
        setUserId(null);
      },
    }),
    [userId, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
