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
import { getSupabaseClient, clearAuthData } from "@/lib/supabase/client";
import { ProfileData } from "@/lib/types/student";

interface AuthContextType {
  profile: ProfileData | null;
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

  // Use refs
  const mountedRef = useRef(true);
  const supabaseRef = useRef<ReturnType<typeof getSupabaseClient> | null>(null);
  const authSubscriptionRef = useRef<any>(null);

  // Initialize supabase once - synchronous now
  useEffect(() => {
    console.log("[AuthContext] Initializing Supabase client");
    supabaseRef.current = getSupabaseClient();

    return () => {
      mountedRef.current = false;
      if (authSubscriptionRef.current) {
        console.log("[AuthContext] Cleaning up auth subscription");
        authSubscriptionRef.current.unsubscribe();
        authSubscriptionRef.current = null;
      }
    };
  }, []); // Empty dependency array - initialize once

  const fetchUserRole = useCallback(async (supabaseUser: SupabaseUser) => {
    if (!supabaseRef.current || !mountedRef.current) return;

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

  useEffect(() => {
    mountedRef.current = true;

    const initializeAuth = async () => {
      if (!supabaseRef.current || !mountedRef.current) {
        if (mountedRef.current) setLoading(false);
        return;
      }

      try {
        console.log("[AuthContext] Initializing auth state");

        // Use getSession with a timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Auth initialization timeout")),
            5000
          )
        );

        const sessionPromise = supabaseRef.current.auth.getSession();

        const {
          data: { session },
          error,
        } = (await Promise.race([sessionPromise, timeoutPromise])) as any;

        if (error) {
          console.error("[AuthContext] Error getting session:", error);

          // If it's an auth error, clear data
          if (error.message?.includes("auth") || error.status === 401) {
            console.log("[AuthContext] Clearing auth data due to error");
            // Don't clear here - let the singleton handle it
          }

          if (mountedRef.current) {
            setLoading(false);
          }
          return;
        }

        if (mountedRef.current) {
          if (session?.user) {
            console.log("[AuthContext] User found, fetching profile");
            await fetchUserRole(session.user);
          } else {
            console.log("[AuthContext] No user session found");
            setLoading(false);
          }
        }
      } catch (error: any) {
        console.error("[AuthContext] Error in initializeAuth:", error);
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    // Set up ONE auth listener for the context
    const setupAuthListener = () => {
      if (!supabaseRef.current || authSubscriptionRef.current) return;

      try {
        console.log("[AuthContext] Setting up auth state listener");

        const {
          data: { subscription },
        } = supabaseRef.current.auth.onAuthStateChange(
          async (event, session) => {
            if (!mountedRef.current) return;

            console.log(`[AuthContext] Auth state change: ${event}`);

            switch (event) {
              case "SIGNED_IN":
              case "USER_UPDATED":
                if (session?.user) {
                  await fetchUserRole(session.user);
                }
                break;

              case "TOKEN_REFRESHED":
                if (session?.user) {
                  // Silently update, no need to fetch profile again unless needed
                  console.log("[AuthContext] Token refreshed");
                }
                break;

              case "SIGNED_OUT":
                console.log("[AuthContext] SIGNED_OUT event in context");
                setProfile(null);
                setLoading(false);
                // IMPORTANT: Don't call clearAuthData here - singleton handles it
                break;

              default:
                if (!session) {
                  setProfile(null);
                  setLoading(false);
                }
                break;
            }
          }
        );

        authSubscriptionRef.current = subscription;
      } catch (error) {
        console.error("[AuthContext] Error setting up auth listener:", error);
      }
    };

    initializeAuth();
    setupAuthListener();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchUserRole]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabaseRef.current) {
      return {
        error: new Error("Supabase client not initialized") as AuthError,
      };
    }

    try {
      const { data, error } = await supabaseRef.current.auth.signInWithPassword(
        {
          email,
          password,
        }
      );

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

      return { error: null };
    } catch (error) {
      console.error("Unexpected sign in error:", error);
      return { error: error as AuthError };
    }
  }, []);

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
    if (!supabaseRef.current)
      throw new Error("Supabase client not initialized");

    const { error } = await supabaseRef.current.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  }, []);

  const signInWithTwitter = useCallback(async (): Promise<void> => {
    if (!supabaseRef.current)
      throw new Error("Supabase client not initialized");

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
      setLoading(false);

      // Sign out from Supabase if client exists
      if (supabaseRef.current) {
        await supabaseRef.current.auth.signOut();
      }

      // Clear auth data
      clearAuthData();

      // Redirect to home
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Sign out error:", error);
      // Even if Supabase fails, clear local data and redirect
      setProfile(null);
      setLoading(false);
      clearAuthData();

      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    }
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      profile,
      loading,
      signIn,
      signInWithMagicLink,
      signInWithGoogle,
      signInWithTwitter,
      signOut,
      supabase: supabaseRef.current!,
    }),
    [
      profile,
      loading,
      signIn,
      signInWithMagicLink,
      signInWithGoogle,
      signInWithTwitter,
      signOut,
      supabaseRef,
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
