// Run with: npx tsx scripts/seed-doctors.ts
// Seeds GTA pediatricians into the doctors table for development/testing.

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

interface DoctorSeed {
  name: string;
  specialty: string | null;
  doctorType: "pediatrician_primary" | "pediatrician_specialist";
  referralRequired: boolean;
  acceptingStatus: "accepting" | "waitlist" | "not_accepting" | "unknown";
  languages: string[];
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  virtualVisits: boolean;
  ageMin: number | null;
  ageMax: number | null;
}

const doctors: DoctorSeed[] = [
  // Toronto — primary care pediatricians
  {
    name: "Dr. Sarah Mitchell",
    specialty: "General Pediatrics",
    doctorType: "pediatrician_primary",
    referralRequired: false,
    acceptingStatus: "accepting",
    languages: ["English", "French"],
    address: "555 University Ave, Toronto, ON M5G 1X8",
    lat: 43.6569, lng: -79.3882,
    phone: "+1 416-813-1500",
    website: "https://www.sickkids.ca",
    virtualVisits: true,
    ageMin: 0, ageMax: 18,
  },
  {
    name: "Dr. Michael Chen",
    specialty: "General Pediatrics",
    doctorType: "pediatrician_primary",
    referralRequired: false,
    acceptingStatus: "accepting",
    languages: ["English", "Mandarin"],
    address: "36 Toronto St, Toronto, ON M5C 2C5",
    lat: 43.6501, lng: -79.3761,
    phone: "+1 416-360-7272",
    website: null,
    virtualVisits: false,
    ageMin: 0, ageMax: 18,
  },
  {
    name: "Dr. Aisha Rahman",
    specialty: "General Pediatrics",
    doctorType: "pediatrician_primary",
    referralRequired: false,
    acceptingStatus: "waitlist",
    languages: ["English", "Arabic", "Urdu"],
    address: "600 University Ave, Toronto, ON M5G 1X5",
    lat: 43.6576, lng: -79.3892,
    phone: "+1 416-586-4800",
    website: "https://www.mountsinai.on.ca",
    virtualVisits: true,
    ageMin: 0, ageMax: 18,
  },
  // Toronto — specialist pediatricians
  {
    name: "Dr. James Walker",
    specialty: "Pediatric Cardiology",
    doctorType: "pediatrician_specialist",
    referralRequired: true,
    acceptingStatus: "accepting",
    languages: ["English"],
    address: "555 University Ave, Toronto, ON M5G 1X8",
    lat: 43.6569, lng: -79.3882,
    phone: "+1 416-813-6130",
    website: "https://www.sickkids.ca/en/care-services/clinical-departments/cardiology/",
    virtualVisits: true,
    ageMin: 0, ageMax: 18,
  },
  {
    name: "Dr. Priya Sharma",
    specialty: "Pediatric Endocrinology",
    doctorType: "pediatrician_specialist",
    referralRequired: true,
    acceptingStatus: "waitlist",
    languages: ["English", "Hindi"],
    address: "600 University Ave, Toronto, ON M5G 1X5",
    lat: 43.6576, lng: -79.3892,
    phone: "+1 416-586-4800",
    website: null,
    virtualVisits: false,
    ageMin: 0, ageMax: 18,
  },
  // Milton
  {
    name: "Dr. Laura Thompson",
    specialty: "General Pediatrics",
    doctorType: "pediatrician_primary",
    referralRequired: false,
    acceptingStatus: "accepting",
    languages: ["English"],
    address: "470 Bronte St S, Milton, ON L9T 2J4",
    lat: 43.5144, lng: -79.8815,
    phone: "+1 905-878-2383",
    website: null,
    virtualVisits: true,
    ageMin: 0, ageMax: 18,
  },
  {
    name: "Dr. Omar Hassan",
    specialty: "General Pediatrics",
    doctorType: "pediatrician_primary",
    referralRequired: false,
    acceptingStatus: "waitlist",
    languages: ["English", "Arabic", "Somali"],
    address: "7030 Derry Rd W, Milton, ON L9T 7H6",
    lat: 43.5215, lng: -79.8792,
    phone: "+1 905-875-2400",
    website: null,
    virtualVisits: false,
    ageMin: 0, ageMax: 18,
  },
  // Mississauga
  {
    name: "Dr. Rachel Wong",
    specialty: "General Pediatrics",
    doctorType: "pediatrician_primary",
    referralRequired: false,
    acceptingStatus: "accepting",
    languages: ["English", "Cantonese", "Mandarin"],
    address: "100 Queensway W, Mississauga, ON L5B 1B8",
    lat: 43.5877, lng: -79.6436,
    phone: "+1 905-848-7100",
    website: "https://www.trilliumhealthpartners.ca",
    virtualVisits: true,
    ageMin: 0, ageMax: 18,
  },
  // Oakville
  {
    name: "Dr. David Park",
    specialty: "General Pediatrics",
    doctorType: "pediatrician_primary",
    referralRequired: false,
    acceptingStatus: "accepting",
    languages: ["English", "Korean"],
    address: "3001 Hospital Gate, Oakville, ON L6M 0L8",
    lat: 43.4578, lng: -79.7383,
    phone: "+1 905-845-2571",
    website: "https://www.haltonhealthcare.on.ca",
    virtualVisits: true,
    ageMin: 0, ageMax: 18,
  },
  // Brampton
  {
    name: "Dr. Fatima Khan",
    specialty: "General Pediatrics",
    doctorType: "pediatrician_primary",
    referralRequired: false,
    acceptingStatus: "accepting",
    languages: ["English", "Urdu", "Punjabi"],
    address: "2100 Bovaird Dr E, Brampton, ON L6R 3J7",
    lat: 43.7266, lng: -79.7491,
    phone: "+1 905-494-2120",
    website: null,
    virtualVisits: false,
    ageMin: 0, ageMax: 18,
  },
  // North York
  {
    name: "Dr. Samuel Cohen",
    specialty: "Pediatric Allergy & Immunology",
    doctorType: "pediatrician_specialist",
    referralRequired: true,
    acceptingStatus: "not_accepting",
    languages: ["English", "Hebrew"],
    address: "4001 Leslie St, North York, ON M2K 1E1",
    lat: 43.7725, lng: -79.3962,
    phone: "+1 416-756-6000",
    website: "https://www.nygh.on.ca",
    virtualVisits: false,
    ageMin: 0, ageMax: 18,
  },
  // Scarborough
  {
    name: "Dr. Grace Nguyen",
    specialty: "General Pediatrics",
    doctorType: "pediatrician_primary",
    referralRequired: false,
    acceptingStatus: "waitlist",
    languages: ["English", "Vietnamese"],
    address: "3050 Lawrence Ave E, Scarborough, ON M1P 2V5",
    lat: 43.7525, lng: -79.2482,
    phone: "+1 416-438-2911",
    website: null,
    virtualVisits: false,
    ageMin: 0, ageMax: 18,
  },
];

