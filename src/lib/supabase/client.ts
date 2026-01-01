// /supabase/client.ts - Alternative approach using latest patterns
"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "pkce",
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false, // Disable persistence - we'll handle it manually
      },
      cookieOptions: {
        name: "sb-auth-token",
        maxAge: 60 * 60 * 8, // 8 hours
        domain: "",
        path: "/",
        sameSite: "lax",
      },
    }
  );
}

// Singleton instance
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient();

    // Add error handling for refresh attempts
    supabaseInstance.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") {
        console.log("Token refreshed successfully");
      }
    });
  }
  return supabaseInstance;
}

// Helper to manually manage session persistence
export async function manuallyPersistSession(session: any) {
  if (!session) {
    localStorage.removeItem("supabase.auth.token");
    return;
  }

  try {
    localStorage.setItem(
      "supabase.auth.token",
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        user: session.user,
      })
    );
  } catch (error) {
    console.error("Error persisting session:", error);
  }
}

// Helper to manually clear session
export function manuallyClearSession() {
  try {
    localStorage.removeItem("supabase.auth.token");
    sessionStorage.removeItem("supabase.auth.token");

    // Clear cookies
    document.cookie.split(";").forEach((cookie) => {
      const cookieName = cookie.split("=")[0].trim();
      if (cookieName.includes("supabase") || cookieName.includes("sb-")) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });
  } catch (error) {
    console.error("Error clearing session:", error);
  }
}
