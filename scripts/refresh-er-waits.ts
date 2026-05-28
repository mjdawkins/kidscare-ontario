// Refresh ER wait times from multiple sources:
// 1. Halton Healthcare — 15-min live data (Milton, Georgetown, Oakville)
// 2. HQOntario — average wait times for ALL Ontario hospitals (historical)
// Run: npx tsx scripts/refresh-er-waits.ts

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { chromium } from "@playwright/test";
import * as cheerio from "cheerio";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ---- HOSPITAL COORDINATES ----
// Maps HQOntario hospital names → coordinates (add more as needed)

const COORDINATES: Record<string, { lat: number; lng: number; address: string }> = {
  "Halton Healthcare Services Corp-Milton": {
    lat: 43.4949, lng: -79.8704, address: "725 Bronte St S, Milton, ON L9T 9K1" },
  "Halton Healthcare Services Corp-Georgetown": {
    lat: 43.6458, lng: -79.9223, address: "1 Princess Anne Dr, Georgetown, ON L7G 2B8" },
  "Halton Healthcare Services Corp-Oakville": {
    lat: 43.4525, lng: -79.7389, address: "3001 Hospital Gate, Oakville, ON L6M 0L8" },
  "Trillium Health Partners-Credit Valley": {
    lat: 43.5596, lng: -79.7048, address: "2200 Eglinton Ave W, Mississauga, ON L5M 2N1" },
  "Trillium Health Partners-Mississauga": {
    lat: 43.5711, lng: -79.6391, address: "100 Queensway W, Mississauga, ON L5B 1B8" },
  "Trillium Health Partners-Queensway Hlth": {
    lat: 43.6291, lng: -79.5232, address: "150 Sherway Dr, Etobicoke, ON M9C 1A5" },
  "William Osler Health System-Civic Site": {
    lat: 43.7266, lng: -79.7491, address: "2100 Bovaird Dr E, Brampton, ON L6R 3J7" },
  "William Osler Health System-Etobicoke Site": {
    lat: 43.7149, lng: -79.5787, address: "101 Humber College Blvd, Etobicoke, ON M9V 1R8" },
  "Hamilton Health Sciences Corp-McMaster": {
    lat: 43.2609, lng: -79.9192, address: "1200 Main St W, Hamilton, ON L8N 3Z5" },
  "Hamilton Health Sciences Corp-Juravinski": {
    lat: 43.2324, lng: -79.8367, address: "711 Concession St, Hamilton, ON L8V 1C3" },
  "Hamilton Health Sciences Corp-General": {
    lat: 43.2621, lng: -79.8772, address: "237 Barton St E, Hamilton, ON L8L 2X2" },
  "Grand River Hospital Corp-Waterloo Site": {
    lat: 43.4562, lng: -80.5073, address: "835 King St W, Kitchener, ON N2G 1G3" },
  "Guelph General Hospital": {
    lat: 43.5478, lng: -80.2448, address: "115 Delhi St, Guelph, ON N1E 4J4" },
  "Cambridge Memorial Hospital": {
    lat: 43.3761, lng: -80.3182, address: "700 Coronation Blvd, Cambridge, ON N1R 3G2" },
  "St. Mary's General Hospital": {
    lat: 43.4528, lng: -80.4951, address: "911 Queen's Blvd, Kitchener, ON N2M 1B2" },
  "Lakeridge Health-Oshawa Site": {
    lat: 43.9044, lng: -78.8668, address: "1 Hospital Ct, Oshawa, ON L1G 2B9" },
  "Lakeridge Health-Ajax Site": {
    lat: 43.8519, lng: -79.0208, address: "580 Harwood Ave S, Ajax, ON L1S 2J4" },
  "Southlake Regional Health Centre": {
    lat: 44.0614, lng: -79.4663, address: "596 Davis Dr, Newmarket, ON L3Y 2P9" },
  "Joseph Brant Hospital": {
    lat: 43.3621, lng: -79.8056, address: "1245 Lakeshore Rd, Burlington, ON L7S 0A2" },
  "Niagara Health System-Greater Niagara": {
    lat: 43.1199, lng: -79.2232, address: "5546 Portage Rd, Niagara Falls, ON L2E 6X2" },
  "Niagara Health System-Welland County": {
    lat: 42.9896, lng: -79.2607, address: "65 Third St, Welland, ON L3B 4W6" },
  "Brant Community Healthcare Sys-Brantford": {
    lat: 43.1487, lng: -80.2603, address: "200 Terrace Hill St, Brantford, ON N3R 1G9" },
};

