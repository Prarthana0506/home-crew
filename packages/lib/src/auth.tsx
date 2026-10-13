import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile, ProviderProfile, UserRole, ProviderType, Language } from './types';

interface AuthContextType {
  authUser: SupabaseAuthUser | null;
  profile: Profile | null;
  providerProfile: ProviderProfile | null;
  loading: boolean;
  isProfileComplete: boolean;
  appRole: UserRole;
  language: Language;
  setLanguage: (lang: Language) => void;
  signInWithEmail: (email: string, password?: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string, providerType?: ProviderType) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  completeProfile: (data: {
    name: string;
    phone: string;
    language: Language;
    area_id: string;
    providerDetails?: {
      provider_type: ProviderType;
      categories: string[];
      experience: number;
      id_proof_url?: string;
    };
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{
  children: React.ReactNode;
  appRole: UserRole;
}> = ({ children, appRole }) => {
  const [authUser, setAuthUser] = useState<SupabaseAuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<Language>('en');

  const loadUserProfile = async (userId: string) => {
    try {
      const { data: prof, error: profError } = await supabase
        .from('profiles')
        .select('*, area:areas(*)')
        .eq('id', userId)
        .maybeSingle();

      if (profError) throw profError;

      if (!prof) {
        // Initial profile creation on first sign-in (e.g. Google OAuth)
        const initialName = authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'User';
        const { data: newProf, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            role: appRole,
            name: initialName,
            language: 'en',
            phone_demo_verified: false,
            status: 'active'
          })
          .select('*, area:areas(*)')
          .single();

        if (createError) throw createError;
        setProfile(newProf);
      } else {
        setProfile(prof);
        if (prof.language) {
          setLanguage(prof.language as Language);
        }
      }

      // If user is a provider or organization owner, load provider_profiles
      if (appRole === 'provider' || prof?.role === 'provider') {
        const { data: provData } = await supabase
          .from('provider_profiles_with_coins')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        setProviderProfile(provData || null);
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check initial auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setProfile(null);
        setProviderProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [appRole]);

  // Determine if forced profile completion is required
  const isProfileComplete = Boolean(
    profile &&
    profile.name?.trim() &&
    profile.phone_demo_verified &&
    profile.area_id &&
    (appRole !== 'provider' || (providerProfile && providerProfile.categories?.length > 0))
  );

  const signInWithEmail = async (email: string, password = 'password123') => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        // Fallback for demo users seeded in local environments
        const { data: demoProf } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', appRole)
          .limit(1)
          .maybeSingle();

        if (demoProf) {
          setProfile(demoProf);
          return;
        }
        throw error;
      }

      if (data.user) {
        await loadUserProfile(data.user.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    name: string,
    providerType: ProviderType = 'freelancer'
  ) => {
    if (appRole === 'admin') {
      throw new Error('Admin registration is not allowed. Please login with admin credentials.');
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            role: appRole,
            provider_type: providerType
          }
        }
      });

      if (error) {
        if (error.message?.toLowerCase().includes('already registered')) {
          throw new Error('This email address is already registered. Please switch to the Sign In tab.');
        }
        throw error;
      }

      if (data.user) {
        if (!data.session) {
          throw new Error('Sign up successful! Please check your email inbox to confirm your account (or disable "Confirm email" in Supabase dashboard to log in directly).');
        }

        // Fetch profile provisioned by trigger
        const { data: existingProf } = await supabase
          .from('profiles')
          .select('*, area:areas(*)')
          .eq('id', data.user.id)
          .maybeSingle();

        if (existingProf) {
          setProfile(existingProf);
          if (appRole === 'provider') {
            const { data: provProf } = await supabase
              .from('provider_profiles')
              .select('*')
              .eq('user_id', data.user.id)
              .maybeSingle();
            if (provProf) setProviderProfile(provProf);
          }
        } else {
          // Fallback manual profile creation if trigger is not yet installed
          const { data: prof, error: profErr } = await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              role: appRole,
              name,
              language,
              phone_demo_verified: false,
              status: 'active'
            })
            .select('*, area:areas(*)')
            .maybeSingle();

          if (!profErr && prof) {
            setProfile(prof);
          }

          if (appRole === 'provider') {
            const { data: provProf } = await supabase
              .from('provider_profiles')
              .upsert({
                user_id: data.user.id,
                provider_type: providerType,
                skills: [],
                categories: [],
                experience: 0,
                status: 'active'
              })
              .select()
              .maybeSingle();

            if (provProf) setProviderProfile(provProf);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setAuthUser(null);
      setProfile(null);
      setProviderProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const completeProfile = async (data: {
    name: string;
    phone: string;
    language: Language;
    area_id: string;
    providerDetails?: {
      provider_type: ProviderType;
      categories: string[];
      experience: number;
      id_proof_url?: string;
    };
  }) => {
    if (!profile) throw new Error('No active profile session found');

    setLoading(true);
    try {
      const { data: updatedProf, error: profError } = await supabase
        .from('profiles')
        .update({
          name: data.name,
          phone: data.phone,
          phone_demo_verified: true,
          language: data.language,
          area_id: data.area_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id)
        .select('*, area:areas(*)')
        .single();

      if (profError) throw profError;
      setProfile(updatedProf);
      setLanguage(data.language);

      if (appRole === 'provider' && data.providerDetails) {
        // Find existing provider profile for this user
        const { data: existingProv } = await supabase
          .from('provider_profiles')
          .select('id')
          .eq('user_id', profile.id)
          .maybeSingle();

        const provPayload = {
          user_id: profile.id,
          provider_type: data.providerDetails.provider_type,
          categories: data.providerDetails.categories,
          experience: data.providerDetails.experience,
          id_proof_url: data.providerDetails.id_proof_url || 'verified_demo_id.pdf',
          status: 'active',
          updated_at: new Date().toISOString()
        };

        let updatedProv = null;
        if (existingProv?.id) {
          const { data: up, error: upErr } = await supabase
            .from('provider_profiles')
            .update(provPayload)
            .eq('id', existingProv.id)
            .select()
            .single();

          if (upErr) throw upErr;
          updatedProv = up;
        } else {
          const { data: ins, error: insErr } = await supabase
            .from('provider_profiles')
            .insert(provPayload)
            .select()
            .single();

          if (insErr) throw insErr;
          updatedProv = ins;
        }

        setProviderProfile(updatedProv);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        authUser,
        profile,
        providerProfile,
        loading,
        isProfileComplete,
        appRole,
        language,
        setLanguage,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
        completeProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
