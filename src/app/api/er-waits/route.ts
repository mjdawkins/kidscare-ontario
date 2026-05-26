import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(`er-waits:${ip}`, { maxRequests: 60, windowMs: 60_000 });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": "60",
          "X-RateLimit-Remaining": String(rl.remaining),
          "X-RateLimit-Reset": String(rl.resetAt),
        },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const radius = Math.min(parseInt(searchParams.get("radius") ?? "20"), 50);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10"), 20);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json(
      { error: "Invalid coordinates. Provide lat and lng query parameters." },
      { status: 400 }
    );
  }

  const results = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      hospital_name: string;
      distance_km: number;
      wait_time_min: number;
      urgency_level: string;
      last_updated: string;
      fetched_at: string;
    }>
  >(
    `SELECT
      id,
      hospital_name,
      ST_Distance(coords::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 AS distance_km,
      wait_time_min,
      urgency_level,
      last_updated,
      fetched_at
    FROM er_wait_times
    WHERE ST_DWithin(coords::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)
    ORDER BY distance_km
    LIMIT $4`,
    lng,
    lat,
    radius,
    limit
  );

  const now = new Date();
  const staleThreshold = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour

  return NextResponse.json({
    results: results.map((r) => ({
      ...r,
      is_stale: new Date(r.last_updated) < staleThreshold,
    })),
    data_source: "Ontario Wait Time Information System",
    data_source_url:
      "https://data.ontario.ca/dataset/wait-time-information-system",
    fetched_at: now.toISOString(),
  });
}
