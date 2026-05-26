import { Suspense } from "react";
import { SearchBar } from "@/components/layout/SearchBar";
import { DoctorList } from "@/components/doctor/DoctorList";
import { DoctorFilters } from "@/components/doctor/DoctorFilters";
import { Skeleton } from "@/components/ui/Skeleton";

export default function PediatriciansPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Find a Pediatrician</h1>
        <p className="text-zinc-600">
          Search pediatricians and family doctors near you. See who&apos;s accepting patients and whether you need a referral.
        </p>
      </div>

      <SearchBar basePath="/pediatricians" />
      <DoctorFilters />

      <Suspense fallback={<Skeleton className="h-48" />}>
        <DoctorResults />
      </Suspense>
    </div>
  );
}

async function DoctorResults() {
  return (
    <DoctorList doctors={[]} />
  );
}
