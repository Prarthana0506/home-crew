import { useState, useEffect } from 'react';
import { supabase } from '@urbanclap/lib';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      // 1. Check if demo mode is enabled via environment variable
      if (import.meta.env.VITE_DEMO_MODE === 'true') {
        // Silently sign in as the seeded demo admin
        const { data, error } = await supabase.auth.signInWithPassword({
          email: import.meta.env.VITE_DEMO_ADMIN_EMAIL,
          password: import.meta.env.VITE_DEMO_ADMIN_PASSWORD,
        });
        
        if (!error && data.user) {
          setUser(data.user);
        } else {
          console.error('Demo login failed. Check credentials and seeding.', error);
        }
      } else {
        // 2. Standard auth flow for production / non-demo
        const { data } = await supabase.auth.getSession();
        setUser(data.session?.user || null);
      }
      setLoading(false);
    };

    initAuth();

    // 3. Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      // In demo mode, we ignore sign-out events to keep the user locked in
      if (import.meta.env.VITE_DEMO_MODE !== 'true') {
        setUser(session?.user ?? null);
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  return { user, loading };
}