import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(
      "https://data.ontario.ca/api/3/action/datastore_search?resource_id=wait-time-information-system&limit=1000",
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Ontario data API returned ${response.status}`);
    }

    const data = await response.json();
    const records = data.result?.records ?? [];

    let updated = 0;
    const now = new Date();

    for (const record of records) {
      if (!record.hospital_name || !record.latitude || !record.longitude) continue;

      await prisma.$executeRawUnsafe(
        `INSERT INTO er_wait_times (hospital_name, coords, wait_time_min, urgency_level, last_updated, fetched_at)
         VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        record.hospital_name,
        parseFloat(record.longitude),
        parseFloat(record.latitude),
        parseInt(record.wait_time_minutes) || 0,
        record.urgency_level ?? "unknown",
        record.last_updated ? new Date(record.last_updated) : now,
        now
      );
      updated++;
    }

    return NextResponse.json({
      refreshed: true,
      hospitals_updated: updated,
      fetched_at: now.toISOString(),
    });
  } catch (error) {
    console.error("ER wait refresh failed:", error);
    return NextResponse.json(
      { error: "Upstream source unavailable", details: String(error) },
      { status: 502 }
    );
  }
}
