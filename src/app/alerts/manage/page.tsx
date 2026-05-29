import Link from "next/link";
import { AlertForm } from "@/components/alert/AlertForm";

export default function ManageAlertPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/alerts" className="text-sm text-gray-700 hover:text-gray-800">
        &larr; Back to alerts
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-black">Create Alert</h1>
        <p className="text-gray-800">
          We&apos;ll email you when a matching pediatrician opens their roster.
        </p>
      </div>

      <AlertForm />
    </div>
  );
}
