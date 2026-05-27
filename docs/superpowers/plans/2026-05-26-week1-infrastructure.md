# Week 1 — Infrastructure & Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the complete project infrastructure — database schema, dependencies, folder structure, API route stubs, component stubs, data pipelines, and deployment — so Week 2 can start building features on a solid foundation.

**Architecture:** Next.js 16 App Router with Supabase (PostgreSQL + PostGIS + Auth), Prisma ORM, Leaflet maps, Zod validation, and Vercel Cron Jobs. All external data flows through cron pipelines into the database — no external API calls in the request path.

**Tech Stack:** Next.js 16.2.6, React 19.2.4, Tailwind CSS v4, TypeScript 5, Supabase (PostGIS), Prisma, Zod, Leaflet + react-leaflet, Resend, cheerio, Vitest

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install all production and dev dependencies**

```bash
cd /Users/mikhaildawkins/Documents/kidscare-ontario

npm install @supabase/supabase-js @supabase/ssr @prisma/client zod resend leaflet react-leaflet cheerio
npm install -D prisma vitest @testing-library/react @testing-library/jest-dom @types/leaflet
```

Expected: Dependencies added to `package.json` and `node_modules`.

- [ ] **Step 2: Verify install**

```bash
npm ls @supabase/supabase-js prisma zod leaflet react-leaflet vitest 2>/dev/null | head -10
```

Expected: All packages listed with versions.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install v1 dependencies (Supabase, Prisma, Zod, Leaflet, Resend, Vitest)"
```

---

## Task 2: Environment Variables

**Files:**
- Create: `.env.example`
- Create: `.env.local` (gitignored)

- [ ] **Step 1: Create `.env.example`**

```bash
cat > /Users/mikhaildawkins/Documents/kidscare-ontario/.env.example << 'EOF'
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Database (Prisma)
DATABASE_URL=

# Google Places API (server-only cron — never prefix with NEXT_PUBLIC_)
GOOGLE_MAPS_API_KEY=

# Resend (transactional email)
RESEND_API_KEY=

# Cron security
CRON_SECRET=
EOF
```

- [ ] **Step 2: Create placeholder `.env.local`**

```bash
cat > /Users/mikhaildawkins/Documents/kidscare-ontario/.env.local << 'EOF'
# Placeholder — fill in real values after Supabase project is created
SUPABASE_URL=https://placeholder.supabase.co
SUPABASE_ANON_KEY=placeholder
SUPABASE_SERVICE_ROLE_KEY=placeholder
DATABASE_URL=postgresql://placeholder
GOOGLE_MAPS_API_KEY=placeholder
RESEND_API_KEY=placeholder
CRON_SECRET=placeholder
EOF
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: add .env.example with all required environment variables"
```

---

## Task 3: Prisma Schema

**Files:**
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Create the Prisma schema**

Write `prisma/schema.prisma`:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [postgis(version: "3.4"), pgcrypto]
}

enum DoctorType {
  pediatrician_primary
  pediatrician_specialist
  family_doctor
}

enum AcceptingStatus {
  accepting
  waitlist
  not_accepting
  unknown
}

enum DoctorSource {
  cpso
  pediatricians_alliance
  community
}

enum VerificationMethod {
  called_office
  visited_in_person
  received_appointment
  told_by_receptionist
}

enum AlertType {
  doctor
}

enum ChainType {
  shoppers
  rexall
  pharmasave
  costco
  independent
  other
}

enum FlagReason {
  hours_wrong
  address_wrong
  closed_permanently
  no_longer_sees_children
  other
}

model PostalCode {
  postalCode String  @id @map("postal_code")
  lat        Float   @map("lat")
  lng        Float   @map("lng")
  city       String?
  province   String? @default("ON")

  @@map("postal_codes")
}

model Clinic {
  id                       String     @id @default(uuid()) @db.Uuid
  name                     String
  address                  String
  coords                   Unsupported("geometry(Point,4326)")
  phone                    String?
  hours                    Json       @default("{}")
  openSaturday             Boolean    @default(false) @map("open_saturday")
  openSunday               Boolean    @default(false) @map("open_sunday")
  openAfter6pm             Boolean    @default(false) @map("open_after_6pm")
  seesChildren             Boolean    @default(false) @map("sees_children")
  sameDayBookingRequired   Boolean    @default(false) @map("same_day_booking_required")
  isPediatricOnly          Boolean    @default(false) @map("is_pediatric_only")
  virtualCareAvailable     Boolean    @default(false) @map("virtual_care_available")
  googlePlaceId            String?    @map("google_place_id")
  communityFlagged         Boolean    @default(false) @map("community_flagged")
  lastFlaggedAt            DateTime?  @map("last_flagged_at") @db.Timestamptz()
  createdAt                DateTime   @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt                DateTime   @updatedAt @map("updated_at") @db.Timestamptz()

  @@index([seesChildren])
  @@index([openSaturday])
  @@index([openSunday])
  @@index([openAfter6pm])
  @@map("clinics")
}

model Doctor {
  id                     String         @id @default(uuid()) @db.Uuid
  cpsoId                 String?        @unique @map("cpso_id")
  name                   String
  specialty              String?
  doctorType             DoctorType     @map("doctor_type")
  referralRequired       Boolean        @default(true) @map("referral_required")
  acceptingStatus        AcceptingStatus @default(unknown) @map("accepting_status")
  languages              String[]       @default([])
  address                String?
  coords                 Unsupported("geometry(Point,4326)")
  phone                  String?
  website                String?
  virtualVisitsAvailable Boolean        @default(false) @map("virtual_visits_available")
  ageRangeMin            Int?           @map("age_range_min")
  ageRangeMax            Int?           @map("age_range_max")
  lastVerified           DateTime?      @map("last_verified") @db.Timestamptz()
  verificationCount      Int            @default(0) @map("verification_count")
  source                 DoctorSource   @default(cpso)
  createdAt              DateTime       @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt              DateTime       @updatedAt @map("updated_at") @db.Timestamptz()

  verifications Verification[]
  alerts        Alert[]

  @@index([acceptingStatus])
  @@index([referralRequired])
  @@index([doctorType])
  @@map("doctors")
}

model Verification {
  id             String             @id @default(uuid()) @db.Uuid
  doctorId       String             @map("doctor_id") @db.Uuid
  userId         String             @map("user_id") @db.Uuid
  reportedStatus AcceptingStatus    @map("reported_status")
  howConfirmed   VerificationMethod @map("how_confirmed")
  notes          String?
  createdAt      DateTime           @default(now()) @map("created_at") @db.Timestamptz()

  doctor Doctor @relation(fields: [doctorId], references: [id])

  @@index([doctorId, createdAt(sort: Desc)])
  @@index([userId])
  @@map("verifications")
}

model Alert {
  id               String       @id @default(uuid()) @db.Uuid
  userId           String       @map("user_id") @db.Uuid
  alertType        AlertType    @default(doctor) @map("alert_type")
  targetId         String?      @map("target_id") @db.Uuid
  postalCode       String?      @map("postal_code")
  radiusKm         Int          @default(10) @map("radius_km")
  doctorTypeFilter DoctorType?  @map("doctor_type_filter")
  languageFilter   String?      @map("language_filter")
  lastNotifiedAt   DateTime?    @map("last_notified_at") @db.Timestamptz()
  createdAt        DateTime     @default(now()) @map("created_at") @db.Timestamptz()

  doctor Doctor? @relation(fields: [targetId], references: [id])

  @@index([userId])
  @@map("alerts")
}

model ErWaitTime {
  id           String   @id @default(uuid()) @db.Uuid
  hospitalName String   @map("hospital_name")
  coords       Unsupported("geometry(Point,4326)")
  waitTimeMin  Int      @map("wait_time_min")
  urgencyLevel String   @map("urgency_level")
  lastUpdated  DateTime @map("last_updated") @db.Timestamptz()
  fetchedAt    DateTime @default(now()) @map("fetched_at") @db.Timestamptz()

  @@index([urgencyLevel])
  @@map("er_wait_times")
}

model Pharmacy {
  id          String    @id @default(uuid()) @db.Uuid
  name        String
  address     String
  coords      Unsupported("geometry(Point,4326)")
  phone       String?
  hours       Json      @default("{}")
  acceptsOdb  Boolean   @default(true) @map("accepts_odb")
  is24hr      Boolean   @default(false) @map("is_24hr")
  chain       ChainType @default(other)
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz()

  @@map("pharmacies")
}
```

