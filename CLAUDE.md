@AGENTS.md

# KidCare Ontario — CLAUDE.md

## What this project is

KidCare Ontario is a mobile-first web application that helps Ontario parents navigate family healthcare and childcare. Built by a parent who lives these problems daily. The target user is an Ontario parent, primarily in the Greater Toronto Area.

It solves five real pain points that no single product addresses today:

1. Finding a walk-in clinic that actually sees children, is open right now, and doesn't require a prior appointment booked at 8am
2. Finding a pediatrician who is accepting new patients, knowing whether a referral is needed, and getting notified the moment one opens
3. Knowing whether a child's prescription is free under OHIP+ before arriving at the pharmacy counter
4. Getting notified the moment a pediatrician opens their roster near them

Daycare finder and CWELCC subsidy tools are future phases — documented in KidCare-Daycare-Module-Spec.docx.

---

## Tech stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4 (CSS-based config, no tailwind.config.ts), React 19
- **Backend**: Next.js API routes + Node.js
- **Database**: PostgreSQL via Supabase (with PostGIS extension for geo queries)
- **Maps**: Leaflet + OpenStreetMap tiles (free, no API key). Google Places API server-side only for clinic data seeding.
- **Authentication**: Supabase Auth
- **Notifications**: Resend (email alerts) + Expo Push Notifications (mobile)
- **Hosting**: Vercel (frontend) + Supabase (database)
- **Scraping**: Playwright (headless browser for JS-rendered sites) + cheerio. Check for official APIs before scraping. Respect robots.txt, rate-limit to 1 req/s, and verify ToS compliance for each target.
- **Cron jobs**: Vercel cron for scheduled data refresh

---

## Project folder structure

```
kidcare-ontario/
├── app/
│   ├── (home)/                  # Home screen — "what does your child need?"
│   ├── urgent/                  # Urgent care finder (Phase 1)
│   ├── pediatricians/           # Pediatrician search + profiles (Phase 2)
│   ├── prescriptions/           # OHIP+ coverage checker (Phase 3)
│   ├── alerts/                  # User alert management (all types)
│   └── api/
│       ├── clinics/             # Walk-in clinic data
│       ├── doctors/             # Pediatrician + family doctor database
│       ├── drugs/               # ODB formulary lookup
│       ├── er-waits/            # Ontario ER wait times
│       └── alerts/              # Alert subscription management
├── components/
│   ├── CareCard/                # Reusable clinic/doctor result card
│   ├── MapView/                 # Leaflet + OSM map integration
│   ├── CoverageChecker/         # OHIP+ lookup UI
│   ├── AlertBadge/              # Accepting/availability status badge
│   ├── VerificationBadge/       # "Confirmed by X parents, Y days ago"
│   └── StarRating/              # 5-category rating display component
├── lib/
│   ├── ontario-data.ts          # Ontario open data fetchers
│   ├── cpso-scraper.ts          # CPSO physician register scraper
│   ├── odb-formulary.ts         # Drug benefit formulary logic
│   ├── notifications.ts         # Email + push alert system
│   └── geo.ts                   # PostGIS geo query helpers
├── scripts/
│   ├── seed-postal-codes.ts     # Load Canadian postal code dataset
│   ├── seed-clinics.ts          # Initial walk-in clinic database seed (Google Places)
│   ├── seed-doctors.ts          # Initial pediatrician database seed (CPSO)
│   ├── update-er-waits.ts       # Monthly ER wait data refresh
│   └── update-formulary.ts      # Monthly ODB formulary refresh
├── prisma/                      # Database schema (schema.prisma)
└── public/
```

---

## Database tables — v1 schema (urgent care + pediatrician finder only)

> Daycare tables (daycares, daycare_reviews, daycare_responses, daycare_contacts, daycare_claims, waitlist_watches) are documented in KidCare-Daycare-Module-Spec.docx and will be added in a future phase. Do NOT create them in v1.

### postal_codes
Preloaded postal code → coordinate lookup. Eliminates external geocoding API at query time.
- postal_code (text, PK — normalized: no space, uppercase, e.g. "M5V2T6")
- lat, lng (float8)
- city, province (text)

### clinics
Walk-in clinics across GTA.
- id, name, address, coords (PostGIS point), phone
- hours (JSONB — day: {open, close})
- sees_children (boolean) — manually tagged
- same_day_booking_required (boolean) — manually tagged
- is_pediatric_only (boolean)
- virtual_care_available (boolean)
- community_flagged (boolean) — user reported outdated info
- last_flagged_at, created_at, updated_at

