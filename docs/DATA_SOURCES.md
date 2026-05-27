# KidsCare Ontario — Data Sources

**Version:** 1.0
**Date:** 2026-05-26
**Phase:** v1 (Urgent Care Finder + Pediatrician Finder)

---

## 1. Postal Code Dataset

### Purpose
Convert Canadian postal codes to lat/lng coordinates at query time without an external geocoding API.

### Source Options

| Source | Format | Cost | Coverage |
|--------|--------|------|----------|
| **geocoder.ca bulk data** | CSV | Free with attribution | All Canada |
| **Statistics Canada PCCF** | Proprietary | Requires license (~$1,500) | Official, most accurate |
| **Self-hosted Nominatim** | One-time geocode run | Free (your compute) | As-needed |

**Recommendation:** Start with geocoder.ca or an open postal code dataset for v1. If accuracy issues surface for rural/remote postal codes, evaluate the official PCCF license.

### Table Schema

| Column | Type | Description |
|--------|------|-------------|
| postal_code | text (PK) | Normalized: no space, uppercase. e.g. "M5V2T6" |
| lat | float8 | Latitude |
| lng | float8 | Longitude |
| city | text | City/town name |
| province | text | Province code ("ON") |

### Seeding Strategy

1. Download postal code dataset for Ontario (~300,000 FSA/LDU combinations)
2. Filter to GTA FSAs for v1 seed (~50,000 rows)
3. Normalize: strip spaces, uppercase
4. Bulk insert into `postal_codes` table via seed script
5. Add full Canada dataset when expanding beyond GTA

### Query Pattern

```sql
-- Exact match on normalized postal code
SELECT lat, lng FROM postal_codes WHERE postal_code = 'M5V2T6';

-- Prefix search (first 3 chars = FSA) for "nearby" fallback
SELECT lat, lng FROM postal_codes WHERE postal_code LIKE 'M5V%' LIMIT 1;
```

### Edge Cases
- **User enters postal code with space:** Normalize before lookup (strip spaces, uppercase)
- **Invalid format:** Validate with regex `/^[A-Za-z]\d[A-Za-z]\d[A-Za-z]\d$/` before query
- **New postal code not in dataset:** Fall back to FSA-level centroid (first 3 characters)
- **User shares browser geolocation:** Skip postal code lookup entirely — use lat/lng directly

---

## 2. Ontario ER Wait Times

### Source
- **URL:** `https://data.ontario.ca/dataset/wait-time-information-system`
- **Owner:** Ontario Ministry of Health
- **Update frequency:** Provider-dependent (hospitals report at varying intervals)
- **Format:** Verify at fetch time — historically CSV; check for API endpoint

### Data Fields (Expected)

| Field | Description |
|-------|-------------|
| Hospital name | Full hospital name |
| Address / location | Used to geocode hospital → coords |
| Urgency level | "Non-urgent", "Urgent", "Emergent" |
| Wait time (minutes) | Current estimated wait by urgency |
| Last updated | When the hospital reported this figure |

### Refresh Pipeline

1. Vercel cron hits `/api/cron/refresh-er-waits` every 15 minutes
2. Endpoint validates `CRON_SECRET` from Authorization header
3. Fetch latest CSV/JSON from data.ontario.ca
4. Parse and validate each row (Zod schema)
5. Upsert into `er_wait_times` table: match on hospital name + urgency level
6. Set `fetched_at = now()` for freshness tracking

### Resilience
- **Source down:** Serve last-known data with "Last updated [timestamp] — data may be delayed" warning
- **Stale data (>1 hour):** Show yellow staleness indicator; >4 hours = red indicator with disclaimer
- **Parse errors:** Log to Sentry, skip malformed rows, continue with valid rows

---

## 3. CPSO Physician Register

### Source
- **URL:** `https://register.cpso.on.ca`
- **Owner:** College of Physicians and Surgeons of Ontario
- **Format:** Web page (server-rendered HTML)

### Legal Check (DO BEFORE BUILDING)

- [ ] Review CPSO Terms of Service for scraping restrictions
- [ ] Check `robots.txt` for disallowed paths
- [ ] Check if CPSO offers a bulk data export or API
- [ ] Confirm rate limiting compliance (max 1 req/second)

### Data Fields to Extract

| Field | DB Column | Notes |
|-------|-----------|-------|
| CPSO number | `cpso_id` (unique) | Primary match key |
| Full name | `name` | |
| Specialty | `specialty` | Parse to determine `doctor_type` |
| Practice address | `address` | Geocode via postal code table |
| Phone | `phone` | |
| Languages | `languages` (text[]) | Parse from profile |
| Accepting patients | `accepting_status` | May not be on CPSO — flag as `unknown` if absent |

### Scraper Design

```
Tool: cheerio (if static HTML) or Playwright (if JS-rendered)
Rate: 1 request/second minimum delay
Schedule: Vercel cron, quarterly
Output: Upsert into doctors table, matching on cpso_id
```

### Doctor Type Classification

| CPSO Specialty Pattern | doctor_type | referral_required |
|------------------------|-------------|-------------------|
| "Pediatrics" (general) | `pediatrician_primary` | false |
| "Pediatric [Subspecialty]" | `pediatrician_specialist` | true |
| "Family Medicine" | `family_doctor` | false |

