// Refresh ER wait times from hospital websites
// Run: npx tsx scripts/refresh-er-waits.ts
// Add new hospitals by adding entries to the HOSPITALS array below
// and creating a scraper function for their hospital network.

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { chromium } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ---- HOSPITAL REGISTRY ----
// Add new hospitals here. Each needs: name, coords, address, and a network name.
// Then add a scraper function for that network below.

interface Hospital {
  name: string;
  lat: number;
  lng: number;
  address: string;
  network: string; // Links to a scraper function
}

const HOSPITALS: Hospital[] = [
  // Halton Healthcare — scraped from haltonhealthcare.on.ca/emergency-department
  { name: "Milton District Hospital", lat: 43.4949, lng: -79.8704, address: "725 Bronte St S, Milton, ON L9T 9K1", network: "halton" },
  { name: "Georgetown Hospital", lat: 43.6458, lng: -79.9223, address: "1 Princess Anne Dr, Georgetown, ON L7G 2B8", network: "halton" },
  { name: "Oakville Trafalgar Memorial Hospital", lat: 43.4525, lng: -79.7389, address: "3001 Hospital Gate, Oakville, ON L6M 0L8", network: "halton" },
  // Add more hospitals here...
  // { name: "Credit Valley Hospital", lat: 43.5596, lng: -79.7048, address: "...", network: "trillium" },
  // { name: "Brampton Civic Hospital", lat: 43.7266, lng: -79.7491, address: "...", network: "william-osler" },
];

// ---- SCRAPER FUNCTIONS ----
// Each network gets its own function that returns { name: waitMinutes } for its hospitals.

interface WaitTimeResult {
  hospitalName: string;
  waitMinutes: number;
  patientsInED: number;
  patientsWaiting: number;
}

async function scrapeHalton(page: any): Promise<WaitTimeResult[]> {
  const results: WaitTimeResult[] = [];

  await page.goto("https://www.haltonhealthcare.on.ca/emergency-department", {
    waitUntil: "networkidle", timeout: 20000,
  });
  await page.waitForTimeout(3000);

  const text = await page.locator("body").innerText();
  const haltonHospitals = HOSPITALS.filter(h => h.network === "halton");

  for (const hospital of haltonHospitals) {
    const idx = text.indexOf(hospital.name);
    if (idx === -1) continue;

    const nearby = text.slice(idx, idx + 500);

    // Halton format: "01 Hour(s) and 00 Minute(s)"
    const waitMatch = nearby.match(/(\d+)\s*Hour.s.\s*and\s*(\d+)\s*Minute.s./i);
    const waitMinutes = waitMatch
      ? parseInt(waitMatch[1]) * 60 + parseInt(waitMatch[2])
      : 0;

    // "All Patients in Emergency Department37"
    const patientMatch = nearby.match(/Patients\s+in\s+Emergency\s+Department\s*(\d+)/i);
    const patientsInED = parseInt(patientMatch?.[1] ?? "0");

    // "Patients Waiting to be seen9"
    const waitingMatch = nearby.match(/Patients\s+Waiting\s+to\s+be\s+seen\s*(\d+)/i);
    const patientsWaiting = parseInt(waitingMatch?.[1] ?? "0");

    results.push({
      hospitalName: hospital.name,
      waitMinutes,
      patientsInED,
      patientsWaiting,
    });
  }

  return results;
}

// Add more scraper functions here:
//
// async function scrapeTrillium(page: any): Promise<WaitTimeResult[]> { ... }
// async function scrapeWilliamOsler(page: any): Promise<WaitTimeResult[]> { ... }

// ---- NETWORK REGISTRY ----
// Maps network name → scraper function. Add new scrapers here.

const SCRAPERS: Record<string, (page: any) => Promise<WaitTimeResult[]>> = {
  halton: scrapeHalton,
  // trillium: scrapeTrillium,
  // "william-osler": scrapeWilliamOsler,
};

// ---- MAIN ----
async function main() {
  console.log(`ER Wait Times — ${new Date().toLocaleString()}\n`);

  // Get unique networks that have registered scrapers
  const networks = [...new Set(HOSPITALS.map(h => h.network).filter(n => SCRAPERS[n]))];

  if (networks.length === 0) {
    console.log("No hospital networks configured with scrapers.");
    await prisma.$disconnect();
    return;
  }

  const browser = await chromium.launch({ headless: true });
  let totalInserted = 0;

  try {
    const page = await browser.newPage();

    for (const network of networks) {
      console.log(`Fetching ${network}...`);
      try {
        const scraper = SCRAPERS[network];
        const results = await scraper(page);

        for (const wt of results) {
          const hospital = HOSPITALS.find(h => h.name === wt.hospitalName);
          if (!hospital) continue;

          const patientsInED = wt.patientsInED || 0;
          const patientsWaiting = wt.patientsWaiting || 0;

          console.log(`  ${wt.hospitalName}: ${wt.waitMinutes} min, ${patientsInED} in ED, ${patientsWaiting} waiting`);

          // Delete previous entry for this hospital (deduplicate)
          await prisma.$executeRawUnsafe(
            `DELETE FROM er_wait_times WHERE hospital_name = $1`,
            wt.hospitalName
          );

          const now = new Date();
          await prisma.$executeRawUnsafe(
            `INSERT INTO er_wait_times (id, hospital_name, coords, wait_time_min, patients_in_ed, patients_waiting, urgency_level, last_updated, fetched_at)
             VALUES (gen_random_uuid(), $1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5, $6, 'all', $7, $7)`,
            wt.hospitalName, hospital.lng, hospital.lat,
            wt.waitMinutes, patientsInED, patientsWaiting, now
          );
          totalInserted++;
        }
      } catch (err) {
        console.error(`  ${network} failed:`, err instanceof Error ? err.message : err);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  } finally {
    await browser.close();

    // Clean up old records (>48 hours)
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const deleted = await prisma.erWaitTime.deleteMany({
      where: { fetchedAt: { lt: cutoff } },
    });
    if (deleted.count > 0) console.log(`\nCleaned ${deleted.count} old records`);

    console.log(`\nInserted ${totalInserted} wait time records`);
    await prisma.$disconnect();
  }
}

main().catch(console.error);
