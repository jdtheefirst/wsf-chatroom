"use client";

import { createBrowserClient as createBrowserClientBase } from "@supabase/ssr";

let supabase: ReturnType<typeof createBrowserClientBase> | null = null;

export function getSupabaseClient() {
  if (!supabase) {
    const isProduction = process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

    supabase = createBrowserClientBase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieEncoding: "base64url",
        auth: {
          flowType: "pkce",
        },
        cookieOptions: {
          domain: isProduction ? ".worldsamma.org" : undefined, // 👈 Shared cookie for all subdomains
          sameSite: "lax",
          secure: isProduction,
          maxAge: 60 * 60 * 24 * 7, // 7 days
        },
         realtime: {
         params: {
         eventsPerSecond: 10,
        },
      },
      }
    );
  }
  return supabase;
}