This classification must be reviewed by a human. Start with rules, flag uncertain cases for manual review.

---

## 4. Pediatricians Alliance of Ontario

### Source
- **URL:** `https://pedsallianceontario.ca/find-a-pediatrician`
- **Owner:** Pediatricians Alliance of Ontario
- **Format:** Web page directory

### Permission Status
- [ ] **Contact PAO before using data.** Verify permission to include their directory as seed data.
- [ ] Confirm attribution requirements.

### Data Fields

| Field | Notes |
|-------|-------|
| Name | Match/merge with CPSO data on name + address |
| Address | |
| Phone | |
| Accepting patients | Often explicitly stated — primary source for `accepting_status` |
| Languages | |
| Special notes | e.g., "accepting newborns only", "referral required" |

### Merge Strategy with CPSO

1. Match PAO entries to CPSO entries by name + postal code proximity
2. PAO data wins for `accepting_status` (more current)
3. CPSO data wins for `cpso_id`, `specialty`, `languages` (more authoritative)
4. Unmatched PAO entries → insert as new doctors with `source = 'pediatricians_alliance'`
5. Flag confidence level on each match

---

## 5. Google Places API

### Scope
Used **server-side only** for clinic data seeding and daily hours refresh. Never called from client code or in response to user queries.

### APIs Called

| API | Purpose | When |
|-----|---------|------|
| Nearby Search (Pro) | Find walk-in clinics in GTA | One-time seed |
| Place Details | Get full hours (`periods[]`), address, phone | Seed + daily cron refresh |

### Place Details Fields Requested (Field Mask)

```
places.id
places.displayName
places.formattedAddress
places.nationalPhoneNumber
places.location
places.regularOpeningHours.periods
```

Using field masks reduces per-request cost under the new 2025 pricing model.

### Hours Parsing

Google Places `periods[]` returns:
```json
{
  "open": { "day": 1, "hour": 9, "minute": 0 },
  "close": { "day": 1, "hour": 17, "minute": 0 }
}
```

We compute on import:
- `open_saturday` = any period where `open.day == 6` with non-zero duration
- `open_sunday` = any period where `open.day == 0` with non-zero duration
- `open_after_6pm` = any weekday period (day 1-5) where `close.hour >= 18`

Store raw `periods[]` as `hours` JSONB alongside computed booleans.

### Cost Estimate (v1 GTA)

| Operation | Count | Cost |
|-----------|-------|------|
| One-time seed: Nearby Search for GTA clinics | ~50 requests (3km grid search) | ~$1.50 |
| One-time seed: Place Details for each clinic | ~300 requests | ~$5 |
| Daily refresh: Place Details | 300/day = ~9,000/month | ~$5/month |

Total: well under $20/month even at peak. Within Google's free tier for the Pro plan.

### API Key Security

- **Key type:** IP-restricted (not HTTP referrer)
- **Restricted to:** Vercel server IP ranges
- **Env var:** `GOOGLE_MAPS_API_KEY` (NOT `NEXT_PUBLIC_`)
- **Used in:** Cron route handlers only (`/api/cron/refresh-clinics`)

---

## 6. Data Freshness Matrix

| Data | Source | Refresh | Stale Threshold | Stale Behavior |
|------|--------|---------|-----------------|----------------|
| ER wait times | data.ontario.ca | Every 15 min | >1 hour | Yellow warning; >4 hours red warning |
| Clinic hours | Google Places | Daily (3am EST) | >48 hours | "Hours may not be current" badge |
| Clinic flags (sees_children, etc.) | Manual | Never (manual) | N/A | Community flag triggers review |
| Doctor profiles | CPSO | Quarterly | >120 days | "Profile may be outdated" note |
| Doctor accepting status | Community verifications | Continuous | >30 days | Yellow staleness indicator |
| Doctor accepting status | Community verifications | — | >90 days | Revert to `unknown`, prompt verification |
| Drug formulary | data.ontario.ca | Monthly | >45 days | "Formulary may be outdated" warning |
| Postal codes | Seed dataset | One-time | N/A | New codes handled by FSA fallback |

---

## 7. Fallback & Resilience

### When a Source is Unavailable

| Source | Failure Mode | Fallback |
|--------|-------------|----------|
| ER wait times API down | Fetch fails 3 consecutive times | Serve last-known data with timestamp + warning. Alert via Sentry. |
| Google Places API down | Daily refresh fails | Skip refresh. Clinics retain last-known hours. No user impact for days. |
| CPSO scraper broken | Site structure changed | Alert via Sentry. Serve existing doctor data. Flag profiles with `source='cpso'` and `updated_at > 120 days`. |
| Postal code lookup miss | New code or typo | Fall back to FSA centroid (first 3 chars). If still miss, prompt user to share geolocation instead. |

### Cross-Cutting Resilience Rules
- **All external fetches have 10-second timeout.** If the source doesn't respond, fail fast and use cached data.
- **Never block a user request on an external API.** All external data comes through cron pipelines, never through request-path code.
- **Log all fetch failures to Sentry** with source name and error type for monitoring.
- **Cache everything.** Database is the cache. No external API call at query time for any feature.
