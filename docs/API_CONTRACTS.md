# KidsCare Ontario — API Contracts

**Version:** 1.0
**Date:** 2026-05-26
**Phase:** v1 (Urgent Care Finder + Pediatrician Finder)

---

## 1. Conventions

### Base URL
- Development: `http://localhost:3000/api`
- Production: `https://<domain>/api`

### Authentication
- Public endpoints: no auth required
- Authenticated endpoints: Supabase session cookie (`sb-access-token`)
- Cron endpoints: `Authorization: Bearer <CRON_SECRET>` header

### Error Shape

All errors return:
```json
{
  "error": "Human-readable message",
  "details": {}  // optional, Zod validation errors or additional context
}
```

### Rate Limiting

| Endpoint Type | Limit |
|---------------|-------|
| Read endpoints | 60 req/min per IP |
| Write endpoints (verify, flag, alert create) | 10 req/min per authenticated user |
| Cron endpoints | No limit (CRON_SECRET-gated) |

Rate limit headers on all responses:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 47
X-RateLimit-Reset: 1716936000
```

### Input Validation

All request bodies and query params validated with Zod `.strict()` — unknown fields rejected with 400.

---

## 2. Clinics

### `GET /api/clinics`

Search walk-in clinics.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `lat` | float | yes | Latitude |
| `lng` | float | yes | Longitude |
| `radius` | int | no | Search radius in km (default 10, max 50) |
| `open_now` | boolean | no | Only clinics currently open |
| `sees_children` | boolean | no | Only clinics that see children |
| `open_saturday` | boolean | no | Only clinics open Saturdays |
| `open_sunday` | boolean | no | Only clinics open Sundays |
| `open_after_6pm` | boolean | no | Only clinics open after 6pm on weekdays |
| `limit` | int | no | Max results (default 20, max 50) |
| `offset` | int | no | Pagination offset (default 0) |

**Success 200:**
```json
{
  "results": [
    {
      "id": "uuid",
      "name": "string",
      "address": "string",
      "distance_km": 2.3,
      "phone": "string",
      "hours": {
        "0": { "open": "09:00", "close": "17:00" },
        "1": { "open": "09:00", "close": "17:00" }
      },
      "is_open_now": true,
      "open_saturday": false,
      "open_sunday": false,
      "open_after_6pm": true,
      "sees_children": true,
      "same_day_booking_required": false,
      "is_pediatric_only": false,
      "virtual_care_available": true,
      "community_flagged": false
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

**Errors:**
- `400` — Invalid lat/lng values or missing required params
- `429` — Rate limited

---

### `GET /api/clinics/[id]`

Single clinic detail.

**Success 200:** Same shape as list item, plus `last_flagged_at` and `created_at`.

**Errors:**
- `404` — Clinic not found

---

### `POST /api/clinics/[id]/flag`

Report outdated clinic info. Requires authentication.

**Request Body (Zod):**
```typescript
z.object({
  reason: z.enum(["hours_wrong", "address_wrong", "closed_permanently", "no_longer_sees_children", "other"]),
  note: z.string().max(500).optional(),
}).strict()
```

**Success 200:**
```json
{
  "flagged": true,
  "message": "Thank you. We'll review this clinic's information."
}
```

**Errors:**
- `400` — Invalid body
- `401` — Not authenticated
- `404` — Clinic not found
- `429` — Rate limited (10/min per user)

---

## 3. Doctors

### `GET /api/doctors`

Search pediatricians and family doctors.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `lat` | float | yes | Latitude |
| `lng` | float | yes | Longitude |
| `radius` | int | no | Search radius in km (default 10, max 50) |
| `doctor_type` | enum | no | `pediatrician_primary`, `pediatrician_specialist`, `family_doctor` |
| `accepting_status` | enum | no | `accepting`, `waitlist`, `not_accepting`, `unknown` |
| `referral_required` | boolean | no | true = specialists only, false = primary care only |
| `language` | string | no | Single language filter (e.g., "Mandarin") |
| `limit` | int | no | Max results (default 20, max 50) |
| `offset` | int | no | Pagination offset (default 0) |

**Success 200:**
```json
{
  "results": [
    {
      "id": "uuid",
      "cpso_id": "string",
      "name": "string",
      "specialty": "string",
      "doctor_type": "pediatrician_primary",
      "referral_required": false,
      "accepting_status": "accepting",
      "languages": ["English", "Mandarin"],
      "address": "string",
      "distance_km": 1.8,
      "phone": "string",
      "website": "string | null",
      "virtual_visits_available": false,
      "age_range_min": 0,
      "age_range_max": 18,
      "verification": {
        "last_verified": "2026-05-20T14:30:00Z",
        "verification_count": 3,
        "is_stale": false,
        "stale_days": 6
      }
    }
  ],
  "total": 28,
  "limit": 20,
  "offset": 0
}
```

**Verification badge rules:**
- `is_stale` = true when `last_verified` > 30 days ago
- `stale_days` = days since `last_verified`
- If `verification_count == 0` → "No community data yet — be the first to verify"
- If `is_stale` → "Last confirmed [stale_days] days ago — may be outdated"
- If `accepting_status == 'unknown'` and verification_count > 0 → "Status unknown — not verified in 90+ days"

**Errors:**
- `400` — Invalid lat/lng or filter values
- `429` — Rate limited

---

### `GET /api/doctors/[id]`

Single doctor detail.

**Success 200:** Same shape as list item. Additionally includes recent verifications (last 5, anonymized):
```json
{
  "...": "...",
  "recent_verifications": [
    {
      "reported_status": "accepting",
      "how_confirmed": "called_office",
      "created_at": "2026-05-20T14:30:00Z"
    }
  ]
}
```

**Errors:**
- `404` — Doctor not found

---

### `POST /api/doctors/[id]/verify`

Submit a community verification. Requires authentication.

**Request Body (Zod):**
```typescript
z.object({
  reported_status: z.enum(["accepting", "waitlist", "not_accepting"]),
  how_confirmed: z.enum([
    "called_office",
    "visited_in_person",
    "received_appointment",
    "told_by_receptionist",
  ]),
  notes: z.string().max(500).optional(),
}).strict()
```

**Success 200:**
```json
{
  "verified": true,
  "doctor": {
    "id": "uuid",
    "accepting_status": "accepting",
    "verification": {
      "last_verified": "2026-05-26T10:15:00Z",
      "verification_count": 4,
      "is_stale": false,
      "stale_days": 0
    }
  },
  "alerts_triggered": 2
}
```

`alerts_triggered` is the number of alert subscribers notified because the status flipped to `accepting`. Non-zero only when `accepting_status` actually changed.

**Business logic executed on insert:**
1. Insert verification row
2. Count agreeing verifications in last 30 days
3. If ≥2 → update doctor's `accepting_status` and `verification_count`
4. If new status is `accepting` and previous was not → query matching alerts → dispatch emails
5. Return updated doctor

**Errors:**
- `400` — Invalid body
- `401` — Not authenticated
- `404` — Doctor not found
- `429` — Rate limited (10/min per user)

---

## 4. ER Wait Times

### `GET /api/er-waits`

Get nearest hospital ER wait times.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `lat` | float | yes | Latitude |
| `lng` | float | yes | Longitude |
| `radius` | int | no | Search radius in km (default 20, max 50) |
| `limit` | int | no | Max results (default 10, max 20) |

**Success 200:**
```json
{
  "results": [
    {
      "id": "uuid",
      "hospital_name": "string",
      "address": "string",
      "distance_km": 3.5,
      "wait_times": {
        "non_urgent": { "minutes": 120, "display": "2 hours" },
        "urgent": { "minutes": 45, "display": "45 minutes" },
        "emergent": { "minutes": 10, "display": "10 minutes" }
      },
      "last_updated": "2026-05-26T10:00:00Z",
      "fetched_at": "2026-05-26T10:14:00Z",
      "is_stale": false
    }
  ],
  "data_source": "Ontario Wait Time Information System",
  "data_source_url": "https://data.ontario.ca/dataset/wait-time-information-system",
  "fetched_at": "2026-05-26T10:14:00Z"
}
```

**Staleness:**
- `is_stale` = true when `last_updated` > 1 hour ago
- All results include `fetched_at` (when we retrieved from source) and `last_updated` (when hospital reported)
- Top-level `fetched_at` shows when our pipeline last ran

**Errors:**
- `400` — Invalid lat/lng
- `429` — Rate limited

---

## 5. Alerts

All alert endpoints require authentication. Users can only access their own alerts.

### `GET /api/alerts`

List current user's alert subscriptions.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | int | no | Default 20, max 50 |
| `offset` | int | no | Default 0 |

**Success 200:**
```json
{
  "results": [
    {
      "id": "uuid",
      "alert_type": "doctor",
      "target_id": "uuid | null",
      "doctor_name": "Dr. Smith | null",
      "postal_code": "M5V2T6 | null",
      "radius_km": 10,
      "doctor_type_filter": "pediatrician_primary | null",
      "language_filter": "Mandarin | null",
      "last_notified_at": null,
      "created_at": "2026-05-26T10:00:00Z"
    }
  ],
  "total": 3,
  "limit": 20,
  "offset": 0,
  "max_alerts": 5,
  "remaining": 2
}
```

---

### `POST /api/alerts`

Create a new alert subscription.

**Request Body (Zod):**
```typescript
z.object({
  alert_type: z.literal("doctor"),
  target_id: z.string().uuid().optional(),
  postal_code: z.string().regex(/^[A-Za-z]\d[A-Za-z]\d[A-Za-z]\d$/).optional(),
  radius_km: z.number().int().min(5).max(50).default(10),
  doctor_type_filter: z.enum(["pediatrician_primary", "family_doctor"]).optional(),
  language_filter: z.string().max(50).optional(),
}).strict()
  .refine(data => data.target_id || data.postal_code, {
    message: "Either target_id (specific doctor) or postal_code (area alert) is required",
  })
```

**Success 201:**
```json
{
  "id": "uuid",
  "...": "...",
  "created_at": "2026-05-26T10:00:00Z"
}
```

**Errors:**
- `400` — Invalid body, missing target, validation error
- `401` — Not authenticated
- `403` — Free tier limit reached (5 alerts max)
- `429` — Rate limited

---

### `DELETE /api/alerts/[id]`

Delete an alert subscription. User must own the alert.

**Success 200:**
```json
{
  "deleted": true
}
```

**Errors:**
- `401` — Not authenticated
- `403` — Alert belongs to another user
- `404` — Alert not found

---

## 6. Auth

### `GET /api/auth/session`

Get current session state. Used by client to check if logged in.

**Success 200:**
```json
{
  "authenticated": true,
  "user": {
    "id": "uuid",
    "email": "string"
  }
}
```

Or:
```json
{
  "authenticated": false,
  "user": null
}
```

### `GET /api/auth/callback`

Supabase auth callback. Handles email magic link verification and OAuth redirect. Managed by Supabase client library. No custom implementation needed.

---

## 7. Cron (Internal)

All cron endpoints are internal. They require `Authorization: Bearer <CRON_SECRET>` and are only called by Vercel Cron Jobs.

### `POST /api/cron/refresh-er-waits`

Fetch latest ER wait times from Ontario open data.

**Success 200:**
```json
{
  "refreshed": true,
  "hospitals_updated": 45,
  "fetched_at": "2026-05-26T10:15:00Z"
}
```

**Errors:**
- `401` — Missing or invalid CRON_SECRET
- `502` — Upstream source unavailable (last-known data preserved)

### `POST /api/cron/refresh-clinics`

Refresh clinic hours from Google Places API for all clinics with a `place_id`.

**Success 200:**
```json
{
  "refreshed": true,
  "clinics_updated": 287,
  "clinics_failed": 3,
  "fetched_at": "2026-05-26T03:00:00Z"
}
```

Failed clinics logged individually to Sentry. Individual failures do not block the batch.

**Errors:**
- `401` — Missing or invalid CRON_SECRET
- `502` — Google Places API unavailable

### `POST /api/cron/expire-verifications`

Revert doctor accepting status to `unknown` when no verifications in 90+ days.

**Success 200:**
```json
{
  "expired": true,
  "doctors_reverted": 12,
  "fetched_at": "2026-05-26T04:00:00Z"
}
```

### `POST /api/cron/seed-*`

One-time data seeding endpoints (disabled in production after initial seed):
- `POST /api/cron/seed-postal-codes` — Load postal code dataset
- `POST /api/cron/seed-clinics` — Initial Google Places clinic import
- `POST /api/cron/seed-doctors` — CPSO + PAO doctor import
