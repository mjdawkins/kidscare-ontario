// Refresh ER wait times from multiple sources:
// 1. Halton Healthcare — 15-min live data
// 2. HQOntario — averages for ALL Ontario hospitals
// Coordinates are geocoded automatically via Nominatim (cached after first run).
// Run: npx tsx scripts/refresh-er-waits.ts

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { chromium } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface WaitTimeResult {
  hospitalName: string;
  waitMinutes: number;
  isLive: boolean;
  patientsInED: number;
  patientsWaiting: number;
  address?: string; // Street address for precise geocoding
}

// ---- COORDINATE CACHE ----
// Geocodes via Nominatim using street addresses (precise) or hospital names.
// Results cached in DB across runs — no hardcoded coordinates needed.

const coordCache = new Map<string, { lat: number; lng: number }>();

async function loadCoordCache() {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string; lat: number; lng: number }>>(
    `SELECT hospital_name as name, ST_Y(coords::geometry) as lat, ST_X(coords::geometry) as lng
     FROM er_wait_times WHERE ST_Y(coords::geometry) != 0`
  );
  for (const r of rows) {
    coordCache.set(r.name, { lat: r.lat, lng: r.lng });
  }
}

let lastNominatim = 0;

async function geocodeHospital(name: string, address?: string): Promise<{ lat: number; lng: number } | null> {
  if (coordCache.has(name)) return coordCache.get(name)!;

  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastNominatim));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastNominatim = Date.now();

  try {
    // Use street address when available (much more precise than hospital name)
    const query = address
      ? `${address}, Ontario, Canada`
      : name
          .replace("Corp-", "Corporation ")
          .replace("Hlth", "Health")
          .replace("Hosp", "Hospital")
          .replace("Ctr", "Centre")
          .replace("Ntwrk", "Network")
          .replace("Gen.", "General")
          .replace("Tor. East", "Toronto East")
        + " Ontario Canada";

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "KidsCareOntario/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  } catch {
    return null;
  }
}

// ---- SOURCE 1: Halton Healthcare (15-min live) ----
async function scrapeHalton(page: any): Promise<WaitTimeResult[]> {
  const results: WaitTimeResult[] = [];

  await page.goto("https://www.haltonhealthcare.on.ca/emergency-department", {
    waitUntil: "networkidle", timeout: 20000,
  });
  await page.waitForTimeout(3000);

  const text = await page.locator("body").innerText();
  const targets = [
    "Milton District Hospital",
    "Georgetown Hospital",
    "Oakville Trafalgar Memorial Hospital",
  ];

  for (const name of targets) {
    const idx = text.indexOf(name);
    if (idx === -1) continue;

    const nearby = text.slice(idx, idx + 800);

    // Parse wait time: "01 Hour(s) and 00 Minute(s)"
    const waitMatch = nearby.match(/(\d+)\s*Hour.s.\s*and\s*(\d+)\s*Minute.s./i);
    const waitMinutes = waitMatch
      ? parseInt(waitMatch[1]) * 60 + parseInt(waitMatch[2])
      : 0;

    // Parse patient counts
    const patientMatch = nearby.match(/Patients\s+in\s+Emergency\s+Department\s*(\d+)/i);
    const patientsInED = parseInt(patientMatch?.[1] ?? "0");
    const waitingMatch = nearby.match(/Patients\s+Waiting\s+to\s+be\s+seen\s*(\d+)/i);
    const patientsWaiting = parseInt(waitingMatch?.[1] ?? "0");

    // Parse street address from the page: "725 Bronte Street South ,\nMilton, ON L9T 9K1"
    const addrMatch = nearby.match(/Address\s*\/\s*Phone Number\s*\n(.+?),\s*\n(.+?)\s*\n/i);
    let address: string | undefined;
    if (addrMatch) {
      address = `${addrMatch[1].trim()}, ${addrMatch[2].trim()}`;
    }

    results.push({ hospitalName: name, waitMinutes, isLive: true, patientsInED, patientsWaiting, address });
  }

  return results;
}

