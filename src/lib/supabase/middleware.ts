// lib/supabase/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export const createMiddlewareClient = (
  request: NextRequest,
  response: NextResponse
) => {
  const isProduction = process.env.VERCEL_ENV === "production";

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              domain: isProduction ? ".worldsamma.org" : undefined,
              sameSite: "lax",
              secure: isProduction,
              maxAge: 60 * 60 * 24 * 7, // 7 days
            });
          });
        },
      },
    }
  );
};
