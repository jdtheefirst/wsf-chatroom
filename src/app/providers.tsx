"use client";

import { AuthProvider } from "@/lib/context/AuthContext";
import { ToastProvider } from "@/components/ui/use-toast";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        {children}
        <Toaster position="top-right" richColors />
      </ToastProvider>
    </AuthProvider>
  );
}

