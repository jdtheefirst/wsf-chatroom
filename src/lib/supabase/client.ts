// /lib/supabase/client.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";

// Global flag to prevent multiple listeners
let authListenerInitialized = false;

function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "pkce",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: {
          getItem: (key) => {
            try {
              if (typeof window !== "undefined") {
                return localStorage.getItem(key);
              }
              return null;
            } catch {
              return null;
            }
          },
          setItem: (key, value) => {
            try {
              if (typeof window !== "undefined") {
                localStorage.setItem(key, value);
              }
            } catch {}
          },
          removeItem: (key) => {
            try {
              if (typeof window !== "undefined") {
                localStorage.removeItem(key);
              }
            } catch {}
          },
        },
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

// True singleton with lazy initialization
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    console.log("[Supabase] Creating singleton instance");
    supabaseInstance = createClient();

    // Initialize auth listener ONCE
    if (!authListenerInitialized) {
      try {
        console.log("[Supabase] Setting up global auth listener");

        const {
          data: { subscription },
        } = supabaseInstance.auth.onAuthStateChange(async (event, session) => {
          console.log(`[Supabase] Global auth state change: ${event}`);

          if (event === "SIGNED_OUT") {
            console.log("[Supabase] Global SIGNED_OUT event, cleaning up");
            // Add a small delay to prevent immediate re-triggering
            setTimeout(() => {
              clearAuthData();
            }, 100);
          }
        });

        // Store for potential cleanup (though we never clean up the singleton)
        (supabaseInstance as any)._authSubscription = subscription;
        authListenerInitialized = true;
      } catch (error) {
        console.error("[Supabase] Failed to set up auth listener:", error);
      }
    }
  }

  return supabaseInstance;
}

// Clean up auth data
export function clearAuthData() {
  if (typeof window === "undefined") return;

  try {
    console.log("[Supabase] Starting auth data cleanup...");

    // Clear localStorage
    const supabaseKeys = ["supabase.auth.token"];
    for (const key of supabaseKeys) {
      localStorage.removeItem(key);
    }

    // Clear sessionStorage
    const sessionKeys = ["supabase.auth.token"];
    for (const key of sessionKeys) {
      sessionStorage.removeItem(key);
    }

    // Clear cookies (simplified approach)
    const domains = [
      window.location.hostname,
      `.${window.location.hostname}`,
      window.location.hostname.split(".").slice(-2).join("."),
      `.${window.location.hostname.split(".").slice(-2).join(".")}`,
    ];

    const cookieNames = [
      "sb-access-token",
      "sb-refresh-token",
      "supabase-auth-token",
    ];

    const expires = new Date(0).toUTCString();

    for (const domain of domains) {
      for (const name of cookieNames) {
        document.cookie = `${name}=; expires=${expires}; path=/; domain=${domain};`;
        document.cookie = `${name}=; expires=${expires}; path=/;`;
      }
    }

    console.log("[Supabase] Auth data cleanup completed");
  } catch (error) {
    console.error("[Supabase] Error during auth data cleanup:", error);
  }
}

// Optional: Reset function for development
export function resetSupabaseClient() {
  if (supabaseInstance && (supabaseInstance as any)._authSubscription) {
    (supabaseInstance as any)._authSubscription.unsubscribe();
  }
  supabaseInstance = null;
  authListenerInitialized = false;
}
