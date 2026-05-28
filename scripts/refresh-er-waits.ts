// Refresh ER wait times from hospital websites
// Run: npx tsx scripts/refresh-er-waits.ts
// Called by Vercel cron daily (or every 15 min in production w/ Pro)

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { chromium } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const HOSPITALS = {
  "Milton District Hospital": {
    lat: 43.4949, lng: -79.8704,
    address: "725 Bronte St S, Milton, ON L9T 9K1",
  },
  "Georgetown Hospital": {
    lat: 43.6458, lng: -79.9223,
    address: "1 Princess Anne Dr, Georgetown, ON L7G 2B8",
  },
  "Oakville Trafalgar Memorial Hospital": {
    lat: 43.4525, lng: -79.7389,
    address: "3001 Hospital Gate, Oakville, ON L6M 0L8",
  },
};

function parseWaitMinutes(text: string): number {
  // "01 Hour(s) and 00 Minute(s)" — Halton Healthcare format
  const halton = text.match(/(\d+)\s*Hour.s.\s*and\s*(\d+)\s*Minute.s./i);
  if (halton) return parseInt(halton[1]) * 60 + parseInt(halton[2]);
  // "1 hr 54 min"
  const hrMin = text.match(/(\d+)\s*hr\s*(\d+)\s*min/i);
  if (hrMin) return parseInt(hrMin[1]) * 60 + parseInt(hrMin[2]);
  // "53 min"
  const minOnly = text.match(/(\d+)\s*min(?:ute)?/i);
  if (minOnly) return parseInt(minOnly[1]);
  return 0;
}

async function main() {
  console.log(`ER Wait Times Refresh — ${new Date().toLocaleString()}\n`);

  const browser = await chromium.launch({ headless: true });
  let inserted = 0;

  try {
    const page = await browser.newPage();

    // Halton Healthcare
    console.log("Fetching Halton Healthcare...");
    await page.goto("https://www.haltonhealthcare.on.ca/emergency-department", {
      waitUntil: "networkidle", timeout: 20000,
    });
    await page.waitForTimeout(3000); // Wait for JS widgets to load

    const bodyText = await page.locator("body").innerText();

    for (const [name, info] of Object.entries(HOSPITALS)) {
      // Find the hospital name in the text and look for wait time nearby
      const idx = bodyText.indexOf(name);
      if (idx === -1) {
        console.log(`  ${name}: not found on page`);
        continue;
      }

      // Search nearby text for "X hr Y min" or "X min" patterns
      const nearby = bodyText.slice(idx, idx + 500);
      const waitMinutes = parseWaitMinutes(nearby);

      // Patient counts: "All Patients in Emergency Department37" / "Patients Waiting to be seen9"
      const patientMatch = nearby.match(/Patients\s+in\s+Emergency\s+Department\s*(\d+)/i)
        || nearby.match(/(\d+)\s*patients\s+in\s+ED/i);
      const waitingMatch = nearby.match(/Patients\s+Waiting\s+to\s+be\s+seen\s*(\d+)/i)
        || nearby.match(/(\d+)\s*waiting/i);

      const patients = patientMatch ? patientMatch[1] : null;
      const waiting = waitingMatch ? waitingMatch[1] : null;
      console.log(`  ${name}: ${waitMinutes} min${patients ? `, ${patients} in ED` : ""}${waiting ? `, ${waiting} waiting` : ""}`);

      const now = new Date();
      // Delete previous entries for this hospital to prevent duplicates
      await prisma.$executeRawUnsafe(
        `DELETE FROM er_wait_times WHERE hospital_name = $1`,
        name
      );
      await prisma.$executeRawUnsafe(
        `INSERT INTO er_wait_times (id, hospital_name, coords, wait_time_min, urgency_level, last_updated, fetched_at)
         VALUES (gen_random_uuid(), $1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, 'all', $5, $6)`,
        name, info.lng, info.lat, waitMinutes, now, now
      );
      inserted++;
    }

    // Clean up old records (>48 hours)
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const deleted = await prisma.erWaitTime.deleteMany({
      where: { fetchedAt: { lt: cutoff } },
    });
    if (deleted.count > 0) console.log(`\nCleaned up ${deleted.count} old records`);

    console.log(`\nInserted ${inserted} wait time records`);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

main().catch(console.error);