async function main() {
  console.log(`Seeding ${doctors.length} pediatricians...`);

  let inserted = 0;

  for (const doc of doctors) {
    // Generate a fake CPSO ID for dev purposes
    const cpsoId = `DEV-${doc.name.replace(/\s+/g, "-").toLowerCase().slice(0, 20)}`;

    await prisma.$executeRawUnsafe(
      `INSERT INTO doctors (id, cpso_id, name, specialty, doctor_type, referral_required, accepting_status, languages, address, coords, phone, website, virtual_visits_available, age_range_min, age_range_max, source, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4::"DoctorType", $5, $6::"AcceptingStatus", $7, $8, ST_SetSRID(ST_MakePoint($9, $10), 4326), $11, $12, $13, $14, $15, 'community', now(), now())
       ON CONFLICT (cpso_id) DO NOTHING`,
      cpsoId,
      doc.name,
      doc.specialty,
      doc.doctorType,
      doc.referralRequired,
      doc.acceptingStatus,
      doc.languages,
      doc.address,
      doc.lng,
      doc.lat,
      doc.phone,
      doc.website,
      doc.virtualVisits,
      doc.ageMin,
      doc.ageMax
    );

    inserted++;
    console.log(`Inserted: ${doc.name} (${doc.doctorType === "pediatrician_primary" ? "Primary care" : "Specialist"})`);
  }

  console.log(`Done. Total doctors inserted: ${inserted}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
