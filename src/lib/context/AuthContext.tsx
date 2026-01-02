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
  useRef,
} from "react";
import { User as SupabaseUser, AuthError } from "@supabase/supabase-js";
import {
  getSupabaseClient,
  clearAuthData,
  resetSupabaseClient,
} from "@/lib/supabase/client";
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

  // Use refs to store the actual instance and prevent re-renders
  const mountedRef = useRef(true);
  const initializedRef = useRef(false);

  // Store the supabase instance in state so it can be passed in context
  // But we use a ref for the actual operations to prevent dependency loops
  const [supabase] = useState(() => getSupabaseClient());
  const supabaseRef = useRef(supabase);

  const fetchUserRole = useCallback(async (supabaseUser: SupabaseUser) => {
    if (!mountedRef.current) return;

    try {
      const { data, error } = await supabaseRef.current
        .from("users_profile")
        .select("*")
        .eq("id", supabaseUser.id)
        .maybeSingle();

      if (error) {
        console.error("[AuthContext] Error fetching user role:", error);
        if (mountedRef.current) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      if (data && mountedRef.current) {
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
        setLoading(false);
      } else if (mountedRef.current) {
        setProfile(null);
        setLoading(false);
      }
    } catch (err) {
      console.error("[AuthContext] Unexpected error in fetchUserRole:", err);
      if (mountedRef.current) {
        setProfile(null);
        setLoading(false);
      }
    }
  }, []);

  // Listen for token invalid events
  useEffect(() => {
    const handleTokenInvalid = () => {
      console.log("[AuthContext] Received token invalid event");
      if (mountedRef.current) {
        setProfile(null);
        setLoading(false);
      }
    };

    window.addEventListener("supabase-token-invalid", handleTokenInvalid);

    return () => {
      window.removeEventListener("supabase-token-invalid", handleTokenInvalid);
    };
  }, []);

  // Check auth state ONCE on mount - without setting up permanent listeners
  useEffect(() => {
    if (initializedRef.current || !mountedRef.current) return;

    const checkAuthState = async () => {
      try {
        console.log("[AuthContext] Checking initial auth state");

        // Use a simple session check without auto-refresh
        const {
          data: { session },
          error,
        } = await supabaseRef.current.auth.getSession();

        if (error) {
          console.error("[AuthContext] Error getting initial session:", error);

          // If it's an invalid token error, don't retry - just reset
          if (
            error.message?.includes("Invalid Refresh Token") ||
            error.status === 400
          ) {
            console.log("[AuthContext] Invalid token detected on init");
            // The singleton client already handles this, just update UI
          }

          if (mountedRef.current) {
            setLoading(false);
          }
          return;
        }

        if (mountedRef.current) {
          if (session?.user) {
            console.log("[AuthContext] Initial user found, fetching profile");
            await fetchUserRole(session.user);
          } else {
            console.log("[AuthContext] No initial session found");
            setLoading(false);
          }
        }
      } catch (error: any) {
        console.error(
          "[AuthContext] Error checking initial auth state:",
          error
        );
        if (mountedRef.current) {
          setLoading(false);
        }
      } finally {
        initializedRef.current = true;
      }
    };

    checkAuthState();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchUserRole]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const { data, error } =
          await supabaseRef.current.auth.signInWithPassword({
            email,
            password,
          });

        if (error) {
          if (error.status === 429) {
            return {
              error: new Error(
                "Too many attempts. Please wait a few minutes."
              ) as AuthError,
            };
          }
          return { error };
        }

        // Manually update profile after successful sign in
        if (data.user && mountedRef.current) {
          await fetchUserRole(data.user);
        }

        return { error: null };
      } catch (error) {
        console.error("Unexpected sign in error:", error);
        return { error: error as AuthError };
      }
    },
    [fetchUserRole]
  );

  const signInWithMagicLink = useCallback(async (email: string) => {
    const res = await fetch("/api/auth/magic-link", {
      method: "POST",
      body: JSON.stringify({ email }),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error || data.message || "Magic link failed");
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<void> => {
    const { error } = await supabaseRef.current.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  }, []);

  const signInWithTwitter = useCallback(async (): Promise<void> => {
    const { error } = await supabaseRef.current.auth.signInWithOAuth({
      provider: "twitter",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      console.log("[AuthContext] Starting sign out");

      // Clear local state first
      setProfile(null);
      setLoading(true);

      // Sign out from Supabase
      await supabaseRef.current.auth.signOut();

      // Reset the client to clear any cached state
      resetSupabaseClient();

      // Redirect to home
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Sign out error:", error);
      // Even if Supabase fails, clear everything and redirect
      setProfile(null);
      setLoading(false);
      resetSupabaseClient();

      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    }
  }, []);

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
      supabase, // Pass the instance in context
    }),
    [
      profile,
      loading,
      signIn,
      signInWithMagicLink,
      signInWithGoogle,
      signInWithTwitter,
      signOut,
      supabase, // Include in dependencies
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
