import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1 px-4 py-12 pb-24 md:py-20">
        <div className="mx-auto max-w-lg space-y-10">
          <div className="space-y-3 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-black md:text-4xl">
              KidsCare Ontario
            </h1>
            <p className="text-lg text-zinc-700 max-w-sm mx-auto">
              Find pediatricians, walk-in clinics, and ER wait times for your child — all in one place.
            </p>
          </div>

          <div className="space-y-4">
            <Link
              href="/urgent"
              className="group flex items-start gap-4 rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-white p-5 transition-shadow hover:shadow-lg hover:border-red-200"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-black group-hover:text-red-700 transition-colors">
                  Urgent Care
                </h2>
                <p className="text-sm text-zinc-700 mt-0.5">
                  Find walk-in clinics open now. See ER wait times. Get directions.
                </p>
              </div>
            </Link>

            <Link
              href="/pediatricians"
              className="group flex items-start gap-4 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 transition-shadow hover:shadow-lg hover:border-blue-200"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-black group-hover:text-blue-700 transition-colors">
                  Find a Doctor
                </h2>
                <p className="text-sm text-zinc-700 mt-0.5">
                  Search pediatricians by location. See who needs a referral. Get roster alerts.
                </p>
              </div>
            </Link>
          </div>
        </div>
      </main>
      <MobileNav />
    </>
  );
}