// ---- SOURCE 1: Halton Healthcare (15-min live data) ----
interface WaitTimeResult {
  hospitalName: string;
  waitMinutes: number;
  isLive: boolean;
}

async function scrapeHalton(page: any): Promise<WaitTimeResult[]> {
  const results: WaitTimeResult[] = [];

  await page.goto("https://www.haltonhealthcare.on.ca/emergency-department", {
    waitUntil: "networkidle", timeout: 20000,
  });
  await page.waitForTimeout(3000);

  const text = await page.locator("body").innerText();
  const targets = ["Milton District Hospital", "Georgetown Hospital", "Oakville Trafalgar Memorial Hospital"];

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

// ---- SOURCE 2: HQOntario (average wait times, ALL Ontario hospitals) ----
async function scrapeHQOntario(page: any): Promise<WaitTimeResult[]> {
  console.log("  Loading HQOntario page...");
  await page.goto("https://www.hqontario.ca/System-Performance/Time-Spent-in-Emergency-Departments", {
    waitUntil: "networkidle", timeout: 30000,
  });
  await page.waitForTimeout(5000);

  // The table is JavaScript-rendered. Extract by parsing the visible text.
  const text = await page.locator("body").innerText();

  // Find the table section — it starts with headers like "Hospital name" and "Average"
  const headerIdx = text.indexOf("Hospital name");
  if (headerIdx === -1) {
    console.log("  Could not find hospital table");
    return [];
  }

  // Get the section from the table to the end
  const tableText = text.slice(headerIdx);

  // Format: "Hospital name\tAverage (Hours)\nOntario\t1.8\nHospital Name\tX.X\n..."
  const lines = tableText.split("\n");
  const results: WaitTimeResult[] = [];

  for (let i = 1; i < lines.length; i++) { // skip header
    const line = lines[i].trim();
    if (!line || line.includes("Generate Graph") || line.includes("Export to CSV")) break;

    const parts = line.split("\t");
    if (parts.length < 2) continue;

    const name = parts[0].trim();
    const hours = parseFloat(parts[1]);

    if (!isNaN(hours) && hours > 0 && hours < 20 && name.length > 10 && name !== "Ontario") {
      if (COORDINATES[name]) {
        results.push({
          hospitalName: name,
          waitMinutes: Math.round(hours * 60),
          isLive: false,
        });
      }
    }
  }

  return results;
}

// ---- MAIN ----
async function main() {
  console.log(`ER Wait Times — ${new Date().toLocaleString()}\n`);

  const browser = await chromium.launch({ headless: true });
  let allResults: WaitTimeResult[] = [];

  try {
    const page = await browser.newPage();

    // Source 1: Halton live data
    console.log("Source: Halton Healthcare (live)...");
    try {
      const haltonResults = await scrapeHalton(page);
      allResults.push(...haltonResults);
      console.log(`  Got ${haltonResults.length} live wait times`);
    } catch (err) {
      console.error("  Halton failed:", err instanceof Error ? err.message : err);
    }

    // Source 2: HQOntario averages
    console.log("Source: HQOntario (averages)...");
    try {
      const hqResults = await scrapeHQOntario(page);
      allResults.push(...hqResults);
      console.log(`  Got ${hqResults.length} hospitals with average data`);
    } catch (err) {
      console.error("  HQOntario failed:", err instanceof Error ? err.message : err);
    }

    // Insert into database
    console.log(`\nInserting ${allResults.length} records...`);
    const now = new Date();

    // Clear old data
    await prisma.$executeRawUnsafe(`DELETE FROM er_wait_times`);

    for (const wt of allResults) {
      const coords = COORDINATES[wt.hospitalName] || { lat: 43.7, lng: -79.4, address: "" };

      await prisma.$executeRawUnsafe(
        `INSERT INTO er_wait_times (id, hospital_name, coords, wait_time_min, patients_in_ed, patients_waiting, urgency_level, last_updated, fetched_at)
         VALUES (gen_random_uuid(), $1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, 0, 0, $5, $6, $6)`,
        wt.hospitalName, coords.lng, coords.lat,
        wt.waitMinutes,
        wt.isLive ? "live" : "average",
        now
      );
    }

    console.log(`Done. ${allResults.length} hospitals in database.`);
    console.log(`Live: ${allResults.filter(r => r.isLive).length}, Average: ${allResults.filter(r => !r.isLive).length}`);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

main().catch(console.error);
