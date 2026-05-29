"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useAuth } from "./AuthProvider";

export function LoginButton() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return <div className="h-9 w-20 animate-pulse rounded-full bg-zinc-200" />;
  }

  if (user) {
    return (
      <button
        onClick={signOut}
        className="rounded-full px-4 py-1.5 text-sm font-medium text-neutral-700 hover:bg-zinc-100 transition-colors"
      >
        Sign Out
      </button>
    );
  }

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  return (
    <button
      onClick={() =>
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${location.origin}/api/auth/callback` },
        })
      }
      className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
    >
      Sign In
    </button>
  );
}
