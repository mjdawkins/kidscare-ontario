import { Suspense } from "react";
import { SearchBar } from "@/components/layout/SearchBar";
import { ClinicList } from "@/components/clinic/ClinicList";
import { ClinicFilters } from "@/components/clinic/ClinicFilters";
import { Skeleton } from "@/components/ui/Skeleton";

export default function UrgentPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Urgent Care</h1>
        <p className="text-zinc-600">Find walk-in clinics, ER wait times, and virtual care near you.</p>
      </div>

      <Suspense fallback={<div className="h-10" />}>
        <SearchBar basePath="/urgent" />
      </Suspense>
      <Suspense fallback={<div className="h-8" />}>
        <ClinicFilters />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-48" />}>
        <ClinicResults />
      </Suspense>
    </div>
  );
}

async function ClinicResults() {
  return (
    <ClinicList clinics={[]} />
  );
}
