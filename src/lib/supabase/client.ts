// /lib/supabase/client.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";

// Global flags
let supabaseInstance: ReturnType<typeof createClient> | null = null;
let authListenerInitialized = false;
let isTokenInvalid = false; // CRITICAL: Track if token is known to be invalid

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "pkce",
        autoRefreshToken: false, // CRITICAL: Disable auto-refresh
        persistSession: true,
        detectSessionInUrl: true,
      },
      isSingleton: true,
      global: {
        headers: {
          "X-Client-Info": "worldsamma-web",
        },
      },
    }
  );
}

export function getSupabaseClient() {
  if (!supabaseInstance) {
    console.log("[Supabase] Creating singleton instance");
    supabaseInstance = createClient();

    // Monkey-patch the auth client to intercept refresh attempts
    const originalAuth = supabaseInstance.auth;

    // Intercept signOut to set the invalid flag
    const originalSignOut = originalAuth.signOut.bind(originalAuth);
    originalAuth.signOut = async (options) => {
      isTokenInvalid = true;
      console.log("[Supabase] Setting token as invalid before sign out");
      try {
        return await originalSignOut(options);
      } finally {
        clearAuthData();
      }
    };

    // Intercept refreshSession to block invalid attempts
    if (originalAuth.refreshSession) {
      const originalRefreshSession =
        originalAuth.refreshSession.bind(originalAuth);
      originalAuth.refreshSession = async (currentSession) => {
        if (isTokenInvalid) {
          console.log(
            "[Supabase] Blocking refresh attempt - token known to be invalid"
          );
          throw new Error("Token invalid, refresh blocked");
        }

        try {
          return await originalRefreshSession(currentSession);
        } catch (error: any) {
          // If refresh fails with invalid token error, mark as invalid
          if (
            error.message?.includes("Invalid Refresh Token") ||
            error.status === 400
          ) {
            console.log("[Supabase] Token refresh failed, marking as invalid");
            isTokenInvalid = true;
            clearAuthData();

            // Dispatch a custom event that AuthContext can listen for
            window.dispatchEvent(new CustomEvent("supabase-token-invalid"));
          }
          throw error;
        }
      };
    }

    // Set up ONE global listener
    if (!authListenerInitialized) {
      try {
        console.log("[Supabase] Setting up global auth listener");

        const {
          data: { subscription },
        } = supabaseInstance.auth.onAuthStateChange(async (event, session) => {
          console.log(`[Supabase] Global auth state change: ${event}`);

          if (event === "SIGNED_OUT") {
            isTokenInvalid = true;
            console.log("[Supabase] SIGNED_OUT, marking token invalid");

            // Use requestIdleCallback to avoid blocking and race conditions
            if (typeof requestIdleCallback !== "undefined") {
              requestIdleCallback(() => clearAuthData());
            } else {
              setTimeout(() => clearAuthData(), 100);
            }
          }

          if (event === "SIGNED_IN") {
            isTokenInvalid = false; // Reset flag on successful sign in
          }
        });

        (supabaseInstance as any)._authSubscription = subscription;
        authListenerInitialized = true;
      } catch (error) {
        console.error("[Supabase] Failed to set up auth listener:", error);
      }
    }
  }

  return supabaseInstance;
}

// Enhanced cleanup that also clears Supabase's internal state
export function clearAuthData() {
  if (typeof window === "undefined") return;

  try {
    console.log("[Supabase] Starting comprehensive auth data cleanup...");

    // Set the invalid flag
    isTokenInvalid = true;

    // 1. Clear all localStorage with supabase/sb prefixes
    const allKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.includes("supabase") ||
          key.includes("sb-") ||
          key.includes("auth"))
      ) {
        allKeys.push(key);
      }
    }
    allKeys.forEach((key) => localStorage.removeItem(key));

    // 2. Clear sessionStorage
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (
        key &&
        (key.includes("supabase") ||
          key.includes("sb-") ||
          key.includes("auth"))
      ) {
        sessionStorage.removeItem(key);
      }
    }

    // 3. Clear IndexedDB (Supabase might use it)
    if ("indexedDB" in window) {
      try {
        indexedDB.deleteDatabase("supabase");
      } catch (e) {
        // Ignore IndexedDB errors
      }
    }

    // 4. Clear cookies - minimal, targeted approach
    const cookieNames = [
      "sb-access-token",
      "sb-refresh-token",
      "supabase-auth-token",
      "sb-session",
      "sb-user",
    ];

    const expires = "Thu, 01 Jan 1970 00:00:00 UTC";
    const path = "/";
    const domain = window.location.hostname;

    cookieNames.forEach((name) => {
      document.cookie = `${name}=; expires=${expires}; path=${path};`;
      document.cookie = `${name}=; expires=${expires}; path=${path}; domain=${domain};`;
      document.cookie = `${name}=; expires=${expires}; path=${path}; domain=.${domain};`;
    });

    console.log("[Supabase] Comprehensive auth data cleanup completed");
  } catch (error) {
    console.error("[Supabase] Error during auth data cleanup:", error);
  }
}

// Force reset everything
export function resetSupabaseClient() {
  console.log("[Supabase] Resetting Supabase client completely");

  if (supabaseInstance && (supabaseInstance as any)._authSubscription) {
    (supabaseInstance as any)._authSubscription.unsubscribe();
  }

  supabaseInstance = null;
  authListenerInitialized = false;
  isTokenInvalid = false;
}
