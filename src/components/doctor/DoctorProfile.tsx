"use client";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReferralBadge } from "@/components/shared/ReferralBadge";
import { VerificationBadge } from "@/components/shared/VerificationBadge";
import { StalenessWarning } from "@/components/shared/StalenessWarning";

interface DoctorProfileProps {
  doctor: {
    name: string;
    specialty: string | null;
    doctor_type: string;
    referral_required: boolean;
    accepting_status: "accepting" | "waitlist" | "not_accepting" | "unknown";
    languages: string[];
    address: string;
    phone: string | null;
    website: string | null;
    virtual_visits_available: boolean;
    verification: {
      verification_count: number;
      stale_days: number | null;
      last_verified: string | null;
    };
  };
}

export function DoctorProfile({ doctor }: DoctorProfileProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{doctor.name}</h1>
        {doctor.specialty && (
          <p className="text-zinc-600">{doctor.specialty}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusBadge status={doctor.accepting_status} />
        <ReferralBadge required={doctor.referral_required} />
      </div>

      <VerificationBadge
        verificationCount={doctor.verification.verification_count}
        staleDays={doctor.verification.stale_days}
      />
      <StalenessWarning
        staleDays={doctor.verification.stale_days}
        lastVerified={doctor.verification.last_verified}
      />

      <div className="space-y-2 text-sm text-zinc-600">
        <p>{doctor.address}</p>
        {doctor.phone && <p>Phone: {doctor.phone}</p>}
        {doctor.website && (
          <a href={doctor.website} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
            Website
          </a>
        )}
        {doctor.languages.length > 0 && (
          <p>Languages: {doctor.languages.join(", ")}</p>
        )}
        {doctor.virtual_visits_available && (
          <p className="text-green-600">Virtual visits available</p>
        )}
      </div>
    </div>
  );
}