### doctors
Pediatricians and family doctors across Ontario.
- id, cpso_id (unique), name, specialty
- doctor_type: 'pediatrician_primary' | 'pediatrician_specialist' | 'family_doctor'
- referral_required (boolean) — FALSE for primary care peds, TRUE for specialists
- accepting_status: 'accepting' | 'waitlist' | 'not_accepting' | 'unknown'
- languages (text array) — from CPSO data
- address, coords (PostGIS point), phone, website
- virtual_visits_available (boolean)
- age_range_min, age_range_max (for pediatricians)
- last_verified (timestamp) — when community last confirmed accepting status
- verification_count (integer) — how many confirmations support current status
- source: 'cpso' | 'pediatricians_alliance' | 'community'
- created_at, updated_at

### verifications
Community confirmations of doctor accepting status. This is the core trust mechanic.
- id, doctor_id, user_id
- reported_status: 'accepting' | 'waitlist' | 'not_accepting'
- how_confirmed: 'called_office' | 'visited_in_person' | 'received_appointment' | 'told_by_receptionist'
- notes (optional text — e.g. "they said call back in January")
- created_at

**Verification logic (important):**
- A doctor's accepting_status updates when 2+ verifications in the last 30 days agree on a status
- last_verified timestamp = most recent verification created_at
- verification_count = number of verifications supporting current status in last 60 days
- If no verifications in 90 days → status reverts to 'unknown' automatically
- Alert fires to all watchers when accepting_status changes TO 'accepting'

### alerts
Roster alert subscriptions — doctors only in v1. Daycare alerts added in future phase.
- id, user_id
- alert_type: 'doctor' (daycare type added in future phase)
- target_id (doctor_id — nullable if postal code alert)
- postal_code (for "any doctor near me" alerts)
- radius_km
- doctor_type filter (optional — 'pediatrician_primary' | 'family_doctor')
- language filter (optional)
- last_notified_at, created_at
- Free tier: up to 5 alerts. Premium: unlimited.

### drugs
ODB formulary entries — refreshed monthly from ontario.ca.
- id, din (drug identification number), name, generic_name
- benefit_price (decimal) — ODB reimbursement price
- ohip_plus_eligible (boolean)
- odb_eligible (boolean)
- manufacturer, form, strength
- last_refreshed (timestamp)

### pharmacies
- id, name, address, coords (PostGIS point), phone, hours (JSONB)
- accepts_odb (boolean — default true for major chains)
- is_24hr (boolean)
- chains: 'shoppers' | 'rexall' | 'pharmasave' | 'costco' | 'independent' | etc.

### waitlist_watches
- FUTURE PHASE — daycare module only. Do not build in v1.
- Fully documented in KidCare-Daycare-Module-Spec.docx

---

## Community verification system — how it works

This system powers the pediatrician accepting-status feature. It will also power daycare availability in a future phase. It is the core trust mechanic of the platform.

### For doctors (verifications table)
1. Every doctor card shows the current accepting_status with a VerificationBadge: "Confirmed accepting by 3 parents · 2 days ago"
2. Any logged-in user can tap "Is this still accurate?" and report what they found when they contacted the office
3. They select: how they confirmed (called / visited / received appointment), what the status is, and optionally add a note
4. The system recalculates accepting_status when 2+ verifications in the last 30 days agree
5. If accepting_status flips to 'accepting' → all alert subscribers for that doctor or matching postal code are notified immediately via email + push
6. If no verifications in 90 days → status shows as 'unknown' with a prompt to verify

### Trust signals shown on every card
- Status label: Accepting / Not accepting / Waitlist / Unknown
- "Confirmed by [N] parents · [X] days ago" — always show both number and recency
- If unverified >90 days: "Last confirmed [date] — may be outdated. Tap to verify."
- If 0 verifications ever: "No community data yet — be the first to verify"

---

## Core features — build order

> **v1 scope: Urgent care finder + Pediatrician finder only.**
> Prescription checker, family doctor alerts, and daycare module are future phases — do NOT build them in v1.
> Daycare is a fully separate product that will be built after v1 launches.

### Phase 1 — Urgent care finder + Pediatrician finder (weeks 1–10) ← BUILD THIS FIRST
These two features launch together as the v1 product. They serve the same user in different moments and belong on the same screen.

