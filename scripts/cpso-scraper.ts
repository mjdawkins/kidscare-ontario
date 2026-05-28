// CPSO Pediatrician Scraper — city-by-city
// Run: npx tsx scripts/cpso-scraper.ts

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
    while (i < contentLines.length) {
      const line = contentLines[i];
      if (/^\d{4,6}$/.test(line)) break;
      if (/,/.test(line) && /^[A-Z][a-z]+,\s+[A-Z]/.test(line)) break;
      if (line === "ACTIVE" || line === "INACTIVE") break;
      if (/^\+\d+\s+Location/.test(line)) { i++; continue; }
      if (line.startsWith("Phone:") || line.startsWith("Fax:")) { i++; continue; }
      if (!specialty && line.length > 2) specialty = line;
      i++;
    }
    const addressParts: string[] = [];
    while (i < contentLines.length) {
      const line = contentLines[i];
      if (/^\d{4,6}$/.test(line)) break;
      if (/,/.test(line) && /^[A-Z][a-z]+,\s+[A-Z]/.test(line)) break;
      if (line === "ACTIVE" || line === "INACTIVE") { i++; break; }
      if (/^\+\d+\s+Location/.test(line)) { i++; continue; }
      if (line.startsWith("Phone:") || line.startsWith("Fax:")) { addressParts.push(line); i++; continue; }
      if (!line) { i++; continue; }
      addressParts.push(line); i++;
    }
    if (name && cpsoId) doctors.push({ cpsoId, name, specialty: specialty || "Pediatrics", address: addressParts.join(", ") });
  }
  return doctors;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let total = 0;

  for (const city of CITIES) {
    process.stdout.write(`${city}: `);

    try {
      await page.goto("https://register.cpso.on.ca/Advanced-Search/", { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(600);
      await page.locator('input[value="Specialist"]').first().click();
      await page.waitForTimeout(300);
      await page.locator('select#specialistType').selectOption({ label: "Pediatrics" });
      await page.locator('select#cityDropDown').selectOption({ label: city }).catch(() => {});
      await page.locator("button.search-button").click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(5000);

      const bodyText = await page.locator("body").innerText();
      
      if (bodyText.includes("more than 100 results")) {
        console.log(">100 skipped");
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }

      const pageMatch = bodyText.match(/Showing\s+\d+\s+of\s+(\d+)\s+pages?/);
      const totalPages = pageMatch ? parseInt(pageMatch[1]) : 1;

      const allDocs: any[] = [];
      for (let p = 1; p <= totalPages; p++) {
        if (p > 1) {
          await page.locator(`text="${p}"`).first().click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(2000);
        }
        const text = await page.locator("body").innerText();
        for (const d of parseDoctors(text)) {
          if (!allDocs.some((x: any) => x.cpsoId === d.cpsoId)) allDocs.push(d);
        }
      }

      console.log(String(allDocs.length));
      total += allDocs.length;

      for (const doc of allDocs) {
        const isSpecialist = doc.specialty !== "Pediatrics" && doc.specialty.length > 0 && !doc.specialty.toLowerCase().includes("general");
        await prisma.$executeRawUnsafe(
          `INSERT INTO doctors (id, cpso_id, name, specialty, doctor_type, referral_required, accepting_status, languages, address, coords, source, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4::"DoctorType", $5, 'unknown'::"AcceptingStatus", '{}'::text[], $6, ST_SetSRID(ST_MakePoint(0, 0), 4326), 'cpso', now(), now())
           ON CONFLICT (cpso_id) DO UPDATE SET name = EXCLUDED.name, specialty = EXCLUDED.specialty, doctor_type = EXCLUDED.doctor_type, address = EXCLUDED.address, updated_at = now()`,
          doc.cpsoId, doc.name, doc.specialty || "Pediatrics",
          isSpecialist ? "pediatrician_specialist" : "pediatrician_primary",
          isSpecialist, doc.address || null
        );
      }
    } catch (e: any) {
      console.log("error:", e.message?.slice(0, 60));
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  const dbTotal = await prisma.doctor.count();
  console.log(`\nScraped: ${total}, DB total: ${dbTotal}`);
  await browser.close();
  await prisma.$disconnect();
}

main().catch(console.error);
