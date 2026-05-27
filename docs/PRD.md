# KidsCare Ontario — Product Requirements Document

**Version:** 1.0
**Date:** 2026-05-25
**Phase:** v1 (Urgent Care Finder + Pediatrician Finder)

---

## 1. Problem Statement

Ontario parents currently have no single place to answer three urgent questions when their child is sick:

1. "Can I go directly to a pediatrician, or do I need a referral?"
2. "Which walk-in clinics near me see kids right now — and are any open this weekend or after 6pm?"
3. "Is this prescription free for my kid?"

Today, answering these questions means: calling clinics one by one during business hours, hunting through CPSO listings that don't show availability, navigating multiple government websites for wait times, and arriving at the pharmacy counter not knowing whether you'll pay. Parents lose hours in the best case, and in the worst case, delay care.

KidsCare Ontario answers all three questions fast, in one place, on mobile.

---

## 2. Target Users

### Primary: Ontario parents of children 0–17

| Segment | Need |
|---------|------|
| **New parents (0–2 yrs)** | Finding a pediatrician for the first time. Often unaware that most pediatricians require a referral from a family doctor or walk-in clinic. High urgency for acute issues after-hours. |
| **Parents of young children (2–12 yrs)** | After-hours and weekend care when the family doctor is closed. Finding walk-in clinics that see children. |
| **Parents of teens (13–17 yrs)** | Teens who saw a pediatrician as children may need continued specialist care or transition support. Mental health resources. |
| **Parents of children with ongoing conditions** | Specialist pediatricians, referral navigation, drug coverage. Power users of the platform. |
| **Parents without a family doctor** | Ontario-wide shortage means many families have no GP at all. These parents use walk-in clinics for everything — they need to know which ones see kids and which pediatricians accept self-referral. Cross-cutting segment that affects all others. |

### Secondary: Healthcare providers
- Clinic administrators who want to update their listing (premium, Phase 3+)
- Pediatricians verifying their own accepting status

### Geography
- **v1 scope:** Greater Toronto Area (GTA) including **Milton** and Halton Region — Toronto, Peel, York, Durham, Halton
- **Future:** Expand to Ottawa, Hamilton, London, then province-wide

---

## 3. Product Scope (v1)

### In scope
- **Urgent Care Finder** — Walk-in clinics, ER wait times, virtual care options
- **Pediatrician Finder** — Search, referral flagging, community verification, roster alerts
- **User Accounts** — Save favorites, set postal code, manage alert subscriptions

### Explicitly out of scope for v1
- Prescription drug coverage checker (Phase 2)
- Family doctor finder and alerts (Phase 3)
- Daycare finder and CWELCC tools (Phase 4)
- Appointment booking of any kind
- Clinical recommendations, diagnoses, or triage
- Trillium subsidy calculator (link to official tool only)
- Expansion beyond Ontario
- Premium/monetization features

---

## 4. Feature Descriptions

### 4.1 Urgent Care Finder

**User story:** "My child is sick on a Saturday evening. Show me walk-in clinics near me that see children and are open right now, plus the nearest ER wait times as a backup."

#### Walk-in Clinic Search
- Search by postal code or geolocation
- Results sorted by distance (nearest first)
- Each card shows: name, address, distance, phone, open/closed now, `sees_children` flag, `same_day_booking_required` warning if applicable
- **Weekend & after-hours filters** — dedicated toggles for "Open Saturday," "Open Sunday," "Open after 6pm." These are the highest-value signals for a stressed parent and must be prominent.
- "Open right now" filter — respects current day and time against hours JSONB
- Virtual care always shown as a persistent third option alongside clinics and ER

#### ER Wait Times
- Display nearest hospitals with current wait times by urgency level
- Data pulled from Ontario Wait Time Information System (data.ontario.ca)
- Show data source attribution and last-updated timestamp
- Auto-refresh every 15 minutes

#### Community Flagging
- Every clinic card has a "This info is outdated?" button
- Flagged clinics marked with `community_flagged = true` for manual review
- Does not remove clinic from results — only adds a visual warning

### 4.2 Pediatrician Finder

