import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1 px-4 py-8 pb-20 md:pb-8">
        <div className="mx-auto max-w-lg space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
              KidsCare Ontario
            </h1>
            <p className="text-lg text-zinc-600">
              Find pediatricians, walk-in clinics, and ER wait times for your child.
            </p>
          </div>

          <div className="grid gap-4">
            <Link
              href="/urgent"
              className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 p-6 transition-shadow hover:shadow-md"
            >
              <h2 className="text-xl font-semibold text-red-800">
                Urgent Care
              </h2>
              <p className="text-red-600">
                Find walk-in clinics that see children, open now. ER wait times. Virtual care options.
              </p>
            </Link>

            <Link
              href="/pediatricians"
              className="flex flex-col gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-6 transition-shadow hover:shadow-md"
            >
              <h2 className="text-xl font-semibold text-blue-800">
                Find a Doctor
              </h2>
              <p className="text-blue-600">
                Search pediatricians accepting new patients. See who needs a referral. Get roster alerts.
              </p>
            </Link>
          </div>
        </div>
      </main>
      <MobileNav />
    </>
  );
}