- [ ] **Step 2: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Prisma schema with all v1 tables (clinics, doctors, verifications, alerts, er_wait_times, pharmacies, postal_codes)"
```

---

## Task 4: Prisma Client Singleton

**Files:**
- Create: `src/lib/db/prisma.ts`

- [ ] **Step 1: Create Prisma client singleton**

Write `src/lib/db/prisma.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors (Prisma client types won't exist yet, but the import should be fine once `npx prisma generate` runs in Task 5).

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/prisma.ts
git commit -m "feat: add Prisma client singleton"
```

---

## Task 5: Shared Library Files

**Files:**
- Create: `src/lib/utils.ts`
- Create: `src/lib/geo.ts`
- Create: `src/lib/rate-limit.ts`
- Create: `src/types/index.ts`

- [ ] **Step 1: Create `src/lib/utils.ts`**

```typescript
/**
 * Normalize a Canadian postal code: strip spaces, uppercase.
 * "M5V 2T6" -> "M5V2T6"
 */
export function normalizePostalCode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

/**
 * Validate Canadian postal code format: A1A1A1
 */
export function isValidPostalCode(input: string): boolean {
  return /^[A-Za-z]\d[A-Za-z]\d[A-Za-z]\d$/.test(input.replace(/\s+/g, ""));
}

/**
 * Extract FSA (first 3 characters) from postal code for fallback lookups.
 * "M5V2T6" -> "M5V"
 */
export function extractFSA(postalCode: string): string {
  return normalizePostalCode(postalCode).slice(0, 3);
}
```

- [ ] **Step 2: Create `src/lib/geo.ts`**

```typescript
import { prisma } from "./db/prisma";
import { normalizePostalCode, extractFSA, isValidPostalCode } from "./utils";

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Look up coordinates for a Canadian postal code.
 * Falls back to FSA centroid if exact match fails.
 * Returns null if the postal code is completely unknown.
 */
export async function postalCodeToCoords(
  postalCode: string
): Promise<Coordinates | null> {
  if (!isValidPostalCode(postalCode)) {
    return null;
  }

  const normalized = normalizePostalCode(postalCode);

  // Try exact match
  const exact = await prisma.postalCode.findUnique({
    where: { postalCode: normalized },
    select: { lat: true, lng: true },
  });

  if (exact) {
    return { lat: exact.lat, lng: exact.lng };
  }

  // Fall back to FSA centroid (first 3 chars)
  const fsa = extractFSA(normalized);
  const fsaMatch = await prisma.postalCode.findFirst({
    where: { postalCode: { startsWith: fsa } },
    select: { lat: true, lng: true },
  });

  if (fsaMatch) {
    return { lat: fsaMatch.lat, lng: fsaMatch.lng };
  }

  return null;
}
```

- [ ] **Step 3: Create `src/lib/rate-limit.ts`**

```typescript
const store = new Map<string, { count: number; resetAt: number }>();

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

/**
 * Simple in-memory rate limiter. For production, replace with
 * Upstash Redis or Vercel's built-in rate limiting.
 */
export function rateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
  }

  entry.count++;

  if (entry.count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

// Periodic cleanup of stale entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 60_000);
```

- [ ] **Step 4: Create `src/types/index.ts`**

```typescript
// Re-export Prisma types used across the app
export type {
  Clinic,
  Doctor,
  Verification,
  Alert,
  ErWaitTime,
  Pharmacy,
  DoctorType,
  AcceptingStatus,
} from "@prisma/client";

// API response types
export interface ApiError {
  error: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  results: T[];
  total: number;
  limit: number;
  offset: number;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils.ts src/lib/geo.ts src/lib/rate-limit.ts src/types/index.ts
git commit -m "feat: add shared library files (utils, geo, rate-limit, types)"
```

---

## Task 6: Zod Validation Schemas

**Files:**
- Create: `src/lib/validation/clinics.ts`
- Create: `src/lib/validation/doctors.ts`
- Create: `src/lib/validation/alerts.ts`
- Create: `src/lib/validation/index.ts`

- [ ] **Step 1: Create `src/lib/validation/clinics.ts`**

```typescript
import { z } from "zod";

export const clinicSearchSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(1).max(50).default(10),
  open_now: z.coerce.boolean().optional(),
  sees_children: z.coerce.boolean().optional(),
  open_saturday: z.coerce.boolean().optional(),
  open_sunday: z.coerce.boolean().optional(),
  open_after_6pm: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const clinicFlagSchema = z.object({
  reason: z.enum([
    "hours_wrong",
    "address_wrong",
    "closed_permanently",
    "no_longer_sees_children",
    "other",
  ]),
  note: z.string().max(500).optional(),
}).strict();

export type ClinicSearchInput = z.infer<typeof clinicSearchSchema>;
export type ClinicFlagInput = z.infer<typeof clinicFlagSchema>;
```

- [ ] **Step 2: Create `src/lib/validation/doctors.ts`**

```typescript
import { z } from "zod";

export const doctorSearchSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(1).max(50).default(10),
  doctor_type: z.enum([
    "pediatrician_primary",
    "pediatrician_specialist",
    "family_doctor",
  ]).optional(),
  accepting_status: z.enum([
    "accepting",
    "waitlist",
    "not_accepting",
    "unknown",
  ]).optional(),
  referral_required: z.coerce.boolean().optional(),
  language: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const verificationSchema = z.object({
  reported_status: z.enum(["accepting", "waitlist", "not_accepting"]),
  how_confirmed: z.enum([
    "called_office",
    "visited_in_person",
    "received_appointment",
    "told_by_receptionist",
  ]),
  notes: z.string().max(500).optional(),
}).strict();

export type DoctorSearchInput = z.infer<typeof doctorSearchSchema>;
export type VerificationInput = z.infer<typeof verificationSchema>;
```

- [ ] **Step 3: Create `src/lib/validation/alerts.ts`**

```typescript
import { z } from "zod";

export const alertCreateSchema = z.object({
  alert_type: z.literal("doctor"),
  target_id: z.string().uuid().optional(),
  postal_code: z.string().regex(/^[A-Za-z]\d[A-Za-z]\d[A-Za-z]\d$/).optional(),
  radius_km: z.number().int().min(5).max(50).default(10),
  doctor_type_filter: z.enum(["pediatrician_primary", "family_doctor"]).optional(),
  language_filter: z.string().max(50).optional(),
}).strict().refine(
  (data) => data.target_id || data.postal_code,
  { message: "Either target_id or postal_code is required" }
);

export type AlertCreateInput = z.infer<typeof alertCreateSchema>;
```

- [ ] **Step 4: Create `src/lib/validation/index.ts`**

```typescript
export {
  clinicSearchSchema,
  clinicFlagSchema,
  type ClinicSearchInput,
  type ClinicFlagInput,
} from "./clinics";

export {
  doctorSearchSchema,
  verificationSchema,
  type DoctorSearchInput,
  type VerificationInput,
} from "./doctors";

export {
  alertCreateSchema,
  type AlertCreateInput,
} from "./alerts";
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/
git commit -m "feat: add Zod validation schemas for clinics, doctors, and alerts API routes"
```

---

## Task 7: Verification Logic (Pure Functions)

**Files:**
- Create: `src/lib/verification.ts`

- [ ] **Step 1: Create `src/lib/verification.ts`**

```typescript
import type { AcceptingStatus } from "@prisma/client";

export const VERIFICATION_WINDOW_DAYS = 30;
export const VERIFICATION_CONSENSUS_THRESHOLD = 2;
export const VERIFICATION_COUNT_WINDOW_DAYS = 60;
export const STALE_THRESHOLD_DAYS = 30;
export const UNKNOWN_THRESHOLD_DAYS = 90;

/**
 * Determine if a doctor's accepting status should update based on
 * all verifications in the consensus window.
 *
 * Returns the new status if there's consensus, null if no change.
 */
export function calculateAcceptingStatus(
  recentVerifications: { reportedStatus: AcceptingStatus; createdAt: Date }[]
): AcceptingStatus | null {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - VERIFICATION_WINDOW_DAYS);

  const inWindow = recentVerifications.filter(
    (v) => v.createdAt >= cutoff
  );

  // Count by reported status
  const counts: Record<AcceptingStatus, number> = {
    accepting: 0,
    waitlist: 0,
    not_accepting: 0,
    unknown: 0,
  };

  for (const v of inWindow) {
    counts[v.reportedStatus]++;
  }

  // Find the status with the most verifications
  const leadingStatus = Object.entries(counts)
    .filter(([, count]) => count >= VERIFICATION_CONSENSUS_THRESHOLD)
    .sort(([, a], [, b]) => b - a)[0];

  return leadingStatus
    ? (leadingStatus[0] as AcceptingStatus)
    : null;
}

/**
 * Count how many verifications support the current status
 * within the count window (60 days).
 */
export function calculateVerificationCount(
  verifications: { reportedStatus: AcceptingStatus; createdAt: Date }[],
  currentStatus: AcceptingStatus
): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - VERIFICATION_COUNT_WINDOW_DAYS);

  return verifications.filter(
    (v) => v.reportedStatus === currentStatus && v.createdAt >= cutoff
  ).length;
}

/**
 * Check if the current status is stale (>30 days since last verification).
 */
export function isStale(lastVerified: Date | null): boolean {
  if (!lastVerified) return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_THRESHOLD_DAYS);
  return lastVerified < cutoff;
}

/**
 * Check if the status should revert to unknown (>90 days with no verifications).
 */
export function shouldRevertToUnknown(lastVerified: Date | null): boolean {
  if (!lastVerified) return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - UNKNOWN_THRESHOLD_DAYS);
  return lastVerified < cutoff;
}

/**
 * Calculate stale days for display.
 */
export function staleDays(lastVerified: Date | null): number | null {
  if (!lastVerified) return null;
  const now = new Date();
  const diffMs = now.getTime() - lastVerified.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
```

- [ ] **Step 2: Write the test file `src/lib/verification.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import {
  calculateAcceptingStatus,
  calculateVerificationCount,
  isStale,
  shouldRevertToUnknown,
  staleDays,
} from "./verification";

function makeVerification(
  status: "accepting" | "waitlist" | "not_accepting" | "unknown",
  daysAgo: number
) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return { reportedStatus: status, createdAt: date };
}

describe("calculateAcceptingStatus", () => {
  it("returns accepting when 2+ recent verifications agree", () => {
    const result = calculateAcceptingStatus([
      makeVerification("accepting", 3),
      makeVerification("accepting", 5),
      makeVerification("waitlist", 10),
    ]);
    expect(result).toBe("accepting");
  });

  it("returns null when fewer than 2 verifications", () => {
    const result = calculateAcceptingStatus([
      makeVerification("accepting", 3),
    ]);
    expect(result).toBeNull();
  });

  it("returns null when verifications disagree", () => {
    const result = calculateAcceptingStatus([
      makeVerification("accepting", 3),
      makeVerification("waitlist", 4),
    ]);
    expect(result).toBeNull();
  });

  it("ignores verifications older than 30 days", () => {
    const result = calculateAcceptingStatus([
      makeVerification("accepting", 35),
      makeVerification("accepting", 40),
    ]);
    expect(result).toBeNull();
  });

  it("returns waitlist when that leads consensus", () => {
    const result = calculateAcceptingStatus([
      makeVerification("waitlist", 1),
      makeVerification("waitlist", 2),
      makeVerification("accepting", 3),
    ]);
    expect(result).toBe("waitlist");
  });
});

