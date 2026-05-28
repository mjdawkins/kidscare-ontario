import { Suspense } from "react";
import { SearchBar } from "@/components/layout/SearchBar";
import { ClinicList } from "@/components/clinic/ClinicList";
import { ClinicFilters } from "@/components/clinic/ClinicFilters";
import { Skeleton } from "@/components/ui/Skeleton";
import { prisma } from "@/lib/db/prisma";
import { postalCodeToCoords } from "@/lib/geo";

const SEARCH_RADIUS_KM = 75;

interface SearchParams {
  lat?: string;
  lng?: string;
  postal?: string;
  open_now?: string;
  sees_children?: string;
  open_saturday?: string;
  open_sunday?: string;
  open_after_6pm?: string;
}

export default async function UrgentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

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
        <ClinicResults params={params} />
      </Suspense>
    </div>
  );
}

async function ClinicResults({ params }: { params: SearchParams }) {
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
      <p className="py-12 text-center text-zinc-500">
        Enter a postal code or use your location to find clinics near you.
      </p>
    );
  }

  const clinics = await searchClinics(lat, lng, params);

  if (clinics.length === 0) {
    return (
      <p className="py-12 text-center text-zinc-500">
        No clinics found within {SEARCH_RADIUS_KM}km of your location.
        <br />
        <span className="text-xs">({lat.toFixed(4)}, {lng.toFixed(4)})</span>
      </p>
    );
  }

  return <ClinicList clinics={clinics} />;
}

async function searchClinics(lat: number, lng: number, params: SearchParams) {
  const conditions: string[] = [];
  const queryParams: unknown[] = [lng, lat, SEARCH_RADIUS_KM * 1000];
  let pi = queryParams.length;

  if (params.open_now === "true") {
    const now = new Date();
    const dayOfWeek = now.getDay().toString();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    conditions.push(
      `(hours->>'${dayOfWeek}' IS NOT NULL AND hours->'${dayOfWeek}'->>'open' <= '${timeStr}' AND hours->'${dayOfWeek}'->>'close' >= '${timeStr}')`
    );
  }

  const boolFilters: Array<[string | undefined, string]> = [
    [params.sees_children, "sees_children"],
    [params.open_saturday, "open_saturday"],
    [params.open_sunday, "open_sunday"],
    [params.open_after_6pm, "open_after_6pm"],
  ];

  for (const [value, col] of boolFilters) {
    if (value === "true") {
      pi++;
      conditions.push(`${col} = $${pi}`);
      queryParams.push(true);
    }
  }

  const where = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";
  const limit = 50;

  queryParams.push(limit);

  const results = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      name: string;
      address: string;
      distance_km: number;
      phone: string | null;
      hours: unknown;
      open_saturday: boolean;
      open_sunday: boolean;
      open_after_6pm: boolean;
      sees_children: boolean;
      same_day_booking_required: boolean;
      is_pediatric_only: boolean;
      virtual_care_available: boolean;
      community_flagged: boolean;
    }>
  >(
    `SELECT
      id, name, address, phone,
      ST_Distance(coords::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 AS distance_km,
      hours, open_saturday, open_sunday, open_after_6pm,
      sees_children, same_day_booking_required, is_pediatric_only,
      virtual_care_available, community_flagged
    FROM clinics
    WHERE ST_DWithin(coords::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
    ${where}
    ORDER BY distance_km
    LIMIT $${queryParams.length}`,
    ...queryParams
  );

  const now = new Date();
  const today = now.getDay().toString();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  return results.map((r) => {
    const hours = r.hours as Record<string, { open: string; close: string }> | null;
    let isOpen = false;
    if (hours?.[today]) {
      isOpen = hours[today].open <= currentTime && hours[today].close >= currentTime;
    }
    return {
      id: r.id,
      name: r.name,
      address: r.address,
      distance_km: r.distance_km,
      phone: r.phone,
      hours,
      sees_children: r.sees_children,
      open_saturday: r.open_saturday,
      open_sunday: r.open_sunday,
      open_after_6pm: r.open_after_6pm,
      is_open_now: isOpen,
    };
  });
}
