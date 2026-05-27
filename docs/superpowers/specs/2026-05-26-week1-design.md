# KidsCare Ontario — v1 Design Spec (Week 1)

**Date:** 2026-05-26
**Phase:** v1 MVP (Urgent Care Finder + Pediatrician Finder)
**Status:** Ready for implementation plan

---

## Overview

KidsCare Ontario is a mobile-first web application that helps Ontario parents find walk-in clinics, pediatricians, and ER wait times — fast, on mobile. v1 launches with two features: Urgent Care Finder and Pediatrician Finder, plus user accounts for saving favorites and roster alerts.

### Core user stories

1. "My child is sick on a Saturday evening. Show me walk-in clinics near me that see children and are open right now."
2. "I need a pediatrician for my 3-year-old who speaks Mandarin and is accepting new patients without a referral."
3. "I want to get notified the moment a pediatrician near me opens their roster."

---

## Architecture

```
Browser (mobile-first)
  │
  ├─ Leaflet + OSM tiles (free map display)
  │
  ▼
Vercel (Next.js 16, React 19, Tailwind v4)
  │
  ├─ Server Components → Prisma → Supabase PostGIS
  ├─ API Routes (Zod-validated, rate-limited)
  ├─ Vercel Cron Jobs (ER refresh, clinic refresh, verification expiry)
  │
  ▼
Supabase (PostgreSQL + PostGIS, Auth, RLS)
  │
  ├─ Google Places API (server-only cron, clinic data seeding)
  ├─ data.ontario.ca (ER wait times)
  ├─ CPSO register (physician data, quarterly scrape)
  └─ Postal code lookup table (preloaded, no external API)
```

### Key architectural decisions

| Decision | Rationale |
|----------|-----------|
| **Server Components for data fetching** | Prisma queries in RSC — no API round-trip for initial page load |
| **API Routes for mutations** | Verification, flagging, alert CRUD go through REST endpoints with Zod validation |
| **URL search params for state** | Postal code, filters live in URL — shareable, back-button-friendly. No Zustand. |
| **Leaflet over Google Maps JS** | Free, no API key, no billing, lighter bundle. We only need marker display. |
| **Postal code table over geocoding API** | Canadian postal codes are a finite dataset. Preload once, query free forever. |
| **Google Places — server-only cron** | Best business-hours data, but expensive per-query. Use for seed + daily refresh only, never in request path. |
| **Vercel Cron over BullMQ** | Serverless-native. No Redis, no worker process, no separate infrastructure. |

---

## Database Schema (5 tables + 1 lookup)

### postal_codes (lookup table)
Preloaded postal code → lat/lng. Eliminates external geocoding.

- `postal_code` text PK (normalized, e.g. "M5V2T6")
- `lat`, `lng` float8
- `city`, `province` text
- ~50K rows for GTA seed, ~850K for full Canada

### clinics
Walk-in clinics. Public read. Admin write. RLS-enforced.

- Core: name, address, coords (PostGIS point), phone
- Hours: `hours` JSONB (`{ "0": {open, close}, ... }`) + computed `open_saturday`, `open_sunday`, `open_after_6pm` booleans
- Flags: `sees_children`, `same_day_booking_required`, `is_pediatric_only`, `virtual_care_available` (all manually tagged)
- Community: `community_flagged`, `last_flagged_at`
- Refresh: `google_place_id` for daily hours refresh

### doctors
Pediatricians and family doctors. Public read. Admin write.

- Core: `cpso_id` (unique), name, specialty, `doctor_type` enum, address, coords
- Status: `accepting_status` enum, `referral_required` boolean
- Verification: `last_verified`, `verification_count`
- Metadata: `languages` text[], `age_range_min`/`max`, `source` enum
- Indexes: GIST on coords, B-tree on status/type, GIN on languages

### verifications
Community trust mechanic. Auth users INSERT. Public SELECT.

- `doctor_id` FK, `user_id` FK
- `reported_status` enum, `how_confirmed` enum, `notes` text
- Composite index on `(doctor_id, created_at DESC)`

**Status recalculation:** 2+ agreeing verifications in 30 days → update doctor status. 0 verifications in 90 days → revert to `unknown`.

### alerts
Roster alert subscriptions. Auth users CRUD own. RLS `WHERE user_id = auth.uid()`.

- `user_id` FK, `alert_type` enum (doctor only in v1)
- `target_id` FK (specific doctor) OR `postal_code` (area alert)
- Optional filters: `radius_km`, `doctor_type_filter`, `language_filter`
- Free tier: max 5 alerts per user
- `last_notified_at` for dedup

### er_wait_times
Public read. Cron write. Refreshed every 15 minutes from Ontario open data.

- `hospital_name`, coords, `wait_time_min`, `urgency_level`
- `last_updated` (hospital report time), `fetched_at` (our retrieval time)

---

## Route Design

### Pages (App Router)

| Route | Purpose |
|-------|---------|
| `/` | Home — "What does your child need?" (two CTAs: urgent care / find doctor) |
| `/urgent` | Clinic list + filters + map toggle |
| `/pediatricians` | Doctor search + results |
| `/pediatricians/[id]` | Doctor detail + verification form |
| `/alerts` | User's alert subscriptions (auth required) |
| `/alerts/manage` | Create/edit alert (auth required) |