describe("calculateVerificationCount", () => {
  it("counts only verifications matching the current status within 60 days", () => {
    const count = calculateVerificationCount(
      [
        makeVerification("accepting", 5),
        makeVerification("accepting", 10),
        makeVerification("waitlist", 15),
        makeVerification("accepting", 65),
      ],
      "accepting"
    );
    expect(count).toBe(2);
  });
});

describe("isStale", () => {
  it("returns true when last verified is null", () => {
    expect(isStale(null)).toBe(true);
  });

  it("returns true when last verified >30 days ago", () => {
    const date = new Date();
    date.setDate(date.getDate() - 31);
    expect(isStale(date)).toBe(true);
  });

  it("returns false when last verified <30 days ago", () => {
    const date = new Date();
    date.setDate(date.getDate() - 5);
    expect(isStale(date)).toBe(false);
  });
});

describe("shouldRevertToUnknown", () => {
  it("returns true when >90 days with no verifications", () => {
    const date = new Date();
    date.setDate(date.getDate() - 91);
    expect(shouldRevertToUnknown(date)).toBe(true);
  });

  it("returns false when <90 days", () => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    expect(shouldRevertToUnknown(date)).toBe(false);
  });
});

describe("staleDays", () => {
  it("returns null for null date", () => {
    expect(staleDays(null)).toBeNull();
  });

  it("returns approximate day count", () => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    expect(staleDays(date)).toBe(7);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/lib/verification.test.ts
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/verification.ts src/lib/verification.test.ts
git commit -m "feat: add verification logic (status recalculation, staleness) with unit tests"
```

---

## Task 8: API Route — ER Wait Times

**Files:**
- Create: `src/app/api/er-waits/route.ts`

- [ ] **Step 1: Create `src/app/api/er-waits/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(`er-waits:${ip}`, { maxRequests: 60, windowMs: 60_000 });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": "60",
          "X-RateLimit-Remaining": String(rl.remaining),
          "X-RateLimit-Reset": String(rl.resetAt),
        },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const radius = Math.min(parseInt(searchParams.get("radius") ?? "20"), 50);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10"), 20);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json(
      { error: "Invalid coordinates. Provide lat and lng query parameters." },
      { status: 400 }
    );
  }

  const results = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      hospital_name: string;
      distance_km: number;
      wait_time_min: number;
      urgency_level: string;
      last_updated: string;
      fetched_at: string;
    }>
  >(
    `SELECT
      id,
      hospital_name,
      ST_Distance(coords::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 AS distance_km,
      wait_time_min,
      urgency_level,
      last_updated,
      fetched_at
    FROM er_wait_times
    WHERE ST_DWithin(coords::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)
    ORDER BY distance_km
    LIMIT $4`,
    lng,
    lat,
    radius,
    limit
  );

  const now = new Date();
  const staleThreshold = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour

  return NextResponse.json({
    results: results.map((r) => ({
      ...r,
      is_stale: new Date(r.last_updated) < staleThreshold,
    })),
    data_source: "Ontario Wait Time Information System",
    data_source_url:
      "https://data.ontario.ca/dataset/wait-time-information-system",
    fetched_at: now.toISOString(),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/er-waits/route.ts
git commit -m "feat: add ER wait times API endpoint with PostGIS spatial query"
```

---

## Task 9: API Route — Clinics (Search + Detail + Flag)

> **Note:** Task 9 step 3 (clinic flag route) imports from `@/lib/supabase/server` created in Task 10. Execute Task 10 before Task 9 step 3, or defer the flag route to after Task 10.

**Files:**
- Create: `src/app/api/clinics/route.ts`
- Create: `src/app/api/clinics/[id]/route.ts`
- Create: `src/app/api/clinics/[id]/flag/route.ts`

- [ ] **Step 1: Create `src/app/api/clinics/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { clinicSearchSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(`clinics:${ip}`, { maxRequests: 60, windowMs: 60_000 });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = clinicSearchSchema.safeParse({
    lat: searchParams.get("lat"),
    lng: searchParams.get("lng"),
    radius: searchParams.get("radius"),
    open_now: searchParams.get("open_now"),
    sees_children: searchParams.get("sees_children"),
    open_saturday: searchParams.get("open_saturday"),
    open_sunday: searchParams.get("open_sunday"),
    open_after_6pm: searchParams.get("open_after_6pm"),
    limit: searchParams.get("limit"),
    offset: searchParams.get("offset"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { lat, lng, radius, limit, offset, ...filters } = parsed.data;

  // Build WHERE conditions for non-spatial filters
  const conditions: string[] = [];
  const params: unknown[] = [lng, lat, radius * 1000];

  if (filters.open_now !== undefined) {
    // "Open now" requires checking current day and time against hours JSONB
    const now = new Date();
    const dayOfWeek = now.getDay().toString();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    conditions.push(
      `(hours->$${params.length + 1}->>'open' <= $${params.length + 2} AND hours->$${params.length + 3}->>'close' >= $${params.length + 4})`
    );
    params.push(dayOfWeek, timeStr, dayOfWeek, timeStr);
  }

  if (filters.sees_children !== undefined) {
    conditions.push(`sees_children = $${params.length + 1}`);
    params.push(filters.sees_children);
  }

  if (filters.open_saturday !== undefined) {
    conditions.push(`open_saturday = $${params.length + 1}`);
    params.push(filters.open_saturday);
  }

  if (filters.open_sunday !== undefined) {
    conditions.push(`open_sunday = $${params.length + 1}`);
    params.push(filters.open_sunday);
  }

  if (filters.open_after_6pm !== undefined) {
    conditions.push(`open_after_6pm = $${params.length + 1}`);
    params.push(filters.open_after_6pm);
  }

  const whereClause = conditions.length > 0
    ? `AND ${conditions.join(" AND ")}`
    : "";

  // Count query
  const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM clinics
     WHERE ST_DWithin(coords::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
     ${whereClause}`,
    ...params
  );

  // Data query
  params.push(limit, offset);
  const results = await prisma.$queryRawUnsafe<
    Array<Record<string, unknown>>
  >(
    `SELECT
      id, name, address, phone,
      ST_Distance(coords::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 AS distance_km,
      hours, open_saturday, open_sunday, open_after_6pm,
      sees_children, same_day_booking_required, is_pediatric_only,
      virtual_care_available, community_flagged
    FROM clinics
    WHERE ST_DWithin(coords::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
    ${whereClause}
    ORDER BY distance_km
    LIMIT $${params.length - 1} OFFSET $${params.length}`,
    ...params
  );

  return NextResponse.json({
    results,
    total: Number(countResult[0].count),
    limit,
    offset,
  });
}
```

- [ ] **Step 2: Create `src/app/api/clinics/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const clinic = await prisma.clinic.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      hours: true,
      openSaturday: true,
      openSunday: true,
      openAfter6pm: true,
      seesChildren: true,
      sameDayBookingRequired: true,
      isPediatricOnly: true,
      virtualCareAvailable: true,
      communityFlagged: true,
      lastFlaggedAt: true,
      createdAt: true,
    },
  });

  if (!clinic) {
    return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
  }

  return NextResponse.json(clinic);
}
```

- [ ] **Step 3: Create `src/app/api/clinics/[id]/flag/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { clinicFlagSchema } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Rate limit
  const rl = rateLimit(`flag:${user.id}`, { maxRequests: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Validate body
  const body = await request.json();
  const parsed = clinicFlagSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Check clinic exists
  const clinic = await prisma.clinic.findUnique({ where: { id } });
  if (!clinic) {
    return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
  }

  // Update flag
  await prisma.clinic.update({
    where: { id },
    data: {
      communityFlagged: true,
      lastFlaggedAt: new Date(),
    },
  });

  return NextResponse.json({
    flagged: true,
    message: "Thank you. We'll review this clinic's information.",
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/clinics/
git commit -m "feat: add clinic API routes (search, detail, flag)"
```

---

## Task 10: Supabase Server Client

**Files:**
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/middleware.ts`

- [ ] **Step 1: Create `src/lib/supabase/server.ts`**

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // The setAll method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 2: Create `src/lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Create `src/lib/supabase/middleware.ts`**

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: add Supabase server, client, and middleware helpers"
```

---

## Task 11: API Route — Doctors (Search + Detail + Verify)

**Files:**
- Create: `src/app/api/doctors/route.ts`
- Create: `src/app/api/doctors/[id]/route.ts`
- Create: `src/app/api/doctors/[id]/verify/route.ts`

- [ ] **Step 1: Create `src/app/api/doctors/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { doctorSearchSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { isStale, staleDays } from "@/lib/verification";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(`doctors:${ip}`, { maxRequests: 60, windowMs: 60_000 });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = doctorSearchSchema.safeParse({
    lat: searchParams.get("lat"),
    lng: searchParams.get("lng"),
    radius: searchParams.get("radius"),
    doctor_type: searchParams.get("doctor_type"),
    accepting_status: searchParams.get("accepting_status"),
    referral_required: searchParams.get("referral_required"),
    language: searchParams.get("language"),
    limit: searchParams.get("limit"),
    offset: searchParams.get("offset"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { lat, lng, radius, limit, offset, ...filters } = parsed.data;

  const conditions: string[] = [];
  const params: unknown[] = [lng, lat, radius * 1000];

  if (filters.doctor_type) {
    conditions.push(`doctor_type = $${params.length + 1}::"DoctorType"`);
    params.push(filters.doctor_type);
  }

  if (filters.accepting_status) {
    conditions.push(`accepting_status = $${params.length + 1}::"AcceptingStatus"`);
    params.push(filters.accepting_status);
  }

  if (filters.referral_required !== undefined) {
    conditions.push(`referral_required = $${params.length + 1}`);
    params.push(filters.referral_required);
  }

  if (filters.language) {
    conditions.push(`$${params.length + 1} = ANY(languages)`);
    params.push(filters.language);
  }

  const whereClause = conditions.length > 0
    ? `AND ${conditions.join(" AND ")}`
    : "";

  const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM doctors
     WHERE ST_DWithin(coords::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
     ${whereClause}`,
    ...params
  );

  params.push(limit, offset);
  const rows = await prisma.$queryRawUnsafe<
    Array<Record<string, unknown>>
  >(
    `SELECT
      id, cpso_id, name, specialty, doctor_type, referral_required,
      accepting_status, languages, address, phone, website,
      ST_Distance(coords::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 AS distance_km,
      virtual_visits_available, age_range_min, age_range_max,
      last_verified, verification_count
    FROM doctors
    WHERE ST_DWithin(coords::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
    ${whereClause}
    ORDER BY distance_km
    LIMIT $${params.length - 1} OFFSET $${params.length}`,
    ...params
  );

  const results = rows.map((r) => ({
    ...r,
    verification: {
      last_verified: r.last_verified,
      verification_count: r.verification_count,
      is_stale: isStale(r.last_verified as Date | null),
      stale_days: staleDays(r.last_verified as Date | null),
    },
  }));

  return NextResponse.json({
    results,
    total: Number(countResult[0].count),
    limit,
    offset,
  });
}
```

- [ ] **Step 2: Create `src/app/api/doctors/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isStale, staleDays } from "@/lib/verification";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const doctor = await prisma.doctor.findUnique({
    where: { id },
    include: {
      verifications: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          reportedStatus: true,
          howConfirmed: true,
          createdAt: true,
        },
      },
    },
  });

  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...doctor,
    verification: {
      last_verified: doctor.lastVerified,
      verification_count: doctor.verificationCount,
      is_stale: isStale(doctor.lastVerified),
      stale_days: staleDays(doctor.lastVerified),
    },
    recent_verifications: doctor.verifications.map((v) => ({
      reported_status: v.reportedStatus,
      how_confirmed: v.howConfirmed,
      created_at: v.createdAt.toISOString(),
    })),
  });
}
```

- [ ] **Step 3: Create `src/app/api/doctors/[id]/verify/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verificationSchema } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  calculateAcceptingStatus,
  calculateVerificationCount,
  isStale,
  staleDays,
} from "@/lib/verification";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Rate limit
  const rl = rateLimit(`verify:${user.id}`, { maxRequests: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Validate body
  const body = await request.json();
  const parsed = verificationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Check doctor exists
  const doctor = await prisma.doctor.findUnique({ where: { id } });
  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  // Insert verification
  await prisma.verification.create({
    data: {
      doctorId: id,
      userId: user.id,
      reportedStatus: parsed.data.reported_status,
      howConfirmed: parsed.data.how_confirmed,
      notes: parsed.data.notes,
    },
  });

  // Get relevant verifications for recalculation
  const recentVerifications = await prisma.verification.findMany({
    where: { doctorId: id },
    orderBy: { createdAt: "desc" },
    select: {
      reportedStatus: true,
      createdAt: true,
    },
    take: 20,
  });

  // Recalculate
  const newStatus = calculateAcceptingStatus(
    recentVerifications as { reportedStatus: typeof doctor.acceptingStatus; createdAt: Date }[]
  );

  const statusChanged = newStatus && newStatus !== doctor.acceptingStatus;
  let alertsTriggered = 0;

  if (newStatus) {
    const verificationCount = calculateVerificationCount(
      recentVerifications as { reportedStatus: typeof doctor.acceptingStatus; createdAt: Date }[],
      newStatus
    );

    await prisma.doctor.update({
      where: { id },
      data: {
        acceptingStatus: newStatus,
        lastVerified: new Date(),
        verificationCount,
      },
    });

    // If status flipped to accepting, fire alerts
    if (statusChanged && newStatus === "accepting") {
      // Query matching alerts (simplified — in production, enqueue to background job)
      const matchingAlerts = await prisma.alert.findMany({
        where: {
          alertType: "doctor",
          OR: [
            { targetId: id },
            // Postal code alerts would need geo matching — simplified for now
          ],
        },
        select: { id: true, userId: true },
      });

      alertsTriggered = matchingAlerts.length;

      // Mark alerts as notified
      if (matchingAlerts.length > 0) {
        await prisma.alert.updateMany({
          where: { id: { in: matchingAlerts.map((a) => a.id) } },
          data: { lastNotifiedAt: new Date() },
        });
      }

      // TODO: Dispatch emails via Resend in a background job
    }
  }

  // Fetch updated doctor
  const updatedDoctor = await prisma.doctor.findUnique({
    where: { id },
    select: {
      id: true,
      acceptingStatus: true,
      lastVerified: true,
      verificationCount: true,
    },
  });

  return NextResponse.json({
    verified: true,
    doctor: {
      ...updatedDoctor,
      verification: {
        last_verified: updatedDoctor!.lastVerified,
        verification_count: updatedDoctor!.verificationCount,
        is_stale: isStale(updatedDoctor!.lastVerified),
        stale_days: staleDays(updatedDoctor!.lastVerified),
      },
    },
    alerts_triggered: alertsTriggered,
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/doctors/
git commit -m "feat: add doctor API routes (search, detail, verify) with verification logic"
```

---

## Task 12: API Route — Alerts + Auth

**Files:**
- Create: `src/app/api/alerts/route.ts`
- Create: `src/app/api/alerts/[id]/route.ts`
- Create: `src/app/api/auth/session/route.ts`
- Create: `src/app/api/auth/callback/route.ts`

- [ ] **Step 1: Create `src/app/api/alerts/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { alertCreateSchema } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

const MAX_ALERTS = 5;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where: { userId: user.id },
      include: {
        doctor: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.alert.count({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({
    results: alerts.map((a) => ({
      id: a.id,
      alert_type: a.alertType,
      target_id: a.targetId,
      doctor_name: a.doctor?.name ?? null,
      postal_code: a.postalCode,
      radius_km: a.radiusKm,
      doctor_type_filter: a.doctorTypeFilter,
      language_filter: a.languageFilter,
      last_notified_at: a.lastNotifiedAt?.toISOString() ?? null,
      created_at: a.createdAt.toISOString(),
    })),
    total,
    limit,
    offset,
    max_alerts: MAX_ALERTS,
    remaining: Math.max(0, MAX_ALERTS - total),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const rl = rateLimit(`alerts:${user.id}`, { maxRequests: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Check alert limit
  const currentCount = await prisma.alert.count({ where: { userId: user.id } });
  if (currentCount >= MAX_ALERTS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_ALERTS} alerts allowed on the free tier` },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = alertCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const alert = await prisma.alert.create({
    data: {
      userId: user.id,
      alertType: parsed.data.alert_type,
      targetId: parsed.data.target_id,
      postalCode: parsed.data.postal_code,
      radiusKm: parsed.data.radius_km,
      doctorTypeFilter: parsed.data.doctor_type_filter,
      languageFilter: parsed.data.language_filter,
    },
  });

  return NextResponse.json(alert, { status: 201 });
}
```

- [ ] **Step 2: Create `src/app/api/alerts/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;

  const alert = await prisma.alert.findUnique({ where: { id } });

  if (!alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  if (alert.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.alert.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
```

- [ ] **Step 3: Create `src/app/api/auth/session/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return NextResponse.json({
      authenticated: true,
      user: { id: user.id, email: user.email },
    });
  }

  return NextResponse.json({
    authenticated: false,
    user: null,
  });
}
```

- [ ] **Step 4: Create `src/app/api/auth/callback/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth_callback_error`);
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/alerts/ src/app/api/auth/
git commit -m "feat: add alerts API (list, create, delete) and auth session/callback routes"
```

---

## Task 13: Cron API Routes

**Files:**
- Create: `src/app/api/cron/refresh-er-waits/route.ts`
- Create: `src/app/api/cron/refresh-clinics/route.ts`
- Create: `src/app/api/cron/expire-verifications/route.ts`

- [ ] **Step 1: Create `src/app/api/cron/refresh-er-waits/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(
      "https://data.ontario.ca/api/3/action/datastore_search?resource_id=wait-time-information-system&limit=1000",
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Ontario data API returned ${response.status}`);
    }

    const data = await response.json();
    const records = data.result?.records ?? [];

    let updated = 0;
    const now = new Date();

    for (const record of records) {
      if (!record.hospital_name || !record.latitude || !record.longitude) continue;

      await prisma.$executeRawUnsafe(
        `INSERT INTO er_wait_times (hospital_name, coords, wait_time_min, urgency_level, last_updated, fetched_at)
         VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        record.hospital_name,
        parseFloat(record.longitude),
        parseFloat(record.latitude),
        parseInt(record.wait_time_minutes) || 0,
        record.urgency_level ?? "unknown",
        record.last_updated ? new Date(record.last_updated) : now,
        now
      );
      updated++;
    }

    return NextResponse.json({
      refreshed: true,
      hospitals_updated: updated,
      fetched_at: now.toISOString(),
    });
  } catch (error) {
    console.error("ER wait refresh failed:", error);
    return NextResponse.json(
      { error: "Upstream source unavailable", details: String(error) },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 2: Create `src/app/api/cron/refresh-clinics/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all clinics with a Google Place ID
  const clinics = await prisma.clinic.findMany({
    where: { googlePlaceId: { not: null } },
    select: { id: true, googlePlaceId: true },
  });

  let updated = 0;
  let failed = 0;
  const FIELDS = "regularOpeningHours";

  for (const clinic of clinics) {
    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${clinic.googlePlaceId}`,
        {
          headers: {
            "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY!,
            "X-Goog-FieldMask": FIELDS,
          },
        }
      );

      if (!response.ok) {
        failed++;
        continue;
      }

      const data = await response.json();
      const periods = data.regularOpeningHours?.periods ?? [];

      // Compute booleans from periods
      let openSaturday = false;
      let openSunday = false;
      let openAfter6pm = false;

      const hoursJson: Record<string, { open: string; close: string }> = {};

      for (const period of periods) {
        if (!period.open || !period.close) continue;

        const day = period.open.day;
        const openTime = `${String(period.open.hour).padStart(2, "0")}:${String(period.open.minute).padStart(2, "0")}`;
        const closeTime = `${String(period.close.hour).padStart(2, "0")}:${String(period.close.minute).padStart(2, "0")}`;

        hoursJson[day.toString()] = { open: openTime, close: closeTime };

        if (day === 6) openSaturday = true;
        if (day === 0) openSunday = true;
        if (day >= 1 && day <= 5 && period.close.hour >= 18) openAfter6pm = true;
      }

      await prisma.clinic.update({
        where: { id: clinic.id },
        data: {
          hours: hoursJson,
          openSaturday,
          openSunday,
          openAfter6pm,
        },
      });

      updated++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    refreshed: true,
    clinics_updated: updated,
    clinics_failed: failed,
    fetched_at: new Date().toISOString(),
  });
}
```

- [ ] **Step 3: Create `src/app/api/cron/expire-verifications/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { UNKNOWN_THRESHOLD_DAYS } from "@/lib/verification";

export async function POST(request: Request) {
  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - UNKNOWN_THRESHOLD_DAYS);

  const result = await prisma.doctor.updateMany({
    where: {
      acceptingStatus: { not: "unknown" },
      OR: [
        { lastVerified: null },
        { lastVerified: { lt: cutoff } },
      ],
    },
    data: {
      acceptingStatus: "unknown",
    },
  });

  return NextResponse.json({
    expired: true,
    doctors_reverted: result.count,
    fetched_at: new Date().toISOString(),
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/
git commit -m "feat: add cron API routes (ER wait refresh, clinic refresh, verification expiry)"
```

---

## Task 14: Auth Components

**Files:**
- Create: `src/components/auth/AuthProvider.tsx`
- Create: `src/components/auth/LoginButton.tsx`
- Modify: `src/app/layout.tsx` — wrap with AuthProvider

- [ ] **Step 1: Create `src/components/auth/AuthProvider.tsx`**

```typescript
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        router.refresh();
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

- [ ] **Step 2: Create `src/components/auth/LoginButton.tsx`**

```typescript
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useAuth } from "./AuthProvider";

export function LoginButton() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return <div className="h-9 w-20 animate-pulse rounded bg-zinc-200" />;
  }

  if (user) {
    return (
      <button
        onClick={signOut}
        className="rounded-full px-4 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
      >
        Sign Out
      </button>
    );
  }

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return (
    <button
      onClick={() =>
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${location.origin}/api/auth/callback` },
        })
      }
      className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
    >
      Sign In
    </button>
  );
}
```

- [ ] **Step 3: Update `src/app/layout.tsx`** — wrap with AuthProvider

Read current `src/app/layout.tsx` and update to:

```typescript
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KidsCare Ontario",
  description: "Find pediatricians, walk-in clinics, and ER wait times for your child in Ontario.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/auth/ src/app/layout.tsx
git commit -m "feat: add AuthProvider, LoginButton, and wire into root layout"
```

---

## Task 15: UI Primitives

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Input.tsx`
- Create: `src/components/ui/Badge.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Skeleton.tsx`

- [ ] **Step 1: Create all UI primitive components**

Write `src/components/ui/Button.tsx`:
```typescript
import { forwardRef } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", ...props }, ref) => {
    const base = "inline-flex items-center justify-center rounded-full font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:opacity-50 disabled:pointer-events-none";

    const variants: Record<string, string> = {
      primary: "bg-black text-white hover:bg-zinc-800",
      secondary: "border border-zinc-300 text-zinc-700 hover:bg-zinc-50",
      ghost: "text-zinc-600 hover:bg-zinc-100",
    };

    const sizes: Record<string, string> = {
      sm: "h-8 px-3 text-sm",
      md: "h-10 px-5 text-sm",
      lg: "h-12 px-6 text-base",
    };

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
```

Write `src/components/ui/Input.tsx`:
```typescript
import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-zinc-700">{label}</label>
      )}
      <input
        ref={ref}
        className={`h-10 rounded-lg border border-zinc-300 px-3 text-base placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black ${error ? "border-red-500" : ""} ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
);

Input.displayName = "Input";
```

Write `src/components/ui/Badge.tsx`:
```typescript
interface BadgeProps {
  variant?: "green" | "amber" | "red" | "neutral" | "blue";
  children: React.ReactNode;
}

const variants: Record<string, string> = {
  green: "bg-green-50 text-green-700 ring-green-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  neutral: "bg-zinc-50 text-zinc-600 ring-zinc-500/20",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
};

export function Badge({ variant = "neutral", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${variants[variant]}`}
    >
      {children}
    </span>
  );
}
```

Write `src/components/ui/Card.tsx`:
```typescript
interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = "", onClick }: CardProps) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      onClick={onClick as any}
      className={`w-full rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md ${className}`}
    >
      {children}
    </Component>
  );
}
```

Write `src/components/ui/Skeleton.tsx`:
```typescript
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-zinc-200 ${className}`}
      aria-hidden="true"
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/
git commit -m "feat: add UI primitives (Button, Input, Badge, Card, Skeleton)"
```

---

## Task 16: Shared Badge Components

**Files:**
- Create: `src/components/shared/VerificationBadge.tsx`
- Create: `src/components/shared/StatusBadge.tsx`
- Create: `src/components/shared/ReferralBadge.tsx`
- Create: `src/components/shared/OpenNowBadge.tsx`
- Create: `src/components/shared/WeekendBadge.tsx`
- Create: `src/components/shared/StalenessWarning.tsx`
- Create: `src/components/shared/DistanceDisplay.tsx`

- [ ] **Step 1: Create all shared badge components**

Write `src/components/shared/VerificationBadge.tsx`:
```typescript
import { Badge } from "@/components/ui/Badge";

interface VerificationBadgeProps {
  verificationCount: number;
  staleDays: number | null;
}

export function VerificationBadge({ verificationCount, staleDays }: VerificationBadgeProps) {
  if (verificationCount === 0) {
    return <Badge variant="neutral">No community data yet</Badge>;
  }

  if (staleDays === null) {
    return <Badge variant="neutral">Not verified</Badge>;
  }

  const variant = staleDays > 30 ? "red" : "green";
  const parentWord = verificationCount === 1 ? "parent" : "parents";

  return (
    <Badge variant={variant}>
      Confirmed by {verificationCount} {parentWord} · {staleDays} {staleDays === 1 ? "day" : "days"} ago
    </Badge>
  );
}
```

Write `src/components/shared/StatusBadge.tsx`:
```typescript
import { Badge } from "@/components/ui/Badge";
import type { AcceptingStatus } from "@/types";

const config: Record<AcceptingStatus, { label: string; variant: "green" | "amber" | "red" | "neutral" }> = {
  accepting: { label: "Accepting patients", variant: "green" },
  waitlist: { label: "Waitlist only", variant: "amber" },
  not_accepting: { label: "Not accepting", variant: "red" },
  unknown: { label: "Status unknown", variant: "neutral" },
};

export function StatusBadge({ status }: { status: AcceptingStatus }) {
  const { label, variant } = config[status];
  return <Badge variant={variant}>{label}</Badge>;
}
```

Write `src/components/shared/ReferralBadge.tsx`:
```typescript
import { Badge } from "@/components/ui/Badge";

export function ReferralBadge({ required }: { required: boolean }) {
  if (required) {
    return <Badge variant="amber">Referral required</Badge>;
  }
  return <Badge variant="green">No referral needed</Badge>;
}
```

Write `src/components/shared/OpenNowBadge.tsx`:
```typescript
import { Badge } from "@/components/ui/Badge";

export function OpenNowBadge({ isOpen }: { isOpen: boolean }) {
  return isOpen
    ? <Badge variant="green">Open now</Badge>
    : <Badge variant="red">Closed</Badge>;
}
```

Write `src/components/shared/WeekendBadge.tsx`:
```typescript
interface WeekendBadgeProps {
  openSaturday: boolean;
  openSunday: boolean;
  openAfter6pm: boolean;
}

export function WeekendBadge({ openSaturday, openSunday, openAfter6pm }: WeekendBadgeProps) {
  const badges: string[] = [];

  if (openAfter6pm) badges.push("Open after 6pm");
  if (openSaturday) badges.push("Open Saturday");
  if (openSunday) badges.push("Open Sunday");

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((label) => (
        <span
          key={label}
          className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20"
        >
          {label}
        </span>
      ))}
    </div>
  );
}
```

Write `src/components/shared/StalenessWarning.tsx`:
```typescript
interface StalenessWarningProps {
  staleDays: number | null;
  lastVerified: string | null;
}

export function StalenessWarning({ staleDays, lastVerified }: StalenessWarningProps) {
  if (lastVerified === null) {
    return (
      <p className="text-sm text-zinc-500">
        No community data yet — be the first to verify
      </p>
    );
  }

  if (staleDays !== null && staleDays > 90) {
    return (
      <p className="text-sm text-red-600">
        Last confirmed {staleDays} days ago — may be outdated. Tap to verify.
      </p>
    );
  }

  if (staleDays !== null && staleDays > 30) {
    return (
      <p className="text-sm text-amber-600">
        Last confirmed {staleDays} days ago — may be outdated
      </p>
    );
  }

  return null;
}
```

Write `src/components/shared/DistanceDisplay.tsx`:
```typescript
export function DistanceDisplay({ km }: { km: number }) {
  if (km < 1) {
    return <span className="text-sm text-zinc-500">{(km * 1000).toFixed(0)}m away</span>;
  }
  return <span className="text-sm text-zinc-500">{km.toFixed(1)} km away</span>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/
git commit -m "feat: add shared badge components (VerificationBadge, StatusBadge, ReferralBadge, OpenNowBadge, WeekendBadge, StalenessWarning, DistanceDisplay)"
```

---

## Task 17: Layout Components

**Files:**
- Create: `src/components/layout/Header.tsx`
- Create: `src/components/layout/MobileNav.tsx`
- Create: `src/components/layout/SearchBar.tsx`

- [ ] **Step 1: Create layout components**

Write `src/components/layout/Header.tsx`:
```typescript
import Link from "next/link";
import { LoginButton } from "@/components/auth/LoginButton";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          KidsCare Ontario
        </Link>
        <LoginButton />
      </div>
    </header>
  );
}
```

Write `src/components/layout/MobileNav.tsx`:
```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/urgent", label: "Urgent Care" },
  { href: "/pediatricians", label: "Find Doctor" },
  { href: "/alerts", label: "Alerts" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white md:hidden">
      <div className="flex h-14 items-center justify-around">
        {links.map(({ href, label }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium ${
                active ? "text-black" : "text-zinc-400"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

Write `src/components/layout/SearchBar.tsx`:
```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { isValidPostalCode, normalizePostalCode } from "@/lib/utils";

export function SearchBar({ basePath }: { basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("postal") ?? "");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();

    if (!trimmed) {
      setError("Enter a postal code");
      return;
    }

    if (!isValidPostalCode(trimmed)) {
      setError("Enter a valid postal code (e.g., M5V 2T6)");
      return;
    }

    setError("");
    const normalized = normalizePostalCode(trimmed);
    router.push(`${basePath}?postal=${normalized}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        placeholder="Postal code (e.g., M5V 2T6)"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError("");
        }}
        error={error}
        className="flex-1"
      />
      <Button type="submit">Search</Button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/
git commit -m "feat: add layout components (Header, MobileNav, SearchBar)"
```

---

## Task 18: Feature Component Stubs

**Files:**
- Create: `src/components/clinic/ClinicCard.tsx`
- Create: `src/components/clinic/ClinicList.tsx`
- Create: `src/components/clinic/ClinicFilters.tsx`
- Create: `src/components/clinic/ClinicMapView.tsx`
- Create: `src/components/doctor/DoctorCard.tsx`
- Create: `src/components/doctor/DoctorList.tsx`
- Create: `src/components/doctor/DoctorFilters.tsx`
- Create: `src/components/doctor/DoctorProfile.tsx`
- Create: `src/components/doctor/VerifyForm.tsx`
- Create: `src/components/alert/AlertCard.tsx`
- Create: `src/components/alert/AlertList.tsx`
- Create: `src/components/alert/AlertForm.tsx`

- [ ] **Step 1: Create clinic components**

Write `src/components/clinic/ClinicCard.tsx`:
```typescript
import { Card } from "@/components/ui/Card";
import { OpenNowBadge } from "@/components/shared/OpenNowBadge";
import { WeekendBadge } from "@/components/shared/WeekendBadge";
import { DistanceDisplay } from "@/components/shared/DistanceDisplay";

interface ClinicCardProps {
  clinic: {
    id: string;
    name: string;
    address: string;
    distance_km: number;
    phone: string | null;
    sees_children: boolean;
    open_saturday: boolean;
    open_sunday: boolean;
    open_after_6pm: boolean;
    is_open_now: boolean;
  };
}

export function ClinicCard({ clinic }: ClinicCardProps) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-zinc-900">{clinic.name}</h3>
        <OpenNowBadge isOpen={clinic.is_open_now} />
      </div>
      <p className="text-sm text-zinc-600">{clinic.address}</p>
      <DistanceDisplay km={clinic.distance_km} />
      <WeekendBadge
        openSaturday={clinic.open_saturday}
        openSunday={clinic.open_sunday}
        openAfter6pm={clinic.open_after_6pm}
      />
      {clinic.phone && (
        <a href={`tel:${clinic.phone}`} className="text-sm font-medium text-blue-600 hover:underline">
          {clinic.phone}
        </a>
      )}
    </Card>
  );
}
```

Write `src/components/clinic/ClinicList.tsx`:
```typescript
"use client";

import { ClinicCard } from "./ClinicCard";

interface Clinic {
  id: string;
  name: string;
  address: string;
  distance_km: number;
  phone: string | null;
  sees_children: boolean;
  open_saturday: boolean;
  open_sunday: boolean;
  open_after_6pm: boolean;
  is_open_now: boolean;
}

interface ClinicListProps {
  clinics: Clinic[];
}

export function ClinicList({ clinics }: ClinicListProps) {
  if (clinics.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-zinc-500">No clinics found. Try expanding your search radius.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {clinics.map((clinic) => (
        <ClinicCard key={clinic.id} clinic={clinic} />
      ))}
    </div>
  );
}
```

Write `src/components/clinic/ClinicFilters.tsx`:
```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";

const FILTERS = [
  { key: "open_now", label: "Open now" },
  { key: "sees_children", label: "Sees children" },
  { key: "open_saturday", label: "Open Saturday" },
  { key: "open_sunday", label: "Open Sunday" },
  { key: "open_after_6pm", label: "Open after 6pm" },
] as const;

export function ClinicFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function toggleFilter(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get(key) === "true") {
      params.delete(key);
    } else {
      params.set(key, "true");
    }
    router.push(`/urgent?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map(({ key, label }) => {
        const active = searchParams.get(key) === "true";
        return (
          <button
            key={key}
            onClick={() => toggleFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-black text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
```

Write `src/components/clinic/ClinicMapView.tsx`:
```typescript
"use client";

interface ClinicMapViewProps {
  clinics: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
  }>;
}

export function ClinicMapView({ clinics }: ClinicMapViewProps) {
  // Leaflet integration placeholder — Week 2
  return (
    <div className="flex h-64 items-center justify-center rounded-xl bg-zinc-100 md:h-full">
      <p className="text-sm text-zinc-500">
        Map view — {clinics.length} clinics loaded
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create doctor components**

Write `src/components/doctor/DoctorCard.tsx`:
```typescript
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReferralBadge } from "@/components/shared/ReferralBadge";
import { VerificationBadge } from "@/components/shared/VerificationBadge";
import { StalenessWarning } from "@/components/shared/StalenessWarning";
import { DistanceDisplay } from "@/components/shared/DistanceDisplay";

interface DoctorCardProps {
  doctor: {
    id: string;
    name: string;
    doctor_type: string;
    referral_required: boolean;
    accepting_status: "accepting" | "waitlist" | "not_accepting" | "unknown";
    languages: string[];
    address: string;
    distance_km: number;
    verification: {
      verification_count: number;
      stale_days: number | null;
    };
  };
}

export function DoctorCard({ doctor }: DoctorCardProps) {
  return (
    <Link href={`/pediatricians/${doctor.id}`}>
      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-zinc-900">{doctor.name}</h3>
          <StatusBadge status={doctor.accepting_status} />
          <ReferralBadge required={doctor.referral_required} />
        </div>
        <p className="text-sm text-zinc-600">{doctor.address}</p>
        <DistanceDisplay km={doctor.distance_km} />
        {doctor.languages.length > 0 && (
          <p className="text-sm text-zinc-500">
            {doctor.languages.join(", ")}
          </p>
        )}
        <VerificationBadge
          verificationCount={doctor.verification.verification_count}
          staleDays={doctor.verification.stale_days}
        />
        <StalenessWarning
          staleDays={doctor.verification.stale_days}
          lastVerified={null}
        />
      </Card>
    </Link>
  );
}
```

Write `src/components/doctor/DoctorList.tsx`:
```typescript
"use client";

import { DoctorCard } from "./DoctorCard";

interface Doctor {
  id: string;
  name: string;
  doctor_type: string;
  referral_required: boolean;
  accepting_status: "accepting" | "waitlist" | "not_accepting" | "unknown";
  languages: string[];
  address: string;
  distance_km: number;
  verification: {
    verification_count: number;
    stale_days: number | null;
  };
}

interface DoctorListProps {
  doctors: Doctor[];
}

export function DoctorList({ doctors }: DoctorListProps) {
  if (doctors.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-zinc-500">No doctors found. Try expanding your search or adjusting filters.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {doctors.map((doctor) => (
        <DoctorCard key={doctor.id} doctor={doctor} />
      ))}
    </div>
  );
}
```

Write `src/components/doctor/DoctorFilters.tsx`:
```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function DoctorFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/pediatricians?${params.toString()}`);
  }

  const activeType = searchParams.get("doctor_type");
  const activeStatus = searchParams.get("accepting_status");
  const activeReferral = searchParams.get("referral_required");

  return (
    <div className="flex flex-col gap-3">
      <select
        value={activeType ?? ""}
        onChange={(e) => setParam("doctor_type", e.target.value || null)}
        className="h-10 rounded-lg border border-zinc-300 px-3 text-sm"
      >
        <option value="">All doctor types</option>
        <option value="pediatrician_primary">Primary care pediatrician</option>
        <option value="pediatrician_specialist">Specialist pediatrician</option>
        <option value="family_doctor">Family doctor</option>
      </select>

      <select
        value={activeStatus ?? ""}
        onChange={(e) => setParam("accepting_status", e.target.value || null)}
        className="h-10 rounded-lg border border-zinc-300 px-3 text-sm"
      >
        <option value="">Any status</option>
        <option value="accepting">Accepting patients</option>
        <option value="waitlist">Waitlist only</option>
        <option value="not_accepting">Not accepting</option>
      </select>

      <select
        value={activeReferral ?? ""}
        onChange={(e) => setParam("referral_required", e.target.value || null)}
        className="h-10 rounded-lg border border-zinc-300 px-3 text-sm"
      >
        <option value="">Any referral requirement</option>
        <option value="false">No referral needed</option>
        <option value="true">Referral required</option>
      </select>
    </div>
  );
}
```

Write `src/components/doctor/DoctorProfile.tsx`:
```typescript
"use client";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReferralBadge } from "@/components/shared/ReferralBadge";
import { VerificationBadge } from "@/components/shared/VerificationBadge";
import { StalenessWarning } from "@/components/shared/StalenessWarning";

interface DoctorProfileProps {
  doctor: {
    name: string;
    specialty: string | null;
    doctor_type: string;
    referral_required: boolean;
    accepting_status: "accepting" | "waitlist" | "not_accepting" | "unknown";
    languages: string[];
    address: string;
    phone: string | null;
    website: string | null;
    virtual_visits_available: boolean;
    verification: {
      verification_count: number;
      stale_days: number | null;
      last_verified: string | null;
    };
  };
}

export function DoctorProfile({ doctor }: DoctorProfileProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{doctor.name}</h1>
        {doctor.specialty && (
          <p className="text-zinc-600">{doctor.specialty}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusBadge status={doctor.accepting_status} />
        <ReferralBadge required={doctor.referral_required} />
      </div>

      <VerificationBadge
        verificationCount={doctor.verification.verification_count}
        staleDays={doctor.verification.stale_days}
      />
      <StalenessWarning
        staleDays={doctor.verification.stale_days}
        lastVerified={doctor.verification.last_verified}
      />

      <div className="space-y-2 text-sm text-zinc-600">
        <p>{doctor.address}</p>
        {doctor.phone && <p>Phone: {doctor.phone}</p>}
        {doctor.website && (
          <a href={doctor.website} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
            Website
          </a>
        )}
        {doctor.languages.length > 0 && (
          <p>Languages: {doctor.languages.join(", ")}</p>
        )}
        {doctor.virtual_visits_available && (
          <p className="text-green-600">Virtual visits available</p>
        )}
      </div>
    </div>
  );
}
```

Write `src/components/doctor/VerifyForm.tsx`:
```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface VerifyFormProps {
  doctorId: string;
}

export function VerifyForm({ doctorId }: VerifyFormProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"accepting" | "waitlist" | "not_accepting">("accepting");
  const [method, setMethod] = useState<"called_office" | "visited_in_person" | "received_appointment" | "told_by_receptionist">("called_office");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const res = await fetch(`/api/doctors/${doctorId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reported_status: status, how_confirmed: method, notes: notes || undefined }),
    });

    if (res.ok) {
      setOpen(false);
      window.location.reload();
    }

    setSubmitting(false);
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Is this accurate? Tap to verify
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4">
      <h3 className="font-semibold">How did you confirm this?</h3>

      <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-10 rounded-lg border border-zinc-300 px-3 text-sm">
        <option value="accepting">Doctor is accepting new patients</option>
        <option value="waitlist">Doctor has a waitlist</option>
        <option value="not_accepting">Doctor is not accepting</option>
      </select>

      <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className="h-10 rounded-lg border border-zinc-300 px-3 text-sm">
        <option value="called_office">I called the office</option>
        <option value="visited_in_person">I visited in person</option>
        <option value="received_appointment">I received an appointment</option>
        <option value="told_by_receptionist">Receptionist told me</option>
      </select>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional: any notes (e.g., 'they said call back in January')"
        className="min-h-[60px] rounded-lg border border-zinc-300 p-3 text-sm"
        maxLength={500}
      />

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Verification"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Create alert components**

Write `src/components/alert/AlertCard.tsx`:
```typescript
interface AlertCardProps {
  alert: {
    id: string;
    doctor_name: string | null;
    postal_code: string | null;
    radius_km: number;
    created_at: string;
  };
  onDelete: (id: string) => void;
}

export function AlertCard({ alert, onDelete }: AlertCardProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-4">
      <div>
        <p className="font-medium">
          {alert.doctor_name ?? `Any doctor near ${alert.postal_code}`}
        </p>
        <p className="text-sm text-zinc-500">
          Within {alert.radius_km}km · Created {new Date(alert.created_at).toLocaleDateString()}
        </p>
      </div>
      <button
        onClick={() => onDelete(alert.id)}
        className="text-sm font-medium text-red-600 hover:underline"
      >
        Delete
      </button>
    </div>
  );
}
```

Write `src/components/alert/AlertList.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCard } from "./AlertCard";

interface Alert {
  id: string;
  doctor_name: string | null;
  postal_code: string | null;
  radius_km: number;
  created_at: string;
}

interface AlertListProps {
  alerts: Alert[];
}

export function AlertList({ alerts }: AlertListProps) {
  const router = useRouter();

  async function handleDelete(id: string) {
    const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  if (alerts.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-zinc-500">No alerts yet. Subscribe to get notified when a pediatrician opens their roster.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} onDelete={handleDelete} />
      ))}
    </div>
  );
}
```

Write `src/components/alert/AlertForm.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { isValidPostalCode, normalizePostalCode } from "@/lib/utils";

export function AlertForm() {
  const router = useRouter();
  const [postalCode, setPostalCode] = useState("");
  const [radius, setRadius] = useState(10);
  const [type, setType] = useState<"pediatrician_primary" | "family_doctor" | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isValidPostalCode(postalCode)) {
      setError("Enter a valid postal code");
      return;
    }

    setSubmitting(true);
    setError("");

    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alert_type: "doctor",
        postal_code: normalizePostalCode(postalCode),
        radius_km: radius,
        doctor_type_filter: type || undefined,
      }),
    });

    if (res.ok) {
      router.push("/alerts");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
    }

    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        label="Postal code"
        placeholder="M5V 2T6"
        value={postalCode}
        onChange={(e) => { setPostalCode(e.target.value); setError(""); }}
        error={error}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">Radius (km)</label>
        <input
          type="range"
          min={5}
          max={50}
          step={5}
          value={radius}
          onChange={(e) => setRadius(parseInt(e.target.value))}
          className="w-full"
        />
        <span className="text-sm text-zinc-500">{radius} km</span>
      </div>

      <select
        value={type}
        onChange={(e) => setType(e.target.value as typeof type)}
        className="h-10 rounded-lg border border-zinc-300 px-3 text-sm"
      >
        <option value="">Any doctor type</option>
        <option value="pediatrician_primary">Primary care pediatrician</option>
        <option value="family_doctor">Family doctor</option>
      </select>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Creating..." : "Create Alert"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/clinic/ src/components/doctor/ src/components/alert/
git commit -m "feat: add feature component stubs (clinic, doctor, alert cards/lists/filters/forms)"
```

---

## Task 19: Page Stubs

**Files:**
- Modify: `src/app/page.tsx` — home page
- Create: `src/app/urgent/page.tsx`
- Create: `src/app/urgent/layout.tsx`
- Create: `src/app/pediatricians/page.tsx`
- Create: `src/app/pediatricians/layout.tsx`
- Create: `src/app/pediatricians/[id]/page.tsx`
- Create: `src/app/alerts/page.tsx`
- Create: `src/app/alerts/layout.tsx`
- Create: `src/app/alerts/manage/page.tsx`

- [ ] **Step 1: Create home page**

Write `src/app/page.tsx`:
```typescript
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1 px-4 py-8 pb-20 md:pb-8">
        <div className="mx-auto max-w-lg space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
              KidsCare Ontario
            </h1>
            <p className="text-lg text-zinc-600">
              Find pediatricians, walk-in clinics, and ER wait times for your child.
            </p>
          </div>

          <div className="grid gap-4">
            <Link
              href="/urgent"
              className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 p-6 transition-shadow hover:shadow-md"
            >
              <h2 className="text-xl font-semibold text-red-800">
                Urgent Care
              </h2>
              <p className="text-red-600">
                Find walk-in clinics that see children, open now. ER wait times. Virtual care options.
              </p>
            </Link>

            <Link
              href="/pediatricians"
              className="flex flex-col gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-6 transition-shadow hover:shadow-md"
            >
              <h2 className="text-xl font-semibold text-blue-800">
                Find a Doctor
              </h2>
              <p className="text-blue-600">
                Search pediatricians accepting new patients. See who needs a referral. Get roster alerts.
              </p>
            </Link>
          </div>
        </div>
      </main>
      <MobileNav />
    </>
  );
}
```

- [ ] **Step 2: Create urgent care pages**

Write `src/app/urgent/layout.tsx`:
```typescript
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";

export default function UrgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1 px-4 py-6 pb-20 md:pb-6">{children}</main>
      <MobileNav />
    </>
  );
}
```

Write `src/app/urgent/page.tsx`:
```typescript
import { Suspense } from "react";
import { SearchBar } from "@/components/layout/SearchBar";
import { ClinicList } from "@/components/clinic/ClinicList";
import { ClinicFilters } from "@/components/clinic/ClinicFilters";
import { Skeleton } from "@/components/ui/Skeleton";

export default function UrgentPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Urgent Care</h1>
        <p className="text-zinc-600">Find walk-in clinics, ER wait times, and virtual care near you.</p>
      </div>

      <SearchBar basePath="/urgent" />
      <ClinicFilters />

      <Suspense fallback={<Skeleton className="h-48" />}>
        <ClinicResults />
      </Suspense>
    </div>
  );
}

