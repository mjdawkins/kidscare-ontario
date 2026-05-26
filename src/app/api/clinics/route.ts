import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { clinicSearchSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(`clinics:${ip}`, { maxRequests: 60, windowMs: 60_000 });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = clinicSearchSchema.safeParse({
    lat: searchParams.get("lat"),
    lng: searchParams.get("lng"),
    radius: searchParams.get("radius"),
    open_now: searchParams.get("open_now"),
    sees_children: searchParams.get("sees_children"),
    open_saturday: searchParams.get("open_saturday"),
    open_sunday: searchParams.get("open_sunday"),
    open_after_6pm: searchParams.get("open_after_6pm"),
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

  if (filters.open_now !== undefined) {
    const now = new Date();
    const dayOfWeek = now.getDay().toString();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    paramIndex++;
    conditions.push(
      `(hours->>'${dayOfWeek}' IS NOT NULL AND hours->'${dayOfWeek}'->>'open' <= '${timeStr}' AND hours->'${dayOfWeek}'->>'close' >= '${timeStr}')`
    );
  }

  if (filters.sees_children !== undefined) {
    paramIndex++;
    conditions.push(`sees_children = $${paramIndex}`);
    params.push(filters.sees_children);
  }

  if (filters.open_saturday !== undefined) {
    paramIndex++;
    conditions.push(`open_saturday = $${paramIndex}`);
    params.push(filters.open_saturday);
  }

  if (filters.open_sunday !== undefined) {
    paramIndex++;
    conditions.push(`open_sunday = $${paramIndex}`);
    params.push(filters.open_sunday);
  }

  if (filters.open_after_6pm !== undefined) {
    paramIndex++;
    conditions.push(`open_after_6pm = $${paramIndex}`);
    params.push(filters.open_after_6pm);
  }

  const whereClause = conditions.length > 0
    ? `AND ${conditions.join(" AND ")}`
    : "";

  // Count query
  const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM clinics
     WHERE ST_DWithin(coords::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
     ${whereClause}`,
    ...params
  );

  // Data query
  params.push(limit, offset);
  const results = await prisma.$queryRawUnsafe<
    Array<Record<string, unknown>>
  >(
    `SELECT
      id, name, address, phone,
      ST_Distance(coords::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 AS distance_km,
      hours, open_saturday, open_sunday, open_after_6pm,
      sees_children, same_day_booking_required, is_pediatric_only,
      virtual_care_available, community_flagged
    FROM clinics
    WHERE ST_DWithin(coords::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
    ${whereClause}
    ORDER BY distance_km
    LIMIT $${params.length - 1} OFFSET $${params.length}`,
    ...params
  );

  return NextResponse.json({
    results,
    total: Number(countResult[0].count),
    limit,
    offset,
  });
}
