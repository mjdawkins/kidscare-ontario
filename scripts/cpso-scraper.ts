// CPSO Pediatrician Scraper
// Searches city-by-city to stay under CPSO's 100-result limit.
// Run: npx tsx scripts/cpso-scraper.ts
// Schedule: quarterly via cron

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { chromium } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const SEARCH_URL = "https://register.cpso.on.ca/Advanced-Search/";
const DELAY_MS = 1500;

const CITIES = [
  "Milton", "Oakville", "Burlington", "Brampton", "Mississauga",
  "North York", "Scarborough", "Etobicoke", "Richmond Hill", "Markham",
  "Vaughan", "Pickering", "Ajax", "Whitby", "Oshawa", "Newmarket",
  "Aurora", "Halton Hills", "Guelph", "Kitchener", "Waterloo",
  "Cambridge", "Windsor", "Kingston", "St. Catharines", "Niagara Falls",
  "Sudbury", "Thunder Bay", "Barrie", "Toronto", "Hamilton", "London", "Ottawa",
];

interface CPSODoctor {
  cpsoId: string;
  name: string;
  specialty: string;
  address: string;
}

function parseDoctors(bodyText: string): CPSODoctor[] {
  const doctors: CPSODoctor[] = [];

  // The page shows doctors in a tabular format.
  // Each doctor entry: Name, then CPSO#, then Specialty, then Address lines, then status.
  // Lines after the header up to the pagination/refine-search section contain doctor data.

  const lines = bodyText.split("\n").map((l) => l.trim());
  const startIdx = lines.findIndex((l) => l.includes("CPSO #") && l.includes("Specialities"));
  if (startIdx === -1) return [];

  // Collect all content lines between header and pagination
  const contentLines: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].includes("Refine Search")) break;
    if (lines[i].includes("Showing") && lines[i].includes("pages")) continue;
    if (lines[i].includes("Now sorting")) continue;
    if (lines[i].includes("Physician search results")) continue;
    if (lines[i] === "Page:") continue;
    if (/^\d+$/.test(lines[i]) && parseInt(lines[i]) <= 50) continue; // page numbers
    if (lines[i] === "Next page") continue;
    contentLines.push(lines[i]);
  }

  // Parse doctors from content lines
  // Pattern: Name line (has comma), CPSO# (digits only), specialty, address lines, status
  let i = 0;
  while (i < contentLines.length) {
    // Find a name line (format: "Lastname, Firstname ...")
    while (i < contentLines.length && !/,/.test(contentLines[i])) i++;
    if (i >= contentLines.length) break;

    const name = contentLines[i];
    i++;

    // Skip empty lines, find CPSO number
    while (i < contentLines.length && !/^\d{4,6}$/.test(contentLines[i])) {
      // If we hit another name line, the previous entry had no CPSO — skip it
      if (/,/.test(contentLines[i])) break;
      i++;
    }
    if (i >= contentLines.length) break;
    if (!/^\d{4,6}$/.test(contentLines[i])) continue;
    const cpsoId = contentLines[i];
    i++;

    // Specialty line(s) — starts with a specialty keyword, not a number, not an address
    let specialty = "";
    while (i < contentLines.length) {
      const line = contentLines[i];
      if (/^\d{4,6}$/.test(line)) break; // next CPSO
      if (/,/.test(line) && /^[A-Z][a-z]+,\s+[A-Z]/.test(line)) break; // next name
      if (line === "ACTIVE" || line === "INACTIVE") break;
      if (/^\+\d+\s+Location/.test(line)) { i++; continue; }
      // Phone/Fax lines
      if (line.startsWith("Phone:") || line.startsWith("Fax:")) { i++; continue; }
      if (!specialty && line.length > 2) {
        specialty = line;
      }
      i++;
    }

    // Address lines
    const addressParts: string[] = [];
    while (i < contentLines.length) {
      const line = contentLines[i];
      if (/^\d{4,6}$/.test(line)) break; // next CPSO
      if (/,/.test(line) && /^[A-Z][a-z]+,\s+[A-Z]/.test(line)) break; // next name
      if (line === "ACTIVE" || line === "INACTIVE") { i++; break; }
      if (/^\+\d+\s+Location/.test(line)) { i++; continue; }
      if (line.startsWith("Phone:") || line.startsWith("Fax:")) {
        addressParts.push(line);
        i++;
        continue;
      }
      if (!line) { i++; continue; }
      addressParts.push(line);
      i++;
    }
    const address = addressParts.join(", ");

    if (name && cpsoId) {
      doctors.push({ cpsoId, name, specialty: specialty || "Pediatrics", address });
    }
  }

  return doctors;
}

