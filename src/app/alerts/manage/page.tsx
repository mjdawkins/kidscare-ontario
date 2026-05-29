import Link from "next/link";
import { AlertForm } from "@/components/alert/AlertForm";

export default function ManageAlertPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/alerts" className="text-sm text-slate-600 hover:text-slate-700">
        &larr; Back to alerts
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Create Alert</h1>
        <p className="text-slate-700">
          We&apos;ll email you when a matching pediatrician opens their roster.
        </p>
      </div>

      <AlertForm />
    </div>
  );
}
