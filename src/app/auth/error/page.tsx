// app/auth/error/page.tsx
import { redirect } from "next/navigation";
import { XCircle } from "lucide-react";
import { cn } from "@/lib/utils"; // your className util if using
import Link from "next/link";

type SearchParams = Promise<{
  error?: string;
  error_description?: string;
}>;

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, error_description } = await searchParams;

  if (!error) {
    redirect("/login");
  }

  const isExpired =
    error === "access_denied" &&
    error_description?.toLowerCase().includes("expired");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="max-w-md w-full space-y-6">
        <div
          className={cn(
            "w-16 h-16 mx-auto rounded-full flex items-center justify-center",
            isExpired ? "bg-yellow-500/10" : "bg-red-500/10"
          )}
        >
          {isExpired ? (
            <XCircle className="w-10 h-10 text-yellow-600" />
          ) : (
            <XCircle className="w-10 h-10 text-red-600" />
          )}
        </div>

        <h1 className="text-2xl font-bold">
          {isExpired ? "This login link has expired." : "Authentication Failed"}
        </h1>

        <p className="text-muted-foreground text-sm">
          {isExpired
            ? "The magic link or social login has expired or been used already. Please request a new one."
            : "Something went wrong during sign in. Please try again or contact support."}
        </p>

        <div className="flex justify-center mt-4">
          <Link
            href={isExpired ? "/login" : "/explore"}
            className="inline-flex items-center px-4 py-2 text-sm font-medium bg-primary rounded hover:bg-primary/90 transition"
          >
            {isExpired ? "Try Again" : "Explore Site"}
          </Link>
        </div>
      </div>
    </div>
  );
}
