import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all clinics with a Google Place ID
  const clinics = await prisma.clinic.findMany({
    where: { googlePlaceId: { not: null } },
    select: { id: true, googlePlaceId: true },
  });

  let updated = 0;
  let failed = 0;
  const FIELDS = "regularOpeningHours";

  for (const clinic of clinics) {
    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${clinic.googlePlaceId}`,
        {
          headers: {
            "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY!,
            "X-Goog-FieldMask": FIELDS,
          },
        }
      );

      if (!response.ok) {
        failed++;
        continue;
      }

      const data = await response.json();
      const periods = data.regularOpeningHours?.periods ?? [];

      let openSaturday = false;
      let openSunday = false;
      let openAfter6pm = false;

      const hoursJson: Record<string, { open: string; close: string }> = {};

      for (const period of periods) {
        if (!period.open || !period.close) continue;

        const day = period.open.day;
        const openTime = `${String(period.open.hour).padStart(2, "0")}:${String(period.open.minute).padStart(2, "0")}`;
        const closeTime = `${String(period.close.hour).padStart(2, "0")}:${String(period.close.minute).padStart(2, "0")}`;

        hoursJson[day.toString()] = { open: openTime, close: closeTime };

        if (day === 6) openSaturday = true;
        if (day === 0) openSunday = true;
        if (day >= 1 && day <= 5 && period.close.hour >= 18) openAfter6pm = true;
      }

      await prisma.clinic.update({
        where: { id: clinic.id },
        data: {
          hours: hoursJson,
          openSaturday,
          openSunday,
          openAfter6pm,
        },
      });

      updated++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    refreshed: true,
    clinics_updated: updated,
    clinics_failed: failed,
    fetched_at: new Date().toISOString(),
  });
}
