// /components/AuthLoopBreaker.tsx
"use client";

import { useEffect } from "react";
import { clearAuthData, resetSupabaseClient } from "@/lib/supabase/client";

export default function AuthLoopBreaker() {
  useEffect(() => {
    // Listen for multiple SIGNED_OUT events in quick succession
    let signOutCount = 0;
    let signOutTimer: NodeJS.Timeout;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Clear everything when tab becomes inactive
        clearAuthData();
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.includes("supabase") || e.key?.includes("sb-")) {
        // If Supabase storage is changing, monitor for loops
        signOutCount++;

        if (signOutCount > 3) {
          console.error("Auth loop detected, forcing reset");
          resetSupabaseClient();
          signOutCount = 0;

          // Force page reload as last resort
          setTimeout(() => {
            if (typeof window !== "undefined") {
              window.location.reload();
            }
          }, 1000);
        }

        clearTimeout(signOutTimer);
        signOutTimer = setTimeout(() => {
          signOutCount = 0; // Reset count after 2 seconds
        }, 2000);
      }
    };

    // Add listeners
    window.addEventListener("storage", handleStorageChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup on unmount
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTimeout(signOutTimer);
    };
  }, []);

  return null; // This component doesn't render anything
}
