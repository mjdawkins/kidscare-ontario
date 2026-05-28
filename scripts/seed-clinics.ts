// Run with: npx tsx scripts/seed-clinics.ts
// Fetches GTA walk-in clinics from Google Places API (v1) and seeds the clinics table.

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const TORONTO_CENTER = { lat: 43.6532, lng: -79.3832 };
const FIELDS = "displayName,formattedAddress,nationalPhoneNumber,location,regularOpeningHours";

async function main() {
  console.log("Seeding GTA walk-in clinics from Google Places (API v1)...");

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_MAPS_API_KEY environment variable is required");
    process.exit(1);
  }

  // Step 1: Text search using Places API v1
  const searchBody = {
    textQuery: "walk-in clinic Toronto Ontario",
    maxResultCount: 20,
    locationBias: {
      circle: {
        center: { latitude: TORONTO_CENTER.lat, longitude: TORONTO_CENTER.lng },
        radius: 50000.0,
      },
    },
  };

  const searchResponse = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName",
      },
      body: JSON.stringify(searchBody),
    }
  );

  if (!searchResponse.ok) {
    console.error("Places API search failed:", searchResponse.status);
    process.exit(1);
  }

  const searchData = await searchResponse.json();
  const places = searchData.places ?? [];
  console.log(`Found ${places.length} potential clinics`);

  let inserted = 0;

  for (const place of places) {
    // Step 2: Place details (v1) — get hours, address, phone, location
    const detailsResponse = await fetch(
      `https://places.googleapis.com/v1/places/${place.id}`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": FIELDS,
        },
      }
    );

    if (!detailsResponse.ok) {
      console.warn(`Skipping ${place.displayName?.text ?? place.id}: details fetch failed (${detailsResponse.status})`);
      continue;
    }

    const details = await detailsResponse.json();
    const periods = details.regularOpeningHours?.periods ?? [];

    let openSaturday = false;
    let openSunday = false;
    let openAfter6pm = false;
    const hoursJson: Record<string, { open: string; close: string }> = {};

    for (const period of periods) {
      if (!period.open || !period.close) continue;

      const day = period.open.day;
      const openH = period.open.hour;
      const openM = period.open.minute ?? 0;
      const closeH = period.close.hour;
      const closeM = period.close.minute ?? 0;

      const openTime = `${String(openH).padStart(2, "0")}:${String(openM).padStart(2, "0")}`;
      const closeTime = `${String(closeH).padStart(2, "0")}:${String(closeM).padStart(2, "0")}`;

      hoursJson[day.toString()] = { open: openTime, close: closeTime };

      if (day === 6) openSaturday = true;
      if (day === 0) openSunday = true;
      if (day >= 1 && day <= 5 && closeH >= 18) openAfter6pm = true;
    }

    const lat = details.location?.latitude;
    const lng = details.location?.longitude;

    if (!lat || !lng) continue;

    const name = details.displayName?.text ?? "Unknown";
    const address = details.formattedAddress ?? "";
    const phone = details.nationalPhoneNumber ?? null;
    // sees_children defaults to false — we don't know. Manual tagging or community verification will confirm it.

    await prisma.$executeRawUnsafe(
      `INSERT INTO clinics (id, name, address, coords, phone, hours, open_saturday, open_sunday, open_after_6pm, google_place_id, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6::jsonb, $7, $8, $9, $10, now(), now())
       ON CONFLICT DO NOTHING`,
      name,
      address,
      lng,
      lat,
      phone,
      JSON.stringify(hoursJson),
      openSaturday,
      openSunday,
      openAfter6pm,
      place.id
    );

    inserted++;
    console.log(`Inserted: ${name}`);

    // Rate limit
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`Done. Total clinics inserted: ${inserted}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
