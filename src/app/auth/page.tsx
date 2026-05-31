import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { GoogleSignInButton } from "./GoogleSignInButton";

export default function AuthPage() {
  return (
    <>
      <Header />
      <main className="flex-1 px-4 py-8 pb-24 md:pb-8">
        <div className="mx-auto max-w-lg space-y-8">

          <div className="space-y-3">
            <h1 className="text-2xl font-semibold text-slate-900">Sign in to KidsCare</h1>
            <p className="text-slate-600 leading-relaxed">
              We use <span className="font-medium text-slate-900">Google</span> to sign you in.
              No passwords to remember, no separate account to create.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="font-medium text-slate-900 mb-2">What we access</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              We only see your <span className="font-medium text-slate-700">name</span> and{" "}
              <span className="font-medium text-slate-700">email address</span> from your
              Google account. We do not see your contacts, files, calendar, or anything else.
              We never post to your account.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="font-medium text-slate-900">What signing in gives you</h2>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 text-sm font-bold">
                  1
                </span>
                <div>
                  <p className="font-medium text-slate-900 text-sm">Verify doctor availability</p>
                  <p className="text-sm text-slate-600">
                    Confirm whether a pediatrician is actually accepting patients. Your
                    verification helps other parents find the right doctor.
                  </p>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
                  2
                </span>
                <div>
                  <p className="font-medium text-slate-900 text-sm">Roster alerts by email</p>
                  <p className="text-sm text-slate-600">
                    Subscribe to a doctor or area. We&apos;ll email you the moment a pediatrician
                    near you opens their roster.
                  </p>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-sm font-bold">
                  3
                </span>
                <div>
                  <p className="font-medium text-slate-900 text-sm">Flag outdated information</p>
                  <p className="text-sm text-slate-600">
                    Clinic hours changed? Doctor moved? Let us know so we can keep the
                    data accurate for everyone.
                  </p>
                </div>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-1">
            <h2 className="font-medium text-slate-900 text-sm">No health information stored</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              KidsCare does not store personal health information. We store your email address
              for alerts and your postal code for location-based searches. Nothing else.
            </p>
          </div>

          <div className="space-y-3 pt-4">
            <GoogleSignInButton />
            <p className="text-center text-xs text-slate-400">
              <Link href="/" className="hover:text-slate-600 underline underline-offset-2">
                No thanks, continue browsing
              </Link>
            </p>
          </div>

        </div>
      </main>
      <MobileNav />
    </>
  );
}