**Context:** In Ontario, most healthy children receive all their care from a family doctor (GP) and never see a pediatrician. Pediatricians are specialists — reserved for children with complex, chronic, or developmental conditions. The standard path is: family doctor (or walk-in clinic) → referral → pediatrician. However, some pediatricians act as primary care providers and accept self-referrals. For parents without a family doctor (a common situation in Ontario's GP shortage), knowing which pediatricians accept direct self-referral is critical. After-hours and weekend access is especially urgent because family doctors and most pediatrician offices are closed during these times.

**User story:** "It's Saturday evening. My child has a recurring issue our family doctor couldn't resolve, but she referred us to a pediatrician with a 3-month wait. Is there a pediatrician near me who can see my child sooner — or a pediatric walk-in clinic open now?"

**User story:** "I don't have a family doctor. I need a pediatrician for my 3-year-old who speaks Mandarin, is accepting new patients, and doesn't require a referral I can't get."

#### Search
- Search by postal code or geolocation
- Filters: accepting patients (yes/no), referral required (yes/no), primary care vs. specialist, languages spoken
- **After-hours filter:** "Open evenings/weekends" — dedicated filter for pediatric practices and pediatric walk-in clinics with extended hours
- Results sorted by distance

#### Doctor Card (must display all of the following)
- Name, specialty, address, distance, phone
- **Referral status** — "No referral needed" (green) or "Referral required" (amber) — never ambiguous
- **Accepting status** — Accepting / Waitlist / Not accepting / Unknown
- **Verification badge** — "Confirmed by [N] parents · [X] days ago"
- **Languages** spoken
- **Staleness warning** — if last verified > 30 days, show visual indicator

#### Community Verification System (core trust mechanic)
1. Any logged-in user can report a doctor's accepting status
2. They select: how they confirmed (called office / visited / received appointment / told by receptionist), what the status is, and optionally add a note
3. Status updates when 2+ verifications in the last 30 days agree
4. Status reverts to `unknown` after 90 days with no verifications
5. When status flips to `accepting`, all alert subscribers fire within 1 hour

#### Roster Alerts
- Subscribe to a specific doctor: "Notify me when Dr. X opens their roster"
- Subscribe to a postal code: "Notify me when any pediatrician within 10km opens their roster"
- Optional filters: doctor type (primary care only), language
- Free tier: up to 5 alerts
- Notification via email (Resend); push notifications in future phase

### 4.3 User Accounts

**User story:** "I want to save my postal code and favourite clinics so I don't have to re-enter everything each time."

- Supabase Auth — email + Google OAuth
- Profile: postal code (default for all searches), saved clinics, saved doctors
- Alert management: view, pause, delete subscriptions
- No personal health information stored — postal code only for location

---

## 5. Business Rules

### Referral Rules

**The Ontario model:** Family doctors are the primary care gatekeepers. Most children receive routine care from a family doctor, not a pediatrician. Pediatricians are specialists — typically accessed via referral from a family doctor, nurse practitioner, walk-in clinic physician, or midwife.

- **Primary care pediatricians:** Act as a child's main doctor. No referral needed. These are rare and high-demand. Clearly labelled "No referral needed — accepts self-referral."
- **Specialist/consulting pediatricians:** Require a referral from a family doctor, walk-in clinic, nurse practitioner, or midwife. Clearly labelled "Referral required — ask your family doctor or visit a walk-in clinic."
- **Walk-in clinics can issue referrals:** If the parent doesn't have a family doctor, a walk-in clinic visit can yield both immediate care AND a referral to a specialist pediatrician. Surface this path in the UI so parents know their options.
- This distinction must be visible on every doctor card. Never leave it ambiguous.

### OHIP+ Rule (referenced in v1, implemented in Phase 2)
- Covers anyone 24 or under NOT covered by a private drug plan
- 5,000+ drugs at no cost
- Check drug name against ODB formulary
- Always link to official ontario.ca source for eligibility details

### Community Verification Logic
- 2+ agreeing verifications in 30 days → status updates
- 0 verifications in 90 days → status reverts to unknown
- `verification_count` = number of supporting verifications in last 60 days
- `last_verified` = most recent verification timestamp
- When status flips to `accepting` → fire all matching alerts within 1 hour

### Weekend / After-Hours
- Google Places API `periods[]` array → parse Saturday (day=6), Sunday (day=0)
- Compute `open_saturday`, `open_sunday` booleans
- Parse weekday periods → flag `open_after_6pm`
- Store all in clinics table
- Surface as prominent filter badges — these clinics are rare and high-value

### Data Freshness
| Data | Refresh Frequency |
|------|-------------------|
| ER wait times | Every 15 minutes |
| Doctor profiles (CPSO) | Quarterly |
| Pediatricians accepting patients | Weekly (community) |
| Drug formulary (ODB) | Monthly |
| Clinic hours (Google Places) | Daily |

---

## 6. Success Metrics

### Functional
- Walk-in clinic search returns results for any GTA postal code within 2 seconds
- ER wait times display with data source and last-updated timestamp
- Pediatrician search returns results for any GTA postal code
- Every doctor card shows referral status, accepting status, languages, verification badge
- Community verification flow works end-to-end (report → recalculate → notify)
- Roster alerts fire within 1 hour of status change

### Technical
- **Mobile responsive:** Works on iOS Safari and Android Chrome
- **Performance:** Google Lighthouse >85 Performance, >90 Accessibility
- **Privacy:** No PHI stored anywhere. No health card numbers, no patient names, no clinical data.

### Launch Readiness
- All environment variables documented in `.env.example`
- CLAUDE.md is accurate and up to date
- GTA walk-in clinic database seeded with ≥100 clinics
- Pediatrician database seeded with ≥200 doctors
- ER wait time pipeline functional and auto-refreshing

---

## 7. Non-Functional Requirements

### Performance
- All search queries ≤ 2 seconds for GTA postal codes
- Server-side rendering for initial page loads
- Client-side navigation for filter changes (no full-page reloads)

### Mobile
- Primary target: mobile Safari (iOS) and Chrome (Android)
- Touch-friendly: minimum 44px tap targets
- No horizontal scroll at 375px viewport width

### Accessibility
- WCAG 2.1 AA target
- All interactive elements keyboard-navigable
- Color is never the sole indicator of status (accompany with text labels)

### Privacy & Compliance (PIPEDA)
- No personal health information stored — ever
- Postal code used for search and alerts only
- Email collected for alerts — purpose documented at collection point
- No names, health card numbers, or clinical data
- Canadian data residency (Supabase)

### Security
- CSP headers on all pages
- API rate limiting on all routes (stricter for write operations)
- All inputs validated with Zod
- Supabase Row-Level Security on all tables
- `SUPABASE_SECRET_KEY` never exposed to client

---

## 8. Assumptions & Open Questions

### Assumptions
- Google Places API data is sufficiently accurate for clinic hours (community flagging is the fallback)
- CPSO public register can be scraped within their ToS (verify before building scraper)
- GTA parents will use postal code search (not full-text address)
- Ontario ER wait time dataset remains publicly available and updated
- Supabase free tier is sufficient for v1 launch traffic

### Open Questions
- **CPSO scraping:** Is there an API or bulk data export? If scraping is the only path, what's the legal risk?
- **Google Maps API cost:** What's the estimated monthly cost at projected v1 traffic? Need budget cap.
- **Community verification trust:** Could malicious actors game the verification system? Mitigation: rate limiting, requiring auth, minimum account age.
- **Pediatricians Alliance data:** Has permission been obtained to use their directory as seed data?
- **GTA-only scope:** When does expansion to Ottawa/Hamilton become a priority?

---

## 9. Appendix: Future Phases

### Phase 2 — Prescription Coverage Checker (planned weeks 11–18)
- ODB formulary ingestion from data.ontario.ca
- OHIP+ eligibility check: drug name → covered/not covered + cost
- Nearest pharmacies open now, ODB-accepting, 24hr flag
- Trillium eligibility explainer (link to official tool)

### Phase 3 — Family Doctor Alerts + Monetization (months 5–8)
- Family doctor roster alerts
- Premium subscription (unlimited alerts, instant notifications)
- Clinic premium listings
- Virtual care affiliate links

### Phase 4 — Daycare Module (separate product, post-v1)
- Fully documented in separate spec
- Not built until Phase 1 is live with real users