// ---- SOURCE 2: HQOntario (averages, ALL Ontario hospitals) ----
async function scrapeHQOntario(page: any): Promise<WaitTimeResult[]> {
  await page.goto("https://www.hqontario.ca/System-Performance/Time-Spent-in-Emergency-Departments", {
    waitUntil: "networkidle", timeout: 30000,
  });
  await page.waitForTimeout(5000);

  const text = await page.locator("body").innerText();
  const headerIdx = text.indexOf("Hospital name");
  if (headerIdx === -1) return [];

  const tableText = text.slice(headerIdx);
  const lines = tableText.split("\n");
  const results: WaitTimeResult[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.includes("Generate Graph") || line.includes("Export to CSV")) break;

    const parts = line.split("\t");
    if (parts.length < 2) continue;

    const name = parts[0].trim();
    const hours = parseFloat(parts[1]);

    if (!isNaN(hours) && hours > 0 && hours < 20 && name.length > 10 && name !== "Ontario") {
      results.push({
        hospitalName: name,
        waitMinutes: Math.round(hours * 60),
        isLive: false,
        patientsInED: 0,
        patientsWaiting: 0,
      });
    }
  }

  return results;
}

// ---- MAIN ----
async function main() {
  console.log(`ER Wait Times — ${new Date().toLocaleString()}\n`);

  const browser = await chromium.launch({ headless: true });
  // Load cached coordinates from previous runs
  await loadCoordCache();

  let allResults: WaitTimeResult[] = [];
  let geocoded = 0;

  try {
    const page = await browser.newPage();

    // Source 1: Halton live
    console.log("Halton Healthcare (live)...");
    try {
      const halton = await scrapeHalton(page);
      allResults.push(...halton);
      console.log(`  ${halton.length} hospitals`);
    } catch (err) {
      console.error("  Failed:", err instanceof Error ? err.message : err);
    }

    // Source 2: HQOntario averages
    console.log("HQOntario (averages)...");
    try {
      const hq = await scrapeHQOntario(page);
      allResults.push(...hq);
      console.log(`  ${hq.length} hospitals`);
    } catch (err) {
      console.error("  Failed:", err instanceof Error ? err.message : err);
    }

    // Geocode and insert
    console.log(`\nGeocoding and saving ${allResults.length} hospitals...`);
    const now = new Date();

    // Merge: Halton live data takes priority over HQOntario averages
    // Map Halton short names → HQOntario long names
    const haltonMap: Record<string, string> = {
      "Milton District Hospital": "Halton Healthcare Services Corp-Milton",
      "Georgetown Hospital": "Halton Healthcare Services Corp-Georgetown",
      "Oakville Trafalgar Memorial Hospital": "Halton Healthcare Services Corp-Oakville",
    };

    const merged = new Map<string, WaitTimeResult>();
    for (const wt of allResults) {
      const key = wt.hospitalName;
      // If this is an HQO hospital that has a Halton live equivalent, skip it
      const haltonMatch = Object.entries(haltonMap).find(([, hqo]) => hqo === key);
      if (haltonMatch && allResults.some(r => r.hospitalName === haltonMatch[0])) {
        continue; // Skip HQO version — live data exists
      }
      merged.set(key, wt);
    }

    // Delete old data
    await prisma.$executeRawUnsafe(`DELETE FROM er_wait_times`);

    for (const wt of merged.values()) {
      const coords = await geocodeHospital(wt.hospitalName, wt.address);
      if (!coords) {
        // Skip hospitals we can't geocode
        continue;
      }

      await prisma.$executeRawUnsafe(
        `INSERT INTO er_wait_times (id, hospital_name, coords, wait_time_min, patients_in_ed, patients_waiting, urgency_level, last_updated, fetched_at)
         VALUES (gen_random_uuid(), $1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5, $6, $7, $8, $8)`,
        wt.hospitalName, coords.lng, coords.lat,
        wt.waitMinutes, wt.patientsInED, wt.patientsWaiting,
        wt.isLive ? "live" : "average",
        now
      );
      geocoded++;
    }

    const live = allResults.filter(r => r.isLive).length;
    const avg = allResults.filter(r => !r.isLive).length;
    console.log(`\nSaved ${geocoded} hospitals (${live} live, ${avg} average)`);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

main().catch(console.error);
