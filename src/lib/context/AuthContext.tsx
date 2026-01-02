// /lib/context/AuthContext.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import { User as SupabaseUser, AuthError } from "@supabase/supabase-js";
import { getSupabaseClient, clearAuthData } from "@/lib/supabase/client";
import { ProfileData } from "@/lib/types/student";

interface AuthContextType {
  profile: ProfileData | null;
  setProfile: React.Dispatch<React.SetStateAction<ProfileData | null>>;
  loading: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: AuthError | null }>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithTwitter: () => Promise<void>;
  signOut: () => Promise<void>;
  supabase: ReturnType<typeof getSupabaseClient>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const supabase = getSupabaseClient(); // This now returns the singleton

  const fetchUserRole = useCallback(
    async (supabaseUser: SupabaseUser) => {
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("users_profile")
          .select("*")
          .eq("id", supabaseUser.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching user role:", error);
          setProfile(null);
          return;
        }

        if (data) {
          const profileData: ProfileData = {
            id: data.id,
            email: data.email,
            full_name: data.full_name,
            country_code: data.country_code,
            county_code: data.county_code,
            postal_address: data.postal_address,
            phone_number: data.phone_number || "",
            avatar_url: data.avatar_url,
            language: data.language,
            gender: data.gender,
            admission_no: data.admission_no,
            belt_level: data.belt_level,
            role: data.role,
            referred_by: data.referred_by,
            elite_plus: data.elite_plus,
            overall_performance: data.overall_performance,
            completed_all_programs: data.completed_all_programs,
            elite_plus_certified_at: data.elite_plus_certified_at,
            total_training_hours: data.total_training_hours,
            masters_rank: data.masters_rank,
            years_of_training: data.years_of_training,
            specializations: data.specializations,
            elite_plus_level: data.elite_plus_level,
          };
          setProfile(profileData);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Unexpected error in fetchUserRole:", err);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  // /lib/context/AuthContext.tsx - Updated useEffect
  useEffect(() => {
    let mounted = true;
    let initializationAttempts = 0;
    const MAX_INIT_ATTEMPTS = 3;

    const initializeAuth = async () => {
      if (!mounted) return;

      try {
        // Use getSession but with error boundaries
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Error getting session:", error);

          // Critical: If we get auth errors during initialization, clear everything
          if (error.message?.includes("refresh") || error.status === 401) {
            console.warn("Auth error during init, clearing auth data");
            clearAuthData();
          }

          if (mounted) setLoading(false);
          return;
        }

        if (mounted) {
          if (session?.user) {
            await fetchUserRole(session.user);
          } else {
            setLoading(false);
          }
        }
      } catch (error: any) {
        console.error("Error in initializeAuth:", error);

        // Handle token refresh loop errors
        if (
          error.message?.includes("refresh") ||
          error.message?.includes("invalid") ||
          error.status === 401
        ) {
          initializationAttempts++;

          if (initializationAttempts >= MAX_INIT_ATTEMPTS) {
            console.error(
              "Too many auth initialization failures, forcing cleanup"
            );
            clearAuthData();
            setProfile(null);
          }
        }

        if (mounted) setLoading(false);
      }
    };

    // Single auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log("Auth state change in context:", event);

      switch (event) {
        case "SIGNED_IN":
        case "TOKEN_REFRESHED":
        case "USER_UPDATED":
          if (session?.user) {
            await fetchUserRole(session.user);
          }
          break;

        case "SIGNED_OUT":
          setProfile(null);
          setLoading(false);
          // Clear auth data on sign out
          clearAuthData();
          break;

        case "TOKEN_REFRESHED":
          if (!session) {
            // This is critical - token refresh failed but returned no session
            console.error("Token refresh failed, session is null");
            setProfile(null);
            setLoading(false);
            clearAuthData();
          }
          break;

        default:
          if (!session) {
            setProfile(null);
            setLoading(false);
          }
          break;
      }
    });

    // Initialize auth
    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserRole, supabase]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          // Check for rate limiting
          if (error.status === 429) {
            return {
              error: new Error(
                "Too many attempts. Please wait a few minutes."
              ) as AuthError,
            };
          }
          return { error };
        }

        return { error: null };
      } catch (error) {
        console.error("Unexpected sign in error:", error);
        return { error: error as AuthError };
      }
    },
    [supabase]
  );

  // Login with magic link
  const signInWithMagicLink = async (email: string) => {
    const res = await fetch("/api/auth/magic-link", {
      method: "POST",
      body: JSON.stringify({ email }),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error || data.message || "Magic link failed");
  };

  const signInWithGoogle = async (): Promise<void> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const signInWithTwitter = async (): Promise<void> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "twitter",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const signOut = useCallback(async (): Promise<void> => {
    try {
      // Clear local state first
      setProfile(null);

      // Clear auth data
      clearAuthData();

      // Sign out from Supabase
      await supabase.auth.signOut();

      // Optional: Redirect to login
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Sign out error:", error);
      // Even if Supabase fails, clear local data
      setProfile(null);
      clearAuthData();
      throw error;
    }
  }, [supabase]);

  const value = useMemo<AuthContextType>(
    () => ({
      profile,
      setProfile,
      loading,
      signIn,
      signInWithMagicLink,
      signInWithGoogle,
      signInWithTwitter,
      signOut,
      supabase,
    }),
    [
      profile,
      loading,
      signIn,
      signInWithMagicLink,
      signInWithGoogle,
      signInWithTwitter,
      signOut,
      supabase,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
