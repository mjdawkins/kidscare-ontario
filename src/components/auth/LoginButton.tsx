"use client";

import { useAuth } from "./AuthProvider";

export function LoginButton() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return <div className="h-9 w-20 animate-pulse rounded-full bg-slate-200" />;
  }

  if (user) {
    return (
      <button
        onClick={signOut}
        className="rounded-full px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
      >
        Sign Out
      </button>
    );
  }

  return (
    <a
      href="/auth"
      className="rounded-full bg-blue-700 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 transition-colors"
    >
      Sign In
    </a>
  );
}