### API Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/clinics` | No | Search clinics |
| GET | `/api/clinics/[id]` | No | Clinic detail |
| POST | `/api/clinics/[id]/flag` | Yes | Report outdated info |
| GET | `/api/doctors` | No | Search doctors |
| GET | `/api/doctors/[id]` | No | Doctor detail |
| POST | `/api/doctors/[id]/verify` | Yes | Submit verification |
| GET | `/api/er-waits` | No | Nearest ER wait times |
| GET/POST | `/api/alerts` | Yes | List / create alerts |
| DELETE | `/api/alerts/[id]` | Yes | Delete alert |
| GET | `/api/auth/session` | No | Current session state |
| POST | `/api/cron/*` | CRON_SECRET | Internal cron jobs |

### Input Validation

Every API route validates input with Zod `.strict()`. Unknown fields → 400. All query params and request bodies have explicit schemas.

---

## Maps & Geocoding Strategy

Three needs, three different solutions:

| Need | Solution | Cost |
|------|----------|------|
| Postal code → coords | `postal_codes` DB lookup | Free |
| Interactive map | Leaflet + OpenFreeMap (OSM tiles) | Free |
| Clinic hours data | Google Places API (server cron only) | ~$5/month |

**Postal code flow:** User enters "M5V 2T6" → normalize to "M5V2T6" → `SELECT lat, lng FROM postal_codes WHERE postal_code = 'M5V2T6'` → done. If user shares geolocation, skip the lookup entirely.

**Map flow:** `react-leaflet` component loads OpenFreeMap vector tiles. No API key. Attribution: "© OpenStreetMap contributors." Map loads only when user toggles map view — default is list view.

**Google Places:** Used exclusively in cron handlers. Initial seed: Nearby Search for GTA walk-in clinics → Place Details for hours → store in `clinics` table. Daily refresh: re-fetch Place Details for all known `place_id` values. IP-restricted API key, never exposed to client.

---

## Auth Flow

1. Supabase Auth — email magic link + Google OAuth
2. Session cookie set automatically by Supabase client
3. Server Components read session via `supabase.auth.getSession()`
4. Client uses `AuthProvider` context with `onAuthStateChange`
5. Protected routes check session server-side → redirect if unauthenticated

**Roles:** anon (browse), authenticated (verify + alerts), service_role (cron + seed — never client-side)

---

## Data Pipeline

| Pipeline | Source | Tool | Schedule |
|----------|--------|------|----------|
| ER wait times | data.ontario.ca | fetch + Zod parse | Every 15 min |
| Clinic hours | Google Places API | Nearby Search + Place Details | Daily 3am |
| Doctor profiles | CPSO register | cheerio (verify ToS first) | Quarterly |
| Doctor seed | Pediatricians Alliance | cheerio (verify permission) | Weekly |
| Postal codes | Open dataset | CSV bulk insert | One-time |
| Verification expiry | Internal DB | SQL query | Daily 4am |

**Resilience rules:**
- All external fetches: 10-second timeout. Fail fast, serve cached.
- Never call an external API in the request path. All data comes from our DB.
- Log failures to Sentry. Serve stale data with visible timestamp and disclaimer.

---

## Component Architecture

```
components/
├── ui/          # Primitives (Button, Input, Badge, Card, Dialog, Skeleton)
├── layout/      # Header, MobileNav, SearchBar
├── shared/      # VerificationBadge, StatusBadge, ReferralBadge, OpenNowBadge,
│                # WeekendBadge, StalenessWarning, DistanceDisplay
├── clinic/      # ClinicCard, ClinicList, ClinicFilters, ClinicMapView
├── doctor/      # DoctorCard, DoctorList, DoctorFilters, DoctorProfile, VerifyForm
├── alert/       # AlertCard, AlertList, AlertForm
└── auth/        # LoginButton, AuthProvider
```

**Mobile-first:** Base styles at 375px. `md:` at 768px, `lg:` at 1024px. Bottom nav on mobile, top header nav on tablet+. Touch targets ≥ 44px. No horizontal scroll.

---

## Testing Strategy

- **Vitest** as test runner
- **Pipeline scripts** — unit tests with fixture data (highest priority; wrong data = broken product)
- **Verification logic** — unit tests on pure functions (status recalculation, staleness, alert triggers)
- **API routes** — integration tests on Zod schemas and response shapes
- **RLS policies** — test with Supabase local
- **UI** — manual testing for v1; Playwright E2E in Phase 2

---

## What We're NOT Building (v1 Scope Guardrails)

- No prescription drug coverage checker (Phase 2)
- No family doctor alerts (Phase 3)
- No daycare module (Phase 4)
- No appointment booking
- No Stripe/payments
- No push notifications (email only)
- No i18n (t() wrapper is premature)
- No clinical recommendations or triage
- No PHI storage (postal code only)
- No expansion beyond GTA

---

## Week 1 Deliverables

1. Supabase project created, PostGIS enabled
2. Prisma schema written, initial migration run
3. All dependencies installed (Supabase client, Zod, cheerio, Resend, Leaflet, react-leaflet, Vitest)
4. `postal_codes` table seeded with Ontario data
5. Vercel project configured with env vars
6. Folder structure and all stub components in place
7. ER wait time pipeline functional (cron + endpoint)
8. Clinic seed script written (Google Places one-time pull)
9. App deployed to Vercel staging

---

## References

- `docs/PRD.md` — Full product requirements
- `docs/TECHNICAL_SPEC.md` — Detailed technical specification
- `docs/DATA_SOURCES.md` — Data sources, schemas, refresh schedules, fallbacks
- `docs/API_CONTRACTS.md` — Complete API contracts with Zod schemas
- `CLAUDE.md` — Project context and coding conventions
