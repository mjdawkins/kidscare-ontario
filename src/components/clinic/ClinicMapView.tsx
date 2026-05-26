"use client";

interface ClinicMapViewProps {
  clinics: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
  }>;
}

export function ClinicMapView({ clinics }: ClinicMapViewProps) {
  return (
    <div className="flex h-64 items-center justify-center rounded-xl bg-zinc-100 md:h-full">
      <p className="text-sm text-zinc-500">
        Map view — {clinics.length} clinics loaded
      </p>
    </div>
  );
}
