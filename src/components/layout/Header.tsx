import Link from "next/link";
import { LoginButton } from "@/components/auth/LoginButton";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-gray-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white text-sm font-bold">
            KC
          </span>
          KidsCare
        </Link>
        <LoginButton />
      </div>
    </header>
  );
}
