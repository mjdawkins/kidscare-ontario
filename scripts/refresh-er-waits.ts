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
}

// ---- COORDINATE CACHE ----
// Geocodes hospital names via Nominatim. Results cached in memory for this run
// and stored in DB for future runs (coordinates survive table deletion).

const coordCache = new Map<string, { lat: number; lng: number }>();

// Pre-load existing coordinates from DB before deleting old data
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

async function geocodeHospital(name: string): Promise<{ lat: number; lng: number } | null> {
  // Check cache first
  if (coordCache.has(name)) return coordCache.get(name)!;

  // Geocode via Nominatim
  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastNominatim));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastNominatim = Date.now();

  try {
    const query = name
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

    const nearby = text.slice(idx, idx + 500);
    const waitMatch = nearby.match(/(\d+)\s*Hour.s.\s*and\s*(\d+)\s*Minute.s./i);
    const waitMinutes = waitMatch
      ? parseInt(waitMatch[1]) * 60 + parseInt(waitMatch[2])
      : 0;

    results.push({ hospitalName: name, waitMinutes, isLive: true });
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

    // Delete old data
    await prisma.$executeRawUnsafe(`DELETE FROM er_wait_times`);

    for (const wt of allResults) {
      const coords = await geocodeHospital(wt.hospitalName);
      if (!coords) {
        // Skip hospitals we can't geocode
        continue;
      }

      await prisma.$executeRawUnsafe(
        `INSERT INTO er_wait_times (id, hospital_name, coords, wait_time_min, patients_in_ed, patients_waiting, urgency_level, last_updated, fetched_at)
         VALUES (gen_random_uuid(), $1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, 0, 0, $5, $6, $6)`,
        wt.hospitalName, coords.lng, coords.lat,
        wt.waitMinutes,
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
