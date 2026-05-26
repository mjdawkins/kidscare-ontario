// Run with: npx tsx scripts/seed-postal-codes.ts [path/to/postal_codes.csv]
// Downloads and seeds Ontario postal codes into the postal_codes table.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding postal codes...");

  const fs = await import("fs");
  const path = await import("path");

  const filePath = process.argv[2] ?? path.join(__dirname, "..", "data", "ontario_postal_codes.csv");

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    console.error("Download an Ontario postal code dataset (e.g., from geocoder.ca) and place it at:", filePath);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");

  let inserted = 0;
  const batch: Array<{
    postalCode: string;
    lat: number;
    lng: number;
    city: string;
    province: string;
  }> = [];

  for (const line of lines) {
    const cols = line.split(",");
    if (cols.length < 3) continue;

    const rawCode = cols[0].trim().replace(/\s+/g, "").toUpperCase();
    const lat = parseFloat(cols[1]);
    const lng = parseFloat(cols[2]);
    const city = cols[3]?.trim() ?? "";
    const province = cols[4]?.trim() ?? "ON";

    if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(rawCode)) continue;
    if (isNaN(lat) || isNaN(lng)) continue;

    batch.push({ postalCode: rawCode, lat, lng, city, province });

    if (batch.length >= 1000) {
      await prisma.postalCode.createMany({
        data: batch,
        skipDuplicates: true,
      });
      inserted += batch.length;
      console.log(`Inserted ${inserted} postal codes...`);
      batch.length = 0;
    }
  }

  if (batch.length > 0) {
    await prisma.postalCode.createMany({
      data: batch,
      skipDuplicates: true,
    });
    inserted += batch.length;
  }

  console.log(`Done. Total postal codes inserted: ${inserted}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
