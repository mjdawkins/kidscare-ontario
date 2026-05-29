import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1 px-4 pt-16 pb-24 md:pt-24">
        <div className="mx-auto max-w-sm space-y-8">
          <section className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">
              KidsCare Ontario
            </h1>
            <p className="text-slate-600 leading-relaxed">
              Find pediatricians, walk-in clinics, and ER wait times near you.
            </p>
          </section>

          <nav className="space-y-3" aria-label="Main navigation">
            <Link
              href="/urgent"
              className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-red-300 hover:bg-red-50/50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-700" aria-hidden="true">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </span>
              <div>
                <h2 className="font-medium text-slate-900">Urgent Care</h2>
                <p className="text-sm text-slate-600">Walk-in clinics open now. ER wait times. Directions.</p>
              </div>
            </Link>

            <Link
              href="/pediatricians"
              className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-700" aria-hidden="true">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </span>
              <div>
                <h2 className="font-medium text-slate-900">Find a Doctor</h2>
                <p className="text-sm text-slate-600">Search pediatricians. See who needs a referral. Get roster alerts.</p>
              </div>
            </Link>
          </nav>
        </div>
      </main>
      <MobileNav />
    </>
  );
}
