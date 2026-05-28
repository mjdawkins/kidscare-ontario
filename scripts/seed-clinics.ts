// Run with: npx tsx scripts/seed-clinics.ts
// Fetches GTA walk-in clinics from Google Places API and seeds the clinics table.

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const TORONTO_CENTER = { lat: 43.6532, lng: -79.3832 };

async function main() {
  console.log("Seeding GTA walk-in clinics from Google Places...");

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_MAPS_API_KEY environment variable is required");
    process.exit(1);
  }

  const searchUrl = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  searchUrl.searchParams.set("location", `${TORONTO_CENTER.lat},${TORONTO_CENTER.lng}`);
  searchUrl.searchParams.set("radius", "50000");
  searchUrl.searchParams.set("type", "health");
  searchUrl.searchParams.set("keyword", "walk-in clinic");
  searchUrl.searchParams.set("key", apiKey);

  const searchResponse = await fetch(searchUrl.toString());
  const searchData = await searchResponse.json();

  if (searchData.status !== "OK" && searchData.status !== "ZERO_RESULTS") {
    console.error("Places API error:", searchData.status, searchData.error_message);
    process.exit(1);
  }

  const places = searchData.results ?? [];
  console.log(`Found ${places.length} potential clinics`);

  let inserted = 0;

  for (const place of places) {
    const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    detailsUrl.searchParams.set("place_id", place.place_id);
    detailsUrl.searchParams.set("fields", "name,formatted_address,formatted_phone_number,geometry,opening_hours");
    detailsUrl.searchParams.set("key", apiKey);

    const detailsResponse = await fetch(detailsUrl.toString());
    const detailsData = await detailsResponse.json();

    if (detailsData.status !== "OK") {
      console.warn(`Skipping ${place.name}: details fetch failed (${detailsData.status})`);
      continue;
    }

    const details = detailsData.result;
    const periods = details.opening_hours?.periods ?? [];

    let openSaturday = false;
    let openSunday = false;
    let openAfter6pm = false;
    const hoursJson: Record<string, { open: string; close: string }> = {};

    for (const period of periods) {
      if (!period.open || !period.close) continue;

      const day = period.open.day;

      // Legacy Places API returns time as "0900" string, not { hour, minute }
      function parseTime(t: string): { h: number; m: number; formatted: string } {
        if (t.length >= 4) {
          const h = parseInt(t.slice(0, -2), 10);
          const m = parseInt(t.slice(-2), 10);
          return { h, m, formatted: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` };
        }
        return { h: 0, m: 0, formatted: "00:00" };
      }

      const openParsed = parseTime(period.open.time);
      const closeParsed = parseTime(period.close.time);

      hoursJson[day.toString()] = { open: openParsed.formatted, close: closeParsed.formatted };

      if (day === 6) openSaturday = true;
      if (day === 0) openSunday = true;
      if (day >= 1 && day <= 5 && closeParsed.h >= 18) openAfter6pm = true;
    }

    const lat = details.geometry?.location?.lat;
    const lng = details.geometry?.location?.lng;

    if (!lat || !lng) continue;

    await prisma.$executeRawUnsafe(
      `INSERT INTO clinics (id, name, address, coords, phone, hours, open_saturday, open_sunday, open_after_6pm, sees_children, google_place_id, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6::jsonb, $7, $8, $9, $10, $11, now(), now())
       ON CONFLICT DO NOTHING`,
      details.name ?? place.name,
      details.formatted_address ?? place.vicinity ?? "",
      lng,
      lat,
      details.formatted_phone_number ?? null,
      JSON.stringify(hoursJson),
      openSaturday,
      openSunday,
      openAfter6pm,
      true, // Walk-in clinics returned by Google Places generally see children
      place.place_id
    );

    inserted++;
    console.log(`Inserted: ${details.name ?? place.name}`);

    // Rate limit
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`Done. Total clinics inserted: ${inserted}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
