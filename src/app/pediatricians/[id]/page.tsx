import Link from "next/link";
import { DoctorProfile } from "@/components/doctor/DoctorProfile";
import { VerifyForm } from "@/components/doctor/VerifyForm";

export default async function DoctorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/pediatricians" className="text-sm text-zinc-500 hover:text-zinc-700">
        &larr; Back to search
      </Link>

      <DoctorProfile
        doctor={{
          name: "Loading...",
          specialty: null,
          doctor_type: "pediatrician_primary",
          referral_required: false,
          accepting_status: "unknown",
          languages: [],
          address: "",
          phone: null,
          website: null,
          virtual_visits_available: false,
          verification: {
            verification_count: 0,
            stale_days: null,
            last_verified: null,
          },
        }}
      />

      <VerifyForm doctorId={id} />
    </div>
  );
}
