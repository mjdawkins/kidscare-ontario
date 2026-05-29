"use client";

import { ClinicCard } from "./ClinicCard";

interface Clinic {
  id: string;
  name: string;
  address: string;
  distance_km: number;
  phone: string | null;
  hours: Record<string, { open: string; close: string }> | null;
  sees_children: boolean;
  open_saturday: boolean;
  open_sunday: boolean;
  open_after_6pm: boolean;
}

interface ClinicListProps {
  clinics: Clinic[];
}

export function ClinicList({ clinics }: ClinicListProps) {
  if (clinics.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500">No clinics found. Try expanding your search radius.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {clinics.map((clinic) => (
        <ClinicCard key={clinic.id} clinic={clinic} />
      ))}
    </div>
  );
}
