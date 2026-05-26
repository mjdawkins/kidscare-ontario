import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { doctorSearchSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { isStale, staleDays } from "@/lib/verification";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(`doctors:${ip}`, { maxRequests: 60, windowMs: 60_000 });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = doctorSearchSchema.safeParse({
    lat: searchParams.get("lat"),
    lng: searchParams.get("lng"),
    radius: searchParams.get("radius"),
    doctor_type: searchParams.get("doctor_type"),
    accepting_status: searchParams.get("accepting_status"),
    referral_required: searchParams.get("referral_required"),
    language: searchParams.get("language"),
    limit: searchParams.get("limit"),
    offset: searchParams.get("offset"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { lat, lng, radius, limit, offset, ...filters } = parsed.data;

  const conditions: string[] = [];
  const params: unknown[] = [lng, lat, radius * 1000];
  let paramIndex = params.length;

  if (filters.doctor_type) {
    paramIndex++;
    conditions.push(`doctor_type = $${paramIndex}::"DoctorType"`);
    params.push(filters.doctor_type);
  }

  if (filters.accepting_status) {
    paramIndex++;
    conditions.push(`accepting_status = $${paramIndex}::"AcceptingStatus"`);
    params.push(filters.accepting_status);
  }

  if (filters.referral_required !== undefined) {
    paramIndex++;
    conditions.push(`referral_required = $${paramIndex}`);
    params.push(filters.referral_required);
  }

  if (filters.language) {
    paramIndex++;
    conditions.push(`$${paramIndex} = ANY(languages)`);
    params.push(filters.language);
  }

  const whereClause = conditions.length > 0
    ? `AND ${conditions.join(" AND ")}`
    : "";

  const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM doctors
     WHERE ST_DWithin(coords::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
     ${whereClause}`,
    ...params
  );

  params.push(limit, offset);
  const rows = await prisma.$queryRawUnsafe<
    Array<Record<string, unknown>>
  >(
    `SELECT
      id, cpso_id, name, specialty, doctor_type, referral_required,
      accepting_status, languages, address, phone, website,
      ST_Distance(coords::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 AS distance_km,
      virtual_visits_available, age_range_min, age_range_max,
      last_verified, verification_count
    FROM doctors
    WHERE ST_DWithin(coords::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
    ${whereClause}
    ORDER BY distance_km
    LIMIT $${params.length - 1} OFFSET $${params.length}`,
    ...params
  );

  const results = rows.map((r: Record<string, unknown>) => ({
    ...r,
    verification: {
      last_verified: r.last_verified,
      verification_count: r.verification_count,
      is_stale: isStale(r.last_verified as Date | null),
      stale_days: staleDays(r.last_verified as Date | null),
    },
  }));

  return NextResponse.json({
    results,
    total: Number(countResult[0].count),
    limit,
    offset,
  });
}