async function ClinicResults() {
  // Placeholder — will be wired to search params + API in Week 2
  return (
    <ClinicList clinics={[]} />
  );
}
```

- [ ] **Step 3: Create pediatrician pages**

Write `src/app/pediatricians/layout.tsx`:
```typescript
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";

export default function PediatriciansLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1 px-4 py-6 pb-20 md:pb-6">{children}</main>
      <MobileNav />
    </>
  );
}
```

Write `src/app/pediatricians/page.tsx`:
```typescript
import { Suspense } from "react";
import { SearchBar } from "@/components/layout/SearchBar";
import { DoctorList } from "@/components/doctor/DoctorList";
import { DoctorFilters } from "@/components/doctor/DoctorFilters";
import { Skeleton } from "@/components/ui/Skeleton";

export default function PediatriciansPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Find a Pediatrician</h1>
        <p className="text-zinc-600">
          Search pediatricians and family doctors near you. See who&apos;s accepting patients and whether you need a referral.
        </p>
      </div>

      <SearchBar basePath="/pediatricians" />
      <DoctorFilters />

      <Suspense fallback={<Skeleton className="h-48" />}>
        <DoctorResults />
      </Suspense>
    </div>
  );
}

async function DoctorResults() {
  return (
    <DoctorList doctors={[]} />
  );
}
```

Write `src/app/pediatricians/[id]/page.tsx`:
```typescript
import Link from "next/link";
import { DoctorProfile } from "@/components/doctor/DoctorProfile";
import { VerifyForm } from "@/components/doctor/VerifyForm";