async function scrapeCity(page: any, city: string): Promise<CPSODoctor[]> {
  const allDoctors: CPSODoctor[] = [];

  await page.goto(SEARCH_URL, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(800);

  // Select Specialist → Pediatrics
  const specialistRadio = page.locator('input[value="Specialist"]');
  if (await specialistRadio.count() > 0) {
    await specialistRadio.first().click();
    await page.waitForTimeout(300);
  }
  await page.locator('select#specialistType').waitFor({ state: "visible", timeout: 5000 });
  await page.locator('select#specialistType').selectOption({ label: "Pediatrics" });

  const citySelect = page.locator('select#cityDropDown');
  if (await citySelect.count() === 0) return [];
  const cityOption = citySelect.locator(`option[label="${city}"]`);
  if (await cityOption.count() === 0) return [];
  await citySelect.selectOption({ label: city });

  try {
    await page.locator("button.search-button").click({ timeout: 10000 });
  } catch {
    return [];
  }

  await page.waitForTimeout(5000);

  const bodyText = await page.locator("body").innerText();
  if (bodyText.includes("more than 100 results")) return [];

  // Check total pages
  const pageMatch = bodyText.match(/Showing\s+\d+\s+of\s+(\d+)\s+pages?/);
  const totalPages = pageMatch ? parseInt(pageMatch[1]) : 1;

  // Parse page 1
  let currentText = await page.locator("body").innerText();
  let doctors = parseDoctors(currentText);
  allDoctors.push(...doctors);

  // Navigate remaining pages
  for (let p = 2; p <= totalPages; p++) {
    const pageBtn = page.locator(`text="${p}"`).first();

    // Also try clicking "Next page"
    let clicked = false;
    try {
      if (p === totalPages && (await page.locator('text="Next page"').count() > 0)) {
        await page.locator('text="Next page"').first().click();
        clicked = true;
      }
    } catch {}

    if (!clicked) {
      try {
        if (await pageBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await pageBtn.click();
          clicked = true;
        }
      } catch {}
    }

    if (!clicked) break;

    await page.waitForTimeout(2500);
    currentText = await page.locator("body").innerText();

    doctors = parseDoctors(currentText);
    for (const doc of doctors) {
      if (!allDoctors.some((d) => d.cpsoId === doc.cpsoId)) {
        allDoctors.push(doc);
      }
    }
  }

  return allDoctors;
}

function classifyDoctor(specialty: string): {
  doctorType: "pediatrician_primary" | "pediatrician_specialist";
  referralRequired: boolean;
} {
  const s = specialty.toLowerCase();
  const specialistKw = [
    "neonatal", "cardiology", "endocrinology", "gastroenterology",
    "neurology", "oncology", "nephrology", "respiratory", "rheumatology",
    "developmental", "emergency", "intensive care", "allergy",
    "immunology", "hematology", "infectious", "genetics",
    "adolescent", "clinical pharmacology", "sports medicine",
    "respirology", "surgery", "radiology", "critical care",
    "neonatal-perinatal", "perinatal",
  ];
  for (const kw of specialistKw) {
    if (s.includes(kw)) return { doctorType: "pediatrician_specialist", referralRequired: true };
  }
  return { doctorType: "pediatrician_primary", referralRequired: false };
}

async function main() {
  console.log("CPSO Pediatrician Scraper\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  let grandTotal = 0;

  try {
    const page = await context.newPage();

    for (const city of CITIES) {
      process.stdout.write(`${city}: `);
      const doctors = await scrapeCity(page, city);
      console.log(`${doctors.length}`);

      for (const doc of doctors) {
        const { doctorType, referralRequired } = classifyDoctor(doc.specialty);

        await prisma.$executeRawUnsafe(
          `INSERT INTO doctors (id, cpso_id, name, specialty, doctor_type, referral_required, accepting_status, languages, address, coords, source, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4::"DoctorType", $5, 'unknown'::"AcceptingStatus", '{}'::text[], $6, ST_SetSRID(ST_MakePoint(0, 0), 4326), 'cpso', now(), now())
           ON CONFLICT (cpso_id) DO UPDATE SET
             name = EXCLUDED.name, specialty = EXCLUDED.specialty,
             doctor_type = EXCLUDED.doctor_type, referral_required = EXCLUDED.referral_required,
             address = EXCLUDED.address, updated_at = now()`,
          doc.cpsoId, doc.name, doc.specialty || "Pediatrics",
          doctorType, referralRequired, doc.address || null
        );
      }

      grandTotal += doctors.length;
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    console.log(`\nTotal: ${grandTotal} pediatricians scraped`);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

main().catch(console.error);
