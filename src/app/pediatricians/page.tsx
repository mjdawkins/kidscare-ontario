import { Suspense } from "react";
import { SearchBar } from "@/components/layout/SearchBar";
import { DoctorList } from "@/components/doctor/DoctorList";
import { DoctorFilters } from "@/components/doctor/DoctorFilters";
import { Skeleton } from "@/components/ui/Skeleton";
import { prisma } from "@/lib/db/prisma";
import { postalCodeToCoords } from "@/lib/geo";
import { staleDays } from "@/lib/verification";

const SEARCH_RADIUS_KM = 75;

interface SearchParams {
  lat?: string;
  lng?: string;
  postal?: string;
  doctor_type?: string;
  accepting_status?: string;
  referral_required?: string;
  language?: string;
}

export default async function PediatriciansPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Find a Pediatrician</h1>
        <p className="text-neutral-800">
          Search pediatricians and family doctors near you. See who&apos;s accepting patients and whether you need a referral.
        </p>
      </div>

      <Suspense fallback={<div className="h-10" />}>
        <SearchBar basePath="/pediatricians" />
      </Suspense>
      <Suspense fallback={<div className="h-32" />}>
        <DoctorFilters />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-48" />}>
        <DoctorResults params={params} />
      </Suspense>
    </div>
  );
}

async function DoctorResults({ params }: { params: SearchParams }) {
  let lat: number | null = null;
  let lng: number | null = null;

  if (params.lat && params.lng) {
    lat = parseFloat(params.lat);
    lng = parseFloat(params.lng);
  } else if (params.postal) {
    const coords = await postalCodeToCoords(params.postal);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
  }

  if (lat === null || lng === null) {
    return (
      <p className="py-12 text-center text-neutral-700">
        Enter a postal code or use your location to find doctors near you.
      </p>
    );
  }

  const doctors = await searchDoctors(lat, lng, params);

  if (doctors.length === 0) {
    return (
      <p className="py-12 text-center text-neutral-700">
        No doctors found within {SEARCH_RADIUS_KM}km of your location.
        <br />
        <span className="text-xs">({lat.toFixed(4)}, {lng.toFixed(4)})</span>
      </p>
    );
  }

  return <DoctorList doctors={doctors} />;
}

async function searchDoctors(lat: number, lng: number, params: SearchParams) {
  const conditions: string[] = [];
  const queryParams: unknown[] = [lng, lat, SEARCH_RADIUS_KM * 1000];
  let pi = queryParams.length;

  if (params.doctor_type) {
    pi++;
    conditions.push(`doctor_type = $${pi}::"DoctorType"`);
    queryParams.push(params.doctor_type);
  }

  if (params.accepting_status) {
    pi++;
    conditions.push(`accepting_status = $${pi}::"AcceptingStatus"`);
    queryParams.push(params.accepting_status);
  }

  if (params.referral_required === "true" || params.referral_required === "false") {
    pi++;
    conditions.push(`referral_required = $${pi}`);
    queryParams.push(params.referral_required === "true");
  }

  if (params.language) {
    pi++;
    conditions.push(`$${pi} = ANY(languages)`);
    queryParams.push(params.language);
  }

  const where = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";
  const limit = 50;

  queryParams.push(limit);

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      cpso_id: string | null;
      name: string;
      specialty: string | null;
      doctor_type: string;
      referral_required: boolean;
      accepting_status: string;
      languages: string[];
      address: string;
      phone: string | null;
      website: string | null;
      distance_km: number;
      virtual_visits_available: boolean;
      age_range_min: number | null;
      age_range_max: number | null;
      last_verified: string | null;
      verification_count: number;
    }>
  >(
    `SELECT
      id, cpso_id, name, specialty, doctor_type, referral_required,
      accepting_status, languages, address, phone, website,
      ST_Distance(coords::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 AS distance_km,
      virtual_visits_available, age_range_min, age_range_max,
      last_verified, verification_count
    FROM doctors
    WHERE ST_DWithin(coords::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
    ${where}
    ORDER BY distance_km
    LIMIT $${queryParams.length}`,
    ...queryParams
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    doctor_type: r.doctor_type,
    referral_required: r.referral_required,
    accepting_status: r.accepting_status as "accepting" | "waitlist" | "not_accepting" | "unknown",
    languages: r.languages,
    address: r.address,
    distance_km: r.distance_km,
    verification: {
      verification_count: r.verification_count,
      stale_days: staleDays(r.last_verified ? new Date(r.last_verified) : null),
    },
  }));
}
