import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { UNKNOWN_THRESHOLD_DAYS } from "@/lib/verification";

export async function POST(request: Request) {
  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};
  const now = new Date();

  // 1. Refresh ER wait times
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(
      "https://data.ontario.ca/api/3/action/datastore_search?resource_id=wait-time-information-system&limit=1000",
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      const records = data.result?.records ?? [];
      let erUpdated = 0;

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
        erUpdated++;
      }
      results.er_waits = { updated: erUpdated };
    } else {
      results.er_waits = { error: `Upstream returned ${response.status}` };
    }
  } catch (error) {
    results.er_waits = { error: String(error) };
  }

  // 2. Refresh clinic hours from Google Places
  try {
    const clinics = await prisma.clinic.findMany({
      where: { googlePlaceId: { not: null } },
      select: { id: true, googlePlaceId: true },
    });

    let clinicsUpdated = 0;
    let clinicsFailed = 0;

    for (const clinic of clinics) {
      try {
        const res = await fetch(
          `https://places.googleapis.com/v1/places/${clinic.googlePlaceId}`,
          {
            headers: {
              "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY!,
              "X-Goog-FieldMask": "regularOpeningHours",
            },
          }
        );

        if (!res.ok) { clinicsFailed++; continue; }

        const data = await res.json();
        const periods = data.regularOpeningHours?.periods ?? [];

        let openSaturday = false, openSunday = false, openAfter6pm = false;
        const hoursJson: Record<string, { open: string; close: string }> = {};

        for (const period of periods) {
          if (!period.open || !period.close) continue;
          const day = period.open.day;
          hoursJson[day.toString()] = {
            open: `${String(period.open.hour).padStart(2, "0")}:${String(period.open.minute).padStart(2, "0")}`,
            close: `${String(period.close.hour).padStart(2, "0")}:${String(period.close.minute).padStart(2, "0")}`,
          };
          if (day === 6) openSaturday = true;
          if (day === 0) openSunday = true;
          if (day >= 1 && day <= 5 && period.close.hour >= 18) openAfter6pm = true;
        }

        await prisma.clinic.update({
          where: { id: clinic.id },
          data: { hours: hoursJson, openSaturday, openSunday, openAfter6pm },
        });
        clinicsUpdated++;
      } catch {
        clinicsFailed++;
      }
    }
    results.clinics = { updated: clinicsUpdated, failed: clinicsFailed };
  } catch (error) {
    results.clinics = { error: String(error) };
  }

  // 3. Expire stale verifications
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - UNKNOWN_THRESHOLD_DAYS);

    const result = await prisma.doctor.updateMany({
      where: {
        acceptingStatus: { not: "unknown" },
        OR: [{ lastVerified: null }, { lastVerified: { lt: cutoff } }],
      },
      data: { acceptingStatus: "unknown" },
    });
    results.verifications = { reverted: result.count };
  } catch (error) {
    results.verifications = { error: String(error) };
  }

  return NextResponse.json({
    refreshed: true,
    fetched_at: now.toISOString(),
    results,
  });
}
