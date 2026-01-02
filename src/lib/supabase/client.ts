// /lib/supabase/client.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "pkce",
      },
      isSingleton: true, // ⚠️ CRITICAL: Prevents multiple instances
      global: {
        // Optional: Add headers if needed
        headers: {
          "X-Client-Info": "worldsamma-web",
        },
      },
    }
  );
}

// Singleton wrapper to ensure single instance
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient();

    // Add ONE global listener for refresh errors
    supabaseInstance.auth.onAuthStateChange(async (event, session) => {
      if (event === "TOKEN_REFRESHED") {
        console.log("Token refreshed successfully");
      }

      // Handle invalid refresh token globally
      if (event === "SIGNED_OUT" && session === null) {
        console.log("Signed out event received");
      }
    });
  }
  return supabaseInstance;
}

// Simple helper to clear auth data
export function clearAuthData() {
  try {
    // Clear all auth-related storage
    localStorage.removeItem("supabase.auth.token");
    sessionStorage.removeItem("supabase.auth.token");

    // Clear cookies
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
      const cookieName = cookie.split("=")[0].trim();
      if (cookieName.includes("supabase") || cookieName.includes("sb-")) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    }
  } catch (error) {
    console.error("Error clearing auth data:", error);
  }
}
