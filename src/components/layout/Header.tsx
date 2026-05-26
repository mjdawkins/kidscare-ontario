import Link from "next/link";
import { LoginButton } from "@/components/auth/LoginButton";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          KidsCare Ontario
        </Link>
        <LoginButton />
      </div>
    </header>
  );
}