**Urgent care finder (weeks 1–5)**
- Walk-in clinic database for GTA seeded from Google Places + manual tagging
- sees_children and same_day_booking_required flags manually tagged per clinic
- Postal code / geolocation search with PostGIS
- ER wait times pipeline from data.ontario.ca (monthly CSV)
- "Open right now" filter using hours JSONB
- Virtual care options always shown as third option (Maple, Ontario Virtual Care Clinic)
- Community flag button: "this info is outdated"

**Pediatrician finder (weeks 6–10)**
- CPSO scraper (Playwright) + Pediatricians Alliance of Ontario data import
- referral_required field: primary care peds = FALSE, specialist peds = TRUE — tagged per doctor
- Community verification system (verifications table, VerificationBadge component)
- Accepting status recalculation logic (2+ verifications in 30 days to update status)
- Language filter using CPSO language data
- Roster alert subscription + email/push notification trigger when status flips to accepting
- "No referral needed" clearly labelled on every primary care pediatrician card

### Phase 2 — Prescription coverage checker (weeks 11–18)
- ODB Formulary XLSX ingestion from data.ontario.ca (monthly cron)
- OHIP+ eligibility logic: under 25 AND no private insurance → covered, $0 cost
- Drug search UI with instant yes/no coverage answer + what to bring to pharmacy
- Nearest pharmacies open now accepting ODB, 24hr flag prominently shown
- Trillium eligibility explainer (link to official tool — do not build calculator)

### Phase 3 — Family doctor alerts + monetization (months 5–8)
- Family doctor roster alerts (same verifications mechanism as pediatricians)
- Premium subscription tier via Stripe — unlimited alerts + instant notifications
- Walk-in clinic premium listings — clinics pay to keep profiles updated + add booking links
- Virtual care affiliate links (Maple referral program)

### Phase 4 — Daycare module (separate product, build after v1 is live)
- Fully documented in KidCare-Daycare-Module-Spec.docx
- Do not start until Phase 1 is launched and has real users
- Will be built as a separate section of the app, not mixed into v1 codebase

---

## Key data sources

| Source | URL | Format | Refresh |
|--------|-----|--------|---------|
| Canadian postal codes | Open dataset (geocoder.ca bulk or similar) | CSV seed | One-time |
| Ontario ER wait times | data.ontario.ca/dataset/wait-time-information-system | CSV | Monthly |
| ODB Drug Formulary | data.ontario.ca/dataset/ontario-drug-benefit-formulary | CSV | Monthly |
| CPSO Physician Register | register.cpso.on.ca | Web scrape (Playwright) | Quarterly |
| Pediatricians Alliance | pedsallianceontario.ca/find-a-pediatrician | Web scrape | Quarterly |
| 211 Ontario | 211ontario.ca | Web scrape | Weekly |
| Ontario Licensed Child Care | data.ontario.ca/dataset/licensed-child-care-facilities-in-ontario | XLSX | Monthly |
| Ontario Home Child Care Agencies | data.ontario.ca/en/dataset/home-child-care-agencies | XLSX | Monthly |
| CWELCC Enrolled Centres | earlyyears.edu.gov.on.ca | Web scrape | Weekly |
| Google Places | maps.googleapis.com | REST API | Daily (server-only) |

---

## Environment variables

```
GOOGLE_MAPS_API_KEY=           # Server-only — Google Places API for clinic data seeding. NOT NEXT_PUBLIC.
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=       # Safe for client code (RLS-enforced). Available as NEXT_PUBLIC_ too.
SUPABASE_SECRET_KEY=           # SERVER ONLY — bypasses RLS. Never import in client components. Never NEXT_PUBLIC_.
DATABASE_URL=
RESEND_API_KEY=
EXPO_ACCESS_TOKEN=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
CRON_SECRET=
```

### Critical env var rules
- `SUPABASE_SECRET_KEY` must never be imported in a client component or prefixed with `NEXT_PUBLIC_`. It bypasses Row-Level Security. Use only in server components, API routes, and scripts.
- `NEXT_PUBLIC_*` vars are inlined at build time and visible to the browser — never put secrets here.
- `CRON_SECRET` must be validated on every cron endpoint to block unauthorized invocations.

---

## Coding conventions

