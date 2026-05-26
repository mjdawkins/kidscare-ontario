"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/urgent", label: "Urgent Care" },
  { href: "/pediatricians", label: "Find Doctor" },
  { href: "/alerts", label: "Alerts" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white md:hidden">
      <div className="flex h-14 items-center justify-around">
        {links.map(({ href, label }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium ${
                active ? "text-black" : "text-zinc-400"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
