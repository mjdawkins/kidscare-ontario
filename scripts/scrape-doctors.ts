// CPSO Doctor Scraper — Family Doctors + Pediatricians, city-by-city, with geocoding
// Run quarterly: npx tsx scripts/scrape-doctors.ts
// Upserts doctors (ON CONFLICT on cpso_id) so safe to re-run.

import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
import { chromium } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const CITIES = [
  "Milton", "Oakville", "Burlington", "Brampton",
  "North York", "Scarborough", "Etobicoke", "Richmond Hill", "Markham",
  "Vaughan", "Pickering", "Ajax", "Whitby", "Oshawa", "Newmarket",
  "Aurora", "Halton Hills", "Guelph", "Kitchener", "Waterloo",
  "Cambridge", "Windsor", "Kingston", "St. Catharines", "Niagara Falls",
  "Sudbury", "Thunder Bay", "Barrie",
  "Mississauga", "Toronto", "Hamilton", "London", "Ottawa",
];

const POSTAL_RE = /\b[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d\b/;

// ---- Parser ----
function parseDoctors(bodyText: string) {
  const doctors: any[] = [];
  const lines = bodyText.split("\n").map((l: string) => l.trim());
  const startIdx = lines.findIndex((l: string) => l.includes("CPSO #") && l.includes("Specialities"));
  if (startIdx === -1) return [];

  const contentLines: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].includes("Refine Search")) break;
    if (lines[i].includes("Showing") && lines[i].includes("pages")) continue;
    if (lines[i].includes("Now sorting")) continue;
    if (lines[i].includes("Physician search results")) continue;
    if (lines[i] === "Page:") continue;
    if (/^\d+$/.test(lines[i]) && parseInt(lines[i]) <= 50) continue;
    if (lines[i] === "Next page") continue;
    contentLines.push(lines[i]);
  }

  let i = 0;
  while (i < contentLines.length) {
    while (i < contentLines.length && !/,/.test(contentLines[i])) i++;
    if (i >= contentLines.length) break;
    const name = contentLines[i]; i++;
    while (i < contentLines.length && !/^\d{4,6}$/.test(contentLines[i])) {
      if (/,/.test(contentLines[i])) break; i++;
    }
    if (i >= contentLines.length || !/^\d{4,6}$/.test(contentLines[i])) continue;
    const cpsoId = contentLines[i]; i++;

    let specialty = "";
    const addressParts: string[] = [];
    while (i < contentLines.length) {
      const line = contentLines[i];
      if (/^\d{4,6}$/.test(line)) break;
      if (/,/.test(line) && /^[A-Z][a-z]+,\s+[A-Z]/.test(line)) break;
      if (line === "ACTIVE" || line === "INACTIVE") { i++; break; }
      if (/^\+\d+\s+Location/.test(line)) { i++; continue; }
      if (line.startsWith("Phone:") || line.startsWith("Fax:")) { addressParts.push(line); i++; continue; }
      if (!line) { i++; continue; }
      if (!specialty && !/\d/.test(line) && !line.includes("ON ") && !line.includes("Ontario") && !line.toLowerCase().startsWith("suite") && !line.toLowerCase().startsWith("unit")) {
        specialty = line;
      } else {
        addressParts.push(line);
      }
      i++;
    }

    if (name && cpsoId) {
      doctors.push({ cpsoId, name, specialty, address: addressParts.join(", ") });
    }
  }
  return doctors;
}

// ---- Geocoding ----
function extractPostalCode(address: string): string | null {
  const match = address.match(POSTAL_RE);
  return match ? match[0].replace(/\s/g, "").toUpperCase() : null;
}

let lastNominatim = 0;
async function geocodeNominatim(postalCode: string): Promise<{lat: number; lng: number} | null> {
  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastNominatim));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastNominatim = Date.now();
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("postalcode", postalCode);
    url.searchParams.set("country", "Canada");
    url.searchParams.set("format", "json"); url.searchParams.set("limit", "1");
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "KidsCareOntario/1.0 (kidscareontario.ca)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { return null; }
}

async function geocodeAddress(address: string): Promise<{lat: number; lng: number} | null> {
  const postal = extractPostalCode(address);
  if (!postal) return null;
  const pc = await prisma.postalCode.findUnique({ where: { postalCode: postal }, select: { lat: true, lng: true } });
  if (pc) return pc;
  const fsa = postal.slice(0, 3);
  const fsaMatch = await prisma.postalCode.findFirst({ where: { postalCode: { startsWith: fsa } }, select: { lat: true, lng: true } });
  if (fsaMatch) return fsaMatch;
  const nm = await geocodeNominatim(postal);
  if (nm) {
    await prisma.postalCode.create({ data: { postalCode: postal, lat: nm.lat, lng: nm.lng } }).catch(() => {});
  }
  return nm;
}

