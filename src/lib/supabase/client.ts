// /lib/supabase/client.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";

// Track refresh attempts to prevent loops
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 2;
let isRefreshing = false;

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "pkce",
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

// Singleton wrapper
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient();

    // Add global listener for auth state changes
    supabaseInstance.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state change event:", event);

      // Handle refresh failures
      if (event === "TOKEN_REFRESHED") {
        console.log("Token refreshed successfully");
        refreshAttempts = 0; // Reset on success
        isRefreshing = false;
      }

      // Critical: Handle refresh token errors
      if (event === "TOKEN_REFRESHED" && !session) {
        console.warn("Token refresh returned null session");
        isRefreshing = false;
        refreshAttempts++;

        if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
          console.error("Max refresh attempts reached, forcing sign out");
          await forceCleanSignOut();
        }
      }

      // Handle invalid refresh token errors
      if (event === "SIGNED_OUT") {
        console.log("Signed out event received, cleaning up...");
        isRefreshing = false;
        refreshAttempts = 0;

        // Clear any remaining auth data
        clearAuthData();
      }
    });

    // Intercept auth errors at the API level
    const originalSignOut = supabaseInstance.auth.signOut.bind(
      supabaseInstance.auth
    );
    supabaseInstance.auth.signOut = async () => {
      try {
        refreshAttempts = 0;
        isRefreshing = false;
        const result = await originalSignOut();
        clearAuthData();
        return result;
      } catch (error) {
        console.error("Error during sign out:", error);
        // Still clear local data even if server fails
        clearAuthData();
        return { error: error as any };
      }
    };
  }
  return supabaseInstance;
}

// Force cleanup when refresh fails
async function forceCleanSignOut() {
  try {
    console.log("Performing forced cleanup of auth state");

    // 1. Clear all storage
    clearAuthData();

    // 2. Clear Supabase's internal session
    if (supabaseInstance) {
      await supabaseInstance.auth.signOut();
    }

    // 3. Reset counters
    refreshAttempts = 0;
    isRefreshing = false;

    // 4. Optional: Redirect to login page
    if (typeof window !== "undefined") {
      window.location.href = "/auth/login?session=expired";
    }
  } catch (error) {
    console.error("Error in forceCleanSignOut:", error);
  }
}

export function clearAuthData() {
  try {
    // Clear localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.includes("supabase") || key?.includes("sb-")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // Clear sessionStorage
    const sessionKeysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.includes("supabase") || key?.includes("sb-")) {
        sessionKeysToRemove.push(key);
      }
    }
    sessionKeysToRemove.forEach((key) => sessionStorage.removeItem(key));

    // Clear cookies
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
      const cookieName = cookie.split("=")[0].trim();
      if (cookieName.includes("supabase") || cookieName.includes("sb-")) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    }

    console.log("Auth data cleared");
  } catch (error) {
    console.error("Error clearing auth data:", error);
  }
}