export default async function DoctorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/pediatricians" className="text-sm text-zinc-500 hover:text-zinc-700">
        &larr; Back to search
      </Link>

      <DoctorProfile
        doctor={{
          name: "Loading...",
          specialty: null,
          doctor_type: "pediatrician_primary",
          referral_required: false,
          accepting_status: "unknown",
          languages: [],
          address: "",
          phone: null,
          website: null,
          virtual_visits_available: false,
          verification: {
            verification_count: 0,
            stale_days: null,
            last_verified: null,
          },
        }}
      />

      <VerifyForm doctorId={id} />
    </div>
  );
}
```

- [ ] **Step 4: Create alert pages**

Write `src/app/alerts/layout.tsx`:
```typescript
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";

export default function AlertsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1 px-4 py-6 pb-20 md:pb-6">{children}</main>
      <MobileNav />
    </>
  );
}
```

Write `src/app/alerts/page.tsx`:
```typescript
import Link from "next/link";
import { AlertList } from "@/components/alert/AlertList";
import { Button } from "@/components/ui/Button";

export default function AlertsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your Alerts</h1>
          <p className="text-zinc-600">Get notified when a pediatrician opens their roster.</p>
        </div>
        <Link href="/alerts/manage">
          <Button size="sm">New Alert</Button>
        </Link>
      </div>

      <AlertList alerts={[]} />
    </div>
  );
}
```

Write `src/app/alerts/manage/page.tsx`:
```typescript
import Link from "next/link";
import { AlertForm } from "@/components/alert/AlertForm";