// ---- Database ----
async function upsertDoctor(doc: any, coords: {lat: number; lng: number}, doctorType: string) {
  let referralRequired: boolean;
  let finalSpecialty: string;

  if (doctorType === "family_doctor") {
    referralRequired = false;
    finalSpecialty = doc.specialty || "Family Medicine";
  } else {
    // Pediatrician: primary vs specialist
    const isSpecialist = doc.specialty && doc.specialty.length > 0
      && doc.specialty !== "Pediatrics"
      && !doc.specialty.toLowerCase().includes("general");
    referralRequired = isSpecialist;
    finalSpecialty = doc.specialty || "Pediatrics";
    doctorType = isSpecialist ? "pediatrician_specialist" : "pediatrician_primary";
  }

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO doctors (id, cpso_id, name, specialty, doctor_type, referral_required, accepting_status, languages, address, coords, source, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4::"DoctorType", $5, 'unknown'::"AcceptingStatus", '{}'::text[], $6, ST_SetSRID(ST_MakePoint($7, $8), 4326), 'cpso', now(), now())
       ON CONFLICT (cpso_id) DO UPDATE SET
         name = EXCLUDED.name, specialty = EXCLUDED.specialty,
         doctor_type = EXCLUDED.doctor_type, address = EXCLUDED.address,
         coords = EXCLUDED.coords, updated_at = now()`,
      doc.cpsoId, doc.name, finalSpecialty,
      doctorType, referralRequired, doc.address, coords.lng, coords.lat
    );
    return true;
  } catch {
    return false;
  }
}

// ---- Search helper ----
type SearchMode = "Family Doctor" | "Specialist";

async function searchCity(
  page: any,
  city: string,
  mode: SearchMode
): Promise<{ doctors: any[]; skipped: boolean; error?: string }> {
  try {
    await page.goto("https://register.cpso.on.ca/Advanced-Search/", {
      waitUntil: "networkidle", timeout: 20000,
    });
    await page.waitForTimeout(400);

    // Select radio
    const radio = page.locator(`input[value="${mode}"]`);
    if ((await radio.count()) > 0) {
      await radio.first().click();
      await page.waitForTimeout(200);
    }

    // Specialist mode: select Pediatrics
    if (mode === "Specialist") {
      await page.locator('select#specialistType').selectOption({ label: "Pediatrics" });
    }

    // Select city
    await page.locator('select#cityDropDown').selectOption({ label: city }).catch(() => {});

    // Submit
    await page.locator("button.search-button").click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const bodyText = await page.locator("body").innerText();

    if (bodyText.includes("more than 100 results")) {
      return { doctors: [], skipped: true };
    }

    const pageMatch = bodyText.match(/Showing\s+\d+\s+of\s+(\d+)\s+pages?/);
    const totalPages = pageMatch ? parseInt(pageMatch[1]) : 1;

    const allDocs: any[] = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p > 1) {
        await page.locator(`text="${p}"`).first().click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(1500);
      }
      const text = await page.locator("body").innerText();
      for (const d of parseDoctors(text)) {
        if (!allDocs.some((x: any) => x.cpsoId === d.cpsoId)) allDocs.push(d);
      }
    }

    return { doctors: allDocs, skipped: false };
  } catch (e: any) {
    return { doctors: [], skipped: false, error: e.message?.slice(0, 80) ?? String(e) };
  }
}

// ---- Main ----
async function main() {
  console.log(`CPSO Scraper — ${new Date().toISOString().slice(0, 10)}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  let totalFound = 0;
  let totalGeocoded = 0;
  const errors: string[] = [];

  try {
    const page = await context.newPage();

    for (const city of CITIES) {
      // ---- Family Doctor pass ----
      process.stdout.write(`${city} [family]: `);
      const famResult = await searchCity(page, city, "Family Doctor");

      if (famResult.error) {
        console.log(`ERR: ${famResult.error}`);
        errors.push(`${city} family: ${famResult.error}`);
      } else if (famResult.skipped) {
        console.log(">100 skipped");
      } else {
        let found = 0;
        let geocoded = 0;
        for (const doc of famResult.doctors) {
          if (!doc.address) continue;
          const coords = await geocodeAddress(doc.address);
          if (!coords) continue;
          const ok = await upsertDoctor(doc, coords, "family_doctor");
          if (ok) geocoded++;
        }
        found = famResult.doctors.length;
        totalFound += found;
        totalGeocoded += geocoded;
        console.log(`${geocoded}/${found}`);
      }

      await new Promise(r => setTimeout(r, 800));

      // ---- Specialist (Pediatrics) pass ----
      process.stdout.write(`${city} [peds]:  `);
      const specResult = await searchCity(page, city, "Specialist");

      if (specResult.error) {
        console.log(`ERR: ${specResult.error}`);
        errors.push(`${city} peds: ${specResult.error}`);
      } else if (specResult.skipped) {
        console.log(">100 skipped");
      } else {
        let found = 0;
        let geocoded = 0;
        for (const doc of specResult.doctors) {
          if (!doc.address) continue;
          const coords = await geocodeAddress(doc.address);
          if (!coords) continue;
          // Default to pediatrician_primary — upsertDoctor refines to specialist if needed
          const ok = await upsertDoctor(doc, coords, "pediatrician_primary");
          if (ok) geocoded++;
        }
        found = specResult.doctors.length;
        totalFound += found;
        totalGeocoded += geocoded;
        console.log(`${geocoded}/${found}`);
      }

      await new Promise(r => setTimeout(r, 1200));
    }

    const dbTotal = await prisma.doctor.count();
    const byType = await prisma.$queryRawUnsafe<Array<{doctor_type: string; count: bigint}>>(
      "SELECT doctor_type, COUNT(*) as count FROM doctors GROUP BY doctor_type ORDER BY count DESC"
    );
    console.log(`\nFound: ${totalFound}, Geocoded/inserted: ${totalGeocoded}, DB total: ${dbTotal}`);
    console.log("By type:");
    for (const row of byType) {
      console.log(`  ${row.doctor_type}: ${row.count}`);
    }
    if (errors.length > 0) console.log(`Errors: ${errors.length} cities`);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

main().catch(console.error);
