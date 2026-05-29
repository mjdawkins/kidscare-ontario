import Link from "next/link";
import { notFound } from "next/navigation";
import { DoctorProfile } from "@/components/doctor/DoctorProfile";
import { VerifyForm } from "@/components/doctor/VerifyForm";
import { SubscribeButton } from "@/components/doctor/SubscribeButton";
import { prisma } from "@/lib/db/prisma";
import { isStale, staleDays } from "@/lib/verification";
import { createClient } from "@/lib/supabase/server";

export default async function DoctorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const doctor = await prisma.doctor.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      specialty: true,
      doctorType: true,
      referralRequired: true,
      acceptingStatus: true,
      languages: true,
      address: true,
      phone: true,
      website: true,
      virtualVisitsAvailable: true,
      lastVerified: true,
      verificationCount: true,
    },
  });

  if (!doctor) notFound();

  // Check auth for verification
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get recent verifications (anonymized)
  const recentVerifications = await prisma.verification.findMany({
    where: { doctorId: id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      reportedStatus: true,
      howConfirmed: true,
      notes: true,
      createdAt: true,
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/pediatricians" className="text-sm text-zinc-600 hover:text-zinc-700">
        &larr; Back to search
      </Link>

      <DoctorProfile
        doctor={{
          name: doctor.name,
          specialty: doctor.specialty,
          doctor_type: doctor.doctorType,
          referral_required: doctor.referralRequired,
          accepting_status: doctor.acceptingStatus as "accepting" | "waitlist" | "not_accepting" | "unknown",
          languages: doctor.languages,
          address: doctor.address ?? "",
          phone: doctor.phone,
          website: doctor.website,
          virtual_visits_available: doctor.virtualVisitsAvailable,
          verification: {
            verification_count: doctor.verificationCount,
            stale_days: staleDays(doctor.lastVerified),
            last_verified: doctor.lastVerified?.toISOString() ?? null,
          },
        }}
      />

      <div className="rounded-xl border border-zinc-200 p-4">
        {user ? (
          <VerifyForm doctorId={id} />
        ) : (
          <p className="text-sm text-zinc-600 text-center">
            Sign in to confirm whether this doctor is accepting patients.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 p-4">
        <SubscribeButton doctorId={id} doctorName={doctor.name} />
      </div>

      {recentVerifications.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-zinc-900">Recent Verifications</h3>
          {recentVerifications.map((v, i) => (
            <div key={i} className="text-sm text-zinc-600 flex items-center gap-2">
              <span>
                {v.reportedStatus === "accepting" ? "✓" : v.reportedStatus === "waitlist" ? "~" : "✗"}{" "}
                {v.reportedStatus.replace("_", " ")}
              </span>
              <span className="text-zinc-500">·</span>
              <span className="text-zinc-500">
                {v.howConfirmed.replace(/_/g, " ")}
              </span>
              {v.notes && (
                <>
                  <span className="text-zinc-500">·</span>
                  <span className="italic">"{v.notes}"</span>
                </>
              )}
              <span className="text-zinc-500 ml-auto text-xs">
                {new Date(v.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