- TypeScript strict mode always on — no `any` types. Use `strict: true` in tsconfig (already enabled).
- All data fetching in server components or API routes — never expose scrapers client-side
- Every community-verified status MUST show last_verified timestamp and verification_count on the card — never show status without recency
- All location searches use PostGIS ST_DWithin — never compute distance in JavaScript
- Rate limit all scraping: max 1 request/second, respect robots.txt, cache results aggressively
- OHIP+ eligibility logic must include a comment linking to the official ontario.ca policy source
- Review moderation logic lives in /lib/moderation.ts — centralised, not inline
- Alert notifications are async (queue-based) — never block the API response waiting for email/push to send
- Stripe webhooks handle all subscription state changes — never trust client-side payment status

## Security guardrails

- **Rate limiting**: All API routes must be rate-limited. Use Vercel's built-in rate limiting or a token-bucket pattern. Community verification endpoints (write operations) need stricter limits than reads.
- **CSP headers**: Set Content-Security-Policy headers on all pages. Minimum: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` (Tailwind requires unsafe-inline for styles). Add Google Maps domains to `script-src` and `img-src` when maps are integrated.
- **Input validation**: All API route inputs validated with Zod before any processing. Reject unknown fields (use `.strict()`).
- **Supabase RLS**: All tables must have Row-Level Security policies. The `SUPABASE_SECRET_KEY` bypasses RLS — only use it in server-side code where the user context is explicitly validated.
- **SQL injection**: No raw SQL except for complex PostGIS aggregations. All raw queries must use parameterized statements — never string interpolation.
- **Google Maps API cost**: Only Google Places API is used, server-side only (cron jobs), IP-restricted key. Set monthly budget alerts in Google Cloud Console. Interactive map uses free Leaflet + OSM tiles — no cost, no key.
- **Scraping compliance**: Check robots.txt and ToS before scraping any source. If an API exists, use it instead. Cache scraped data aggressively to minimize request volume.
- **Canadian privacy (PIPEDA)**: No personal health information stored. Postal codes for search/alerts only. No names, health card numbers, or clinical data. If collecting email for alerts, document purpose at collection point.

---

## Monetization (build in Phase 4+)

| Stream | Price | Notes |
|--------|-------|-------|
| Parent premium subscription | $5–8/mo | Unlimited alerts, instant notifications |
| Virtual care affiliate (Maple etc.) | $10–20/signup | Referral links on urgent care screen |
| Walk-in clinic premium listing | $50–200/mo | Update profile, add booking link |
| Employer benefit deals | $2–5/employee/mo | Healthcare navigation as employee benefit |
| Data licensing | Project-based | Anonymised wait/availability trends |

---

## What NOT to build (scope guardrails for v1)

- No appointment booking — liability and complexity out of scope
- No personal health information stored — postal code only for alerts, no PHI ever
- Do not show drug prices as definitive — ODB benefit price is a reference only, always link to official OHIP+ checker
- No clinical recommendations — route to care options, never suggest diagnoses or treatments
- Ontario only — do not expand to other provinces in v1
- Do not build a subsidy calculator for Trillium — link to the official tool (liability)

---

## Definition of done — v1 launch (urgent care + pediatrician finder)

### Urgent care finder
- [ ] Walk-in clinic search returns results for any GTA postal code within 2 seconds
- [ ] Each result shows: name, distance, open/closed now, sees_children flag, same_day_booking_required warning, phone number
- [ ] ER wait times shown alongside walk-in options with data source and last updated date
- [ ] Virtual care always shown as a third option on the urgent care screen
- [ ] "Open right now" filter works correctly for current day and time
- [ ] Community flag button visible and functional on every clinic card

### Pediatrician finder
- [ ] Search returns pediatricians for any GTA postal code
- [ ] Every card shows: referral_required status ("No referral needed" or "Referral required"), accepting status, languages spoken, last verified timestamp and verification count
- [ ] Primary care pediatricians (no referral needed) clearly distinguished from specialists
- [ ] Language filter works using CPSO data
- [ ] Community verification: logged-in user can confirm or update accepting status
- [ ] Accepting status recalculates correctly after 2+ agreeing verifications in 30 days
- [ ] Status reverts to unknown after 90 days with no verifications
- [ ] Roster alert: user can subscribe to a specific doctor or postal code
- [ ] Alert fires via email within 1 hour of status flipping to accepting
- [ ] VerificationBadge shows "Confirmed by X parents · Y days ago" on every card

### Both features
- [ ] Mobile responsive on iOS Safari and Android Chrome
- [ ] Google Lighthouse: Performance >85, Accessibility >90
- [ ] No health card numbers, names, or personal health data stored anywhere
- [ ] All environment variables documented in .env.example
- [ ] CLAUDE.md is accurate and up to date before any PR is merged