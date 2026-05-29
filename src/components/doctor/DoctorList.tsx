"use client";

import { DoctorCard } from "./DoctorCard";

interface Doctor {
  id: string;
  name: string;
  doctor_type: string;
  referral_required: boolean;
  accepting_status: "accepting" | "waitlist" | "not_accepting" | "unknown";
  languages: string[];
  address: string;
  distance_km: number;
  verification: {
    verification_count: number;
    stale_days: number | null;
  };
}

interface DoctorListProps {
  doctors: Doctor[];
}

export function DoctorList({ doctors }: DoctorListProps) {
  if (doctors.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-neutral-600">No doctors found. Try expanding your search or adjusting filters.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {doctors.map((doctor) => (
        <DoctorCard key={doctor.id} doctor={doctor} />
      ))}
    </div>
  );
}