export default function ManageAlertPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/alerts" className="text-sm text-zinc-500 hover:text-zinc-700">
        &larr; Back to alerts
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Create Alert</h1>
        <p className="text-zinc-600">
          We&apos;ll email you when a matching pediatrician opens their roster.
        </p>
      </div>

      <AlertForm />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/urgent/ src/app/pediatricians/ src/app/alerts/
git commit -m "feat: add page stubs for all v1 routes (home, urgent, pediatricians, alerts)"
```

---

## Task 20: Vitest Configuration

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 2: Verify tests run**

```bash
npx vitest run
```

Expected: Verification tests pass. Other tests may not exist yet.

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: add Vitest configuration"
```

---

## Task 21: vercel.json

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/refresh-er-waits",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/refresh-clinics",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/expire-verifications",
      "schedule": "0 4 * * *"
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "chore: add Vercel cron job configuration"
```

---

## Task 22: Seed Scripts

**Files:**
- Create: `scripts/seed-postal-codes.ts`
- Create: `scripts/seed-clinics.ts`

- [ ] **Step 1: Create `scripts/seed-postal-codes.ts`**

```typescript
// Run with: npx tsx scripts/seed-postal-codes.ts
// Downloads and seeds Ontario postal codes into the postal_codes table.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding postal codes...");

  // For v1: load from a local CSV file exported from an open dataset.
  // Expected CSV format: postal_code,lat,lng,city,province
  // Example source: geocoder.ca bulk data (free with attribution)

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
```

- [ ] **Step 2: Create `scripts/seed-clinics.ts`**

```typescript
// Run with: npx tsx scripts/seed-clinics.ts
// Fetches GTA walk-in clinics from Google Places API and seeds the clinics table.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Center of Toronto
const TORONTO_CENTER = { lat: 43.6532, lng: -79.3832 };

