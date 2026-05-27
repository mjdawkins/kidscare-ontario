# KidsCare Ontario — Technical Specification

**Version:** 1.0
**Date:** 2026-05-26
**Phase:** v1 (Urgent Care Finder + Pediatrician Finder)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Vercel (Edge)                     │
│  ┌───────────────────────────────────────────────┐  │
│  │              Next.js 16 App Router             │  │
│  │  ┌─────────┐  ┌──────────┐  ┌────────────┐   │  │
│  │  │ Server   │  │ Client   │  │ API Routes │   │  │
│  │  │ Comps    │  │ Comps    │  │ (REST)     │   │  │
│  │  │ (RSC)    │  │ ('use    │  │            │   │  │
│  │  │          │  │ client') │  │            │   │  │
│  │  └────┬─────┘  └──────────┘  └─────┬──────┘   │  │
│  │       │                            │           │  │
│  └───────┼────────────────────────────┼───────────┘  │
│          │                            │              │
│     Vercel Cron                  Vercel Cron         │
│  (ER wait refresh)           (data pipelines)        │
└──────────┼────────────────────────────┼──────────────┘
           │                            │
    ┌──────▼────────────────────────────▼──────┐
    │              Supabase                     │
    │  ┌──────────┐  ┌──────────┐  ┌────────┐  │
    │  │PostgreSQL│  │   Auth   │  │  RLS   │  │
    │  │(PostGIS) │  │          │  │Policies│  │
    │  └──────────┘  └──────────┘  └────────┘  │
    └───────────────────────────────────────────┘
           │
    ┌──────▼──────────┐    ┌─────────────────────┐
    │  Google Places  │    │  Leaflet + OSM Tiles │
    │  (server-only,  │    │  (client-side map,   │
    │   cron seed)    │    │   free, no API key)  │
    └─────────────────┘    └─────────────────────┘
```

### Data Flow Per Feature

**Urgent Care Finder:**
1. User enters postal code or shares geolocation (client)
2. Server looks up postal code → lat/lng from `postal_codes` table (preloaded, no external API)
3. Server queries clinics table with PostGIS `ST_DWithin` for radius search
4. Server queries ER wait times from cache/table (≤15 min stale)
5. Results rendered on server, hydrated on client for interactivity
6. "Open right now" computed in database using hours JSONB

**Pediatrician Finder:**
1. User enters postal code, applies filters (accepting, referral, language)
2. Server looks up postal code in `postal_codes` table → coords
3. Server queries doctors table with PostGIS spatial join + filter WHERE clauses
4. Each doctor includes: verification_count, last_verified, referral_required, accepting_status, languages
5. Results rendered with VerificationBadge showing recency

**Community Verification:**
1. Logged-in user taps "Is this accurate?" on doctor card
2. Client POST to `/api/doctors/[id]/verify` with Zod-validated body
3. Server inserts verification record, recalculates accepting_status
4. If status flips to `accepting` → query alerts table for matches → enqueue notifications
5. Response returns updated doctor status

**Roster Alerts:**
1. User subscribes to doctor or postal code with optional filters
2. Alert record created with user_id, target, filters
3. On status change → matching alerts queried → Resend email dispatched async
4. `last_notified_at` updated on each alert after send

---

## 2. Tech Stack

### Runtime & Framework

| Component | Choice | Version | Why |
|-----------|--------|---------|-----|
| Runtime | Next.js | 16.2.6 | Already scaffolded. App Router for RSC, Vercel native. |
| Language | TypeScript | 5.x | Strict mode. Type safety from DB to UI. |
| React | React | 19.2.4 | Server Components, streaming, Suspense. |
| CSS | Tailwind CSS | v4 | Already installed. CSS-based config (no tailwind.config.ts). |

### Backend & Data

| Component | Choice | Why |
|-----------|--------|-----|
| Database | Supabase (PostgreSQL + PostGIS) | Managed Postgres with spatial queries. Built-in Auth and RLS. |
| ORM | Prisma | Type-safe queries. Migrations. Already specified in project docs. |
| Maps (display) | Leaflet + OpenStreetMap tiles (via OpenFreeMap) | Free, no API key, no usage limits. Sufficient for showing clinic/doctor markers. |
| Maps (clinic data) | Google Places API — server-side cron only | Best business-hours data. Used for seed + daily refresh, never per-user query. IP-restricted key, not exposed to client. |
| Geocoding | `postal_codes` lookup table | Preload Canadian postal code dataset into Postgres. No external API at query time. |
| Auth | Supabase Auth | Email + Google OAuth. Free tier sufficient for v1. |
| Email | Resend | Transactional email for roster alerts. |
| Job scheduling | Vercel Cron Jobs | Native to hosting platform. No separate worker infrastructure needed. |

### What We Excluded for v1

| Tool | Why excluded |
|------|-------------|
| BullMQ / Redis | Vercel serverless can't run persistent workers. Vercel Cron Jobs handle scheduled work. Async notifications go through a lightweight queue pattern or directly via Resend. |
| Zustand | Premature. Start with React context + URL search params for state. Add only if client state complexity demands it. |
| React Hook Form + Zod (client) | Premature for v1 form count. Zod is used server-side for API validation. Add client form library when we have enough forms to justify the dependency. |
| Stripe | Phase 3+. No payments in v1. |
| Expo Push Notifications | Phase 3+. Email-only alerts in v1. Push notifications require native app or PWA with service worker. |
| Playwright | Use cheerio for static pages first. Only introduce Playwright if scraping targets require JS rendering. Cheerio is lighter and works in serverless. |

---

## 3. Frontend Architecture

### Route Tree (App Router)

```
app/
├── layout.tsx                    # Root layout — metadata, fonts, providers
├── page.tsx                      # Home — "What does your child need?" (two CTAs)
├── (home)/
│   └── page.tsx                  # Same as above, route group for shared layout
├── urgent/
│   ├── layout.tsx                # Urgent care section layout (tabs: Clinics | ER | Virtual)
│   └── page.tsx                  # Clinic list with filters + map toggle
├── pediatricians/
│   ├── layout.tsx                # Pediatrician section layout
│   ├── page.tsx                  # Search + results list
│   └── [id]/
│       └── page.tsx              # Doctor detail/profile page
├── alerts/
│   ├── layout.tsx                # Authenticated layout (requireAuth)
│   ├── page.tsx                  # List of user's alerts
│   └── manage/
│       └── page.tsx              # Create/edit alert
└── api/
    ├── clinics/
    │   ├── route.ts              # GET /api/clinics — search, filter
    │   └── [id]/
    │       ├── route.ts          # GET /api/clinics/[id]
    │       └── flag/
    │           └── route.ts      # POST /api/clinics/[id]/flag
    ├── doctors/
    │   ├── route.ts              # GET /api/doctors — search, filter
    │   ├── [id]/
    │   │   ├── route.ts          # GET /api/doctors/[id]
    │   │   └── verify/
    │   │       └── route.ts      # POST /api/doctors/[id]/verify
    ├── er-waits/
    │   └── route.ts              # GET /api/er-waits — nearest hospitals
    ├── alerts/
    │   ├── route.ts              # GET/POST /api/alerts
    │   └── [id]/
    │       └── route.ts          # DELETE /api/alerts/[id]
    ├── auth/
    │   └── callback/
    │       └── route.ts          # Supabase auth callback
    └── cron/
        ├── refresh-er-waits/
        │   └── route.ts          # Cron: refresh ER wait times
        └── refresh-clinics/
            └── route.ts          # Cron: refresh clinic hours from Google
```

### Component Hierarchy

```
components/
├── ui/                           # Primitives (Radix/shadcn equivalents, manual if not installed)
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Badge.tsx
│   ├── Card.tsx
│   ├── Dialog.tsx
│   └── Skeleton.tsx
├── layout/
│   ├── Header.tsx                # App header with nav
│   ├── MobileNav.tsx             # Bottom nav (mobile)
│   └── SearchBar.tsx             # Postal code search (shared)
├── shared/
│   ├── VerificationBadge.tsx     # "Confirmed by N parents · X days ago"
│   ├── StatusBadge.tsx           # Accepting / Not accepting / Waitlist / Unknown
│   ├── ReferralBadge.tsx         # "No referral needed" / "Referral required"
│   ├── OpenNowBadge.tsx          # "Open now" / "Closed"
│   ├── WeekendBadge.tsx          # "Open Saturday" / "Open Sunday" / "Open after 6pm"
│   ├── StalenessWarning.tsx      # "Last verified 45 days ago — may be outdated"
│   └── DistanceDisplay.tsx       # "2.3 km away"
├── clinic/
│   ├── ClinicCard.tsx            # Single clinic result
│   ├── ClinicList.tsx            # List of clinic cards
│   ├── ClinicFilters.tsx         # Filter panel (sees_children, open_now, weekend, etc.)
│   └── ClinicMapView.tsx         # Leaflet/OSM map with clinic markers
├── doctor/
│   ├── DoctorCard.tsx            # Single doctor result
│   ├── DoctorList.tsx            # List of doctor cards
│   ├── DoctorFilters.tsx         # Filter panel (accepting, referral, language, etc.)
│   ├── DoctorProfile.tsx         # Full detail view
│   └── VerifyForm.tsx            # Community verification form (in dialog)
├── alert/
│   ├── AlertCard.tsx             # Single alert subscription
│   ├── AlertList.tsx             # User's alert subscriptions
│   └── AlertForm.tsx             # Create/edit alert
└── auth/
    ├── LoginButton.tsx           # Sign in / sign up
    └── AuthProvider.tsx          # Supabase auth context
```

### State Management

- **Server state:** Data fetching in RSC via Prisma. Search results rendered server-side with search params in URL.
- **Client state:** React context for auth session. `useState` for filter toggles (open now, sees children, etc.). URL search params for shareable state (postal code, selected filters).
- **Map state:** Local state in `ClinicMapView` — map bounds, selected marker. Not global.
- **No Zustand in v1.** We don't have enough cross-cutting client state to justify it.

### Mobile-First Responsive Strategy

- Base styles for 375px viewport (iPhone SE)
- `md:` breakpoint (768px) for tablet adjustments
- `lg:` breakpoint (1024px) for desktop comfort
- Bottom tab nav on mobile (`MobileNav`), top header nav on tablet+
- Map view: full-width stacked on mobile, side-by-side on desktop
- All touch targets ≥ 44px (WCAG 2.1 AA minimum)
- No horizontal scroll at any supported breakpoint

---

## 4. Backend Architecture

### API Route Design

All routes follow this pattern:
1. Parse and validate input with Zod (`.strict()` — reject unknown fields)
2. Authenticate if required (auth routes, verification, alerts)
3. Query database via Prisma
4. Return typed JSON response
5. Error responses: `{ error: string, details?: unknown }` with appropriate HTTP status

**Rate Limiting:** All routes rate-limited. Read endpoints: 60 req/min per IP. Write endpoints (verify, flag, alert create): 10 req/min per user.

### Data Fetching Pattern

- **Server Components** fetch directly via Prisma (no API round-trip for initial page load)
- **Client Components** fetch via API routes for interactivity (filter changes, search)
- **API Routes** handle mutations (verify, flag, alert CRUD)
- No data fetching in `useEffect` — use React `cache()` for deduplication, or `fetch` with `next: { revalidate }` for timed revalidation

### Cron Job Design

Vercel Cron Jobs hit authenticated API endpoints:

| Endpoint | Schedule | What it does |
|----------|----------|-------------|
| `/api/cron/refresh-er-waits` | Every 15 min | Pull from Ontario wait time API → upsert into `er_wait_times` table |
| `/api/cron/refresh-clinics` | Daily, 3am EST | Pull clinic hours from Google Places API → update hours JSONB in clinics table |
| `/api/cron/expire-verifications` | Daily, 4am EST | Check all doctors for 90-day verification staleness → revert to unknown |

Each cron endpoint validates `CRON_SECRET` in the `Authorization` header before executing.

---

## 5. Database Schema

### clinics
Walk-in clinics across GTA.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Clinic name |
| address | text | Street address |
| coords | geometry(Point, 4326) | PostGIS point (lng, lat) |
| phone | text | Phone number |
| hours | jsonb | `{ "0": {open, close}, ... }` — day-of-week keys |
| open_saturday | boolean | Computed from hours |
| open_sunday | boolean | Computed from hours |
| open_after_6pm | boolean | Computed from weekday hours |
| sees_children | boolean | Manually tagged |
| same_day_booking_required | boolean | Manually tagged |
| is_pediatric_only | boolean | Pediatric-only clinic |
| virtual_care_available | boolean | Offers virtual visits |
| google_place_id | text | Google Places ID for refresh |
| community_flagged | boolean | User reported outdated info |
| last_flagged_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Indexes:** GIST index on `coords`, B-tree on `sees_children`, `open_saturday`, `open_sunday`, `open_after_6pm`.

### doctors
Pediatricians and family doctors.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| cpso_id | text UNIQUE | CPSO registration number |
| name | text | Full name |
| specialty | text | Pediatric specialty if applicable |
| doctor_type | enum | `pediatrician_primary`, `pediatrician_specialist`, `family_doctor` |
| referral_required | boolean | FALSE for primary care, TRUE for specialists |
| accepting_status | enum | `accepting`, `waitlist`, `not_accepting`, `unknown` |
| languages | text[] | From CPSO data |
| address | text | Practice address |
| coords | geometry(Point, 4326) | PostGIS point |
| phone | text | |
| website | text | |
| virtual_visits_available | boolean | |
| age_range_min | int | Minimum patient age |
| age_range_max | int | Maximum patient age |
| last_verified | timestamptz | Most recent verification timestamp |
| verification_count | int | Supporting verifications in last 60 days |
| source | enum | `cpso`, `pediatricians_alliance`, `community` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Indexes:** GIST on `coords`, B-tree on `accepting_status`, `referral_required`, `doctor_type`, GIN on `languages`.

### verifications
Community confirmations of doctor accepting status.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| doctor_id | uuid FK → doctors | |
| user_id | uuid FK → auth.users | |
| reported_status | enum | `accepting`, `waitlist`, `not_accepting` |
| how_confirmed | enum | `called_office`, `visited_in_person`, `received_appointment`, `told_by_receptionist` |
| notes | text | Optional free-text |
| created_at | timestamptz | |

**Indexes:** Composite B-tree on `(doctor_id, created_at DESC)`, B-tree on `user_id`.

### alerts
Roster alert subscriptions — doctors only in v1.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid FK → auth.users | |
| alert_type | enum | `doctor` only in v1 |
| target_id | uuid FK → doctors | Specific doctor (nullable if postal code alert) |
| postal_code | text | For "any doctor near me" alerts |
| radius_km | int | Search radius |
| doctor_type_filter | enum | Optional: `pediatrician_primary`, `family_doctor` |
| language_filter | text | Optional |
| last_notified_at | timestamptz | |
| created_at | timestamptz | |

**Free tier:** up to 5 alerts per user.

### postal_codes
Preloaded Canadian postal code → coordinate lookup. Eliminates external geocoding API at query time.

| Column | Type | Description |
|--------|------|-------------|
| postal_code | text PRIMARY KEY | Normalized (no space, uppercase, e.g. "M5V2T6") |
| lat | float8 | Latitude |
| lng | float8 | Longitude |
| city | text | City name |
| province | text | "ON" |

**Data source:** Open postal code datasets (e.g., geocoder.ca bulk data, or self-hosted Nominatim for one-time export). ~850,000 rows for all of Canada; ~50,000 for GTA-focused seed. B-tree index on `postal_code` for exact lookups.

### er_wait_times
ER wait times from Ontario open data.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| hospital_name | text | |
| coords | geometry(Point, 4326) | |
| wait_time_min | int | Current wait in minutes |
| urgency_level | text | "Non-urgent", "Urgent", "Emergent" |
| last_updated | timestamptz | When the hospital reported this data |
| fetched_at | timestamptz | When our system retrieved it |

### pharmacies
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | |
| address | text | |
| coords | geometry(Point, 4326) | |
| phone | text | |
| hours | jsonb | |
| accepts_odb | boolean | Default true for major chains |
| is_24hr | boolean | |
| chain | enum | `shoppers`, `rexall`, `pharmasave`, `costco`, `independent`, etc. |

**Note on pharmacies:** Seeded for v1 to support urgent care ("nearest 24hr pharmacy"). Full pharmacy search surfaces in Phase 2 (prescription coverage).

### Row-Level Security Policies (all tables)

- **clinics:** Public read. Admin-only write (flag endpoint uses secret key).
- **doctors:** Public read. Admin-only write.
- **verifications:** Authenticated users can INSERT their own. SELECT public. No UPDATE/DELETE by users.
- **alerts:** Authenticated users can CRUD their own (WHERE user_id = auth.uid()). SELECT only own.
- **postal_codes:** Public read. Admin-only write (seed script).
- **er_wait_times:** Public read. Cron-only write.
- **pharmacies:** Public read. Admin-only write.

---

## 6. Authentication & Authorization

### Auth Flow

1. User clicks "Sign In" → Supabase Auth UI (email magic link or Google OAuth)
2. Supabase sets session cookie (`sb-access-token`, `sb-refresh-token`)
3. Server components read session via `supabase.auth.getSession()` — no client fetch needed
4. Client components use `AuthProvider` context wrapping `supabase.auth.onAuthStateChange`
5. Protected routes (alerts, verification) check session server-side; redirect to sign-in if unauthenticated

### Role Separation

- **anon (public):** Browse clinics, doctors, ER waits. No mutations.
- **authenticated:** Create verifications, manage alerts. Read own data.
- **secret_key:** Cron jobs, seed scripts, admin operations. This key never leaves server code.

### Protected Routes

- `/alerts/*` — require authentication
- `/api/alerts/*` — require authentication
- `/api/doctors/[id]/verify` — require authentication
- `/api/clinics/[id]/flag` — require authentication (low barrier, but prevents anonymous spam)
- `/api/cron/*` — require CRON_SECRET in Authorization header

---

## 7. Data Pipeline

### CPSO Physician Scraper

**Before building:** Verify CPSO ToS allows scraping. Check for an API or bulk data export first.

If scraping is the only option:
- Target: `register.cpso.on.ca`
- Tool: cheerio (static) or Playwright (if JS-rendered)
- Rate: max 1 request/second
- Schedule: Quarterly (Vercel cron)
- Output: Upsert into `doctors` table, matching on `cpso_id`

### Google Places Clinic Import

- Source: Google Places API "Nearby Search" + "Place Details"
- Search parameters: `type=health`, keyword "walk-in clinic", radius 50km from Toronto center
- For each result: query Place Details for opening hours (`periods[]`), parse day-of-week open/close times
- Compute `open_saturday`, `open_sunday`, `open_after_6pm` during import
- Initial seed: manual review for `sees_children` and `same_day_booking_required` flags
- Refresh: Daily via cron (hours only — flags are manual)

### Ontario ER Wait Times

- Source: `data.ontario.ca/dataset/wait-time-information-system`
- Format: Verify current format (JSON API or CSV). CLAUDE.md assumes CSV; check.
- Schedule: Every 15 minutes via Vercel cron
- Output: Upsert into `er_wait_times`, match hospitals by name/location

### Pediatricians Alliance Seed Data

- Source: `pedsallianceontario.ca/find-a-pediatrician`
- Verify permission to use directory as seed data before importing
- One-time seed + periodic refresh (weekly)

---

## 8. Maps & Geocoding

### Strategy: Free Where Possible, Google Only Where Necessary

| Need | Solution | Cost |
|------|----------|------|
| **Postal code → coords** | `postal_codes` lookup table (preloaded) | Free |
| **Interactive map tiles** | Leaflet + OpenFreeMap (OSM vector tiles) | Free |
| **Clinic names, addresses, hours** | Google Places API — server-side cron only | ~$0.50/week at v1 scale |

### Geocoding: Postal Code Lookup Table

Canadian postal codes are a fixed dataset. We preload all Ontario postal codes (or all of Canada) into a `postal_codes` table. At query time:

```sql
SELECT lat, lng FROM postal_codes WHERE postal_code = 'M5V2T6';
```

No external API call. Sub-millisecond response. Zero cost. Zero rate limits.

**Data source options:**
- Open datasets (e.g., geocoder.ca bulk data, open postal code projects)
- One-time self-hosted Nominatim geocoding run to build the seed file
- For edge cases (new postal codes, typos): fall back to a free geocoding API like Nominatim or MapTiler free tier

**When the user shares browser geolocation** (lat/lng directly), skip the lookup entirely — go straight to the spatial query.

### Map Display: Leaflet + OpenStreetMap

- **Library:** `react-leaflet` (React bindings for Leaflet) or raw Leaflet with a wrapper
- **Tiles:** OpenFreeMap (`https://tiles.openfreemap.org/styles/liberty`) — free vector tiles, no API key required
- **Attribution:** "© OpenStreetMap contributors" displayed on map
- **Fallback:** MapTiler free tier (100,000 tile requests/month) if OpenFreeMap has issues

**Why Leaflet over Google Maps JS:**
- No API key needed (no key exposure risk)
- No billing, no usage caps, no budget alerts
- Lighter bundle (~40KB vs Google Maps ~100KB+)
- Sufficient for "dots on a map" — we're showing markers, not Street View or directions

### Clinic Data: Google Places API (Server-Side Only)

Google Places is kept for one reason: structured business hours. The `periods[]` array in Place Details gives us precise open/close times for all 7 days, which we need to compute `open_saturday`, `open_sunday`, and `open_after_6pm`.

**Usage pattern:**
- **Initial seed:** One-time Nearby Search for GTA walk-in clinics → for each, Place Details → store in `clinics` table
- **Daily refresh (cron):** Re-fetch Place Details for known `place_id` values to update hours JSONB
- **Never per-user query:** No Places API calls in response to user searches

**Cost estimate for v1 GTA launch:**
- ~300 clinics × Place Details ($17/1,000 in legacy, lower in new Pro tier) = ~$5 one-time seed
- Daily refresh of 300 clinics = ~$5/month
- Well within free tier allowances under the new 2025 pricing model

**API key security:** IP-restricted to Vercel's server IP ranges. Never prefixed with `NEXT_PUBLIC_`. Only used in cron route handlers.

---

## 9. Testing Strategy

### Test Runner
- **Vitest** — Fast, TypeScript-native, compatible with Next.js. Already the standard for Next.js projects.

### What Gets Tested

| Layer | What | How |
|-------|------|-----|
| **Data pipeline scripts** | CPSO scraper parsing, ODB formulary parsing, hours JSONB computation | Unit tests with fixture data. These are the highest-risk code — wrong parsing = wrong data = product broken. |
| **API routes** | Input validation, response shape, error states | Integration tests with Supertest or fetch against a test endpoint |
| **Verification logic** | Status recalculation (2+ in 30 days), staleness (90-day revert), alert trigger conditions | Unit tests on pure functions |
| **Database** | RLS policies, query performance | Policy tests with Supabase local. EXPLAIN ANALYZE on spatial queries. |
| **Critical UI flows** | Search → results, verification flow, alert creation | Manual testing in v1. Add Playwright E2E in Phase 2. |

### What Does NOT Get Tested in v1
- UI component rendering (low complexity, visual QA sufficient for MVP)
- Leaflet map interaction (external dependency, visual QA sufficient)
- Email delivery (Resend handles this)

---

## 10. Infrastructure & Deployment

### Vercel

- **Framework:** Next.js (auto-detected)
- **Build:** `next build`
- **Environment variables:** All from `.env.example` set in Vercel dashboard
- **Cron Jobs:** Configured in `vercel.json`
- **Domains:** TBD (likely `kidscareontario.ca`)

### Supabase

- **Project:** TBD (create Week 1)
- **Database:** PostGIS-enabled PostgreSQL
- **Auth:** Email + Google OAuth providers enabled
- **RLS:** Policies applied to all tables before any data is inserted
- **Migrations:** Prisma Migrate (`npx prisma migrate dev`)

### Initial Setup Order (Week 1)

1. Create Supabase project, enable PostGIS
2. Install Prisma, define schema, run initial migration
3. Install remaining deps (Supabase client, Zod, cheerio, Resend, Leaflet + react-leaflet)
4. Seed `postal_codes` table with Ontario postal code dataset
5. Set up Vercel project with env vars
6. Configure Vercel Cron Jobs
7. Write and run seed scripts for clinics (Google Places one-time pull) and doctors (CPSO)
8. Verify ER wait time pipeline end-to-end
9. Deploy scaffolded app to Vercel staging URL
