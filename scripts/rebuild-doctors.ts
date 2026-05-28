// Delete all, re-scrape CPSO with addresses, geocode
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
  "Sudbury", "Thunder Bay",
  "Mississauga", "Toronto", "Hamilton", "London", "Ottawa", "Barrie",
];

const POSTAL_RE = /\b[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d\b/;

// FIXED parser: single combined loop after CPSO#
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

    // Single loop: collect specialty + address
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
      // First non-empty line that doesn't look like an address = specialty
      if (!specialty && !/\d/.test(line) && !line.includes("ON ") && !line.includes("Ontario") && !line.toLowerCase().startsWith("suite") && !line.toLowerCase().startsWith("unit")) {
        specialty = line;
      } else {
        addressParts.push(line);
      }
      i++;
    }
    const address = addressParts.join(", ");
    if (name && cpsoId) {
      doctors.push({ cpsoId, name, specialty: specialty || "Pediatrics", address });
    }
  }
  return doctors;
}

let lastNominatim = 0;
async function geocodeNominatim(postalCode: string): Promise<{lat: number; lng: number} | null> {
  const now = Date.now();
  const wait = Math.max(0, 1000 - (now - lastNominatim));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastNominatim = Date.now();
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("postalcode", postalCode);
    url.searchParams.set("country", "Canada");
    url.searchParams.set("format", "json"); url.searchParams.set("limit", "1");
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "KidsCareOntario/1.0" },
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
  if (nm) await prisma.postalCode.create({ data: { postalCode: postal, lat: nm.lat, lng: nm.lng } }).catch(() => {});
  return nm;
}

function extractPostalCode(address: string): string | null {
  const match = address.match(POSTAL_RE);
  return match ? match[0].replace(/\s/g, "").toUpperCase() : null;
}

async function main() {
  const del = await prisma.doctor.deleteMany();
  console.log(`Deleted ${del.count}. Scraping...\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let total = 0;

  for (const city of CITIES) {
    process.stdout.write(`${city}: `);
    try {
      await page.goto("https://register.cpso.on.ca/Advanced-Search/", { waitUntil: "networkidle", timeout: 20000 });
      await page.locator('input[value="Specialist"]').first().click();
      await page.waitForTimeout(300);
      await page.locator('select#specialistType').selectOption({ label: "Pediatrics" });
      await page.locator('select#cityDropDown').selectOption({ label: city }).catch(() => {});
      await page.locator("button.search-button").click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(5000);

      const bodyText = await page.locator("body").innerText();
      if (bodyText.includes("more than 100 results")) { console.log(">100"); await new Promise(r => setTimeout(r, 1500)); continue; }

      const pageMatch = bodyText.match(/Showing\s+\d+\s+of\s+(\d+)\s+pages?/);
      const totalPages = pageMatch ? parseInt(pageMatch[1]) : 1;

      const allDocs: any[] = [];
      for (let p = 1; p <= totalPages; p++) {
        if (p > 1) { await page.locator(`text="${p}"`).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(2000); }
        const text = await page.locator("body").innerText();
        for (const d of parseDoctors(text)) {
          if (!allDocs.some((x: any) => x.cpsoId === d.cpsoId)) allDocs.push(d);
        }
      }

      let cityTotal = 0;
      for (const doc of allDocs) {
        if (!doc.address) continue;
        const coords = await geocodeAddress(doc.address);
        if (!coords) continue;
        const isSpecialist = doc.specialty !== "Pediatrics" && doc.specialty.length > 0 && !doc.specialty.toLowerCase().includes("general");
        await prisma.$executeRawUnsafe(
          `INSERT INTO doctors (id, cpso_id, name, specialty, doctor_type, referral_required, accepting_status, languages, address, coords, source, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4::"DoctorType", $5, 'unknown'::"AcceptingStatus", '{}'::text[], $6, ST_SetSRID(ST_MakePoint($7, $8), 4326), 'cpso', now(), now())`,
          doc.cpsoId, doc.name, doc.specialty || "Pediatrics",
          isSpecialist ? "pediatrician_specialist" : "pediatrician_primary",
          isSpecialist, doc.address, coords.lng, coords.lat
        );
        cityTotal++;
      }
      console.log(`${cityTotal}/${allDocs.length}`);
      total += cityTotal;
    } catch (e: any) { console.log("err:", e.message?.slice(0, 50)); }
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\nTotal geocoded: ${total}, DB: ${await prisma.doctor.count()}`);
  await browser.close(); await prisma.$disconnect();
}
main().catch(console.error);