async function main() {
  console.log("Seeding GTA walk-in clinics from Google Places...");

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_MAPS_API_KEY environment variable is required");
    process.exit(1);
  }

  // Step 1: Nearby Search for walk-in clinics in Toronto area
  const searchUrl = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  searchUrl.searchParams.set("location", `${TORONTO_CENTER.lat},${TORONTO_CENTER.lng}`);
  searchUrl.searchParams.set("radius", "50000"); // 50km
  searchUrl.searchParams.set("type", "health");
  searchUrl.searchParams.set("keyword", "walk-in clinic");
  searchUrl.searchParams.set("key", apiKey);

  const searchResponse = await fetch(searchUrl.toString());
  const searchData = await searchResponse.json();

  if (searchData.status !== "OK" && searchData.status !== "ZERO_RESULTS") {
    console.error("Places API error:", searchData.status, searchData.error_message);
    process.exit(1);
  }

  const places = searchData.results ?? [];
  console.log(`Found ${places.length} potential clinics`);

  let inserted = 0;

  for (const place of places) {
    // Step 2: Get Place Details for hours
    const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    detailsUrl.searchParams.set("place_id", place.place_id);
    detailsUrl.searchParams.set("fields", "name,formatted_address,formatted_phone_number,geometry,opening_hours");
    detailsUrl.searchParams.set("key", apiKey);

    const detailsResponse = await fetch(detailsUrl.toString());
    const detailsData = await detailsResponse.json();

    if (detailsData.status !== "OK") {
      console.warn(`Skipping ${place.name}: details fetch failed (${detailsData.status})`);
      continue;
    }

    const details = detailsData.result;
    const periods = details.opening_hours?.periods ?? [];

    let openSaturday = false;
    let openSunday = false;
    let openAfter6pm = false;
    const hoursJson: Record<string, { open: string; close: string }> = {};

    for (const period of periods) {
      if (!period.open || !period.close) continue;

      const day = period.open.day;
      const openTime = `${String(period.open.hour).padStart(2, "0")}:${String(period.open.minute).padStart(2, "0")}`;
      const closeTime = `${String(period.close.hour).padStart(2, "0")}:${String(period.close.minute).padStart(2, "0")}`;

      hoursJson[day.toString()] = { open: openTime, close: closeTime };

      if (day === 6) openSaturday = true;
      if (day === 0) openSunday = true;
      if (day >= 1 && day <= 5 && period.close.hour >= 18) openAfter6pm = true;
    }

    const lat = details.geometry?.location?.lat;
    const lng = details.geometry?.location?.lng;

    if (!lat || !lng) continue;

    await prisma.$executeRawUnsafe(
      `INSERT INTO clinics (name, address, coords, phone, hours, open_saturday, open_sunday, open_after_6pm, google_place_id)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6::jsonb, $7, $8, $9, $10)
       ON CONFLICT DO NOTHING`,
      details.name ?? place.name,
      details.formatted_address ?? place.vicinity ?? "",
      lng,
      lat,
      details.formatted_phone_number ?? null,
      JSON.stringify(hoursJson),
      openSaturday,
      openSunday,
      openAfter6pm,
      place.place_id
    );

    inserted++;
    console.log(`Inserted: ${details.name ?? place.name}`);

    // Rate limit: 1 request/second to be respectful
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`Done. Total clinics inserted: ${inserted}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 3: Commit**

```bash
git add scripts/
git commit -m "feat: add seed scripts (postal codes, Google Places clinics)"
```

---

## Post-Task Verification

After all tasks complete, verify:

```bash
# Type check
npx tsc --noEmit

# Run tests
npx vitest run

# Build check
npm run build
```

All three should pass without errors.

---

## Week 1 Summary

| Task | Deliverable | Status |
|------|------------|--------|
| 1 | Dependencies installed | - [ ] |
| 2 | Environment variables configured | - [ ] |
| 3 | Prisma schema defined | - [ ] |
| 4 | Prisma client singleton | - [ ] |
| 5 | Shared library files (utils, geo, rate-limit, types) | - [ ] |
| 6 | Zod validation schemas | - [ ] |
| 7 | Verification logic + tests | - [ ] |
| 8 | ER wait times API endpoint | - [ ] |
| 9 | Clinic API endpoints (search, detail, flag) | - [ ] |
| 10 | Supabase server/client/middleware | - [ ] |
| 11 | Doctor API endpoints (search, detail, verify) | - [ ] |
| 12 | Alerts + auth API endpoints | - [ ] |
| 13 | Cron API endpoints | - [ ] |
| 14 | Auth components (AuthProvider, LoginButton) | - [ ] |
| 15 | UI primitives (Button, Input, Badge, Card, Skeleton) | - [ ] |
| 16 | Shared badge components | - [ ] |
| 17 | Layout components (Header, MobileNav, SearchBar) | - [ ] |
| 18 | Feature component stubs | - [ ] |
| 19 | Page stubs for all routes | - [ ] |
| 20 | Vitest configuration | - [ ] |
| 21 | Vercel cron configuration | - [ ] |
| 22 | Seed scripts (postal codes, clinics) | - [ ] |
