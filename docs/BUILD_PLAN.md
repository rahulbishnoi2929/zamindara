# Build Plan

**Phase by phase: what gets built, what gets tested, what gets done.**

[ROADMAP.md](ROADMAP.md) is the business view — seasons, captains, targets. This is the engineering view: the order of work, the gate at the end of each phase, and the test that proves the gate was passed.

**Today: 15 August 2026. The wheat harvest in Fazilka is April 2027.** Roughly eight months, one person.

---

## The whole thing at a glance

| # | Phase | When | Gate |
|---|---|---|---|
| **0** | Foundations — units, geometry, walk app | Aug 2026 | ✅ **done** |
| **1** | Prove the measurement in a real field | Late Aug | 🚦 within 2% / 4% vs jamabandi |
| **2** | Backend — Supabase, PostGIS, auth, sync | Sep | Field walked on phone appears in Postgres |
| **3** | Captain onboarding + machine registry | Sep–Oct | You register a real captain on his own phone |
| **4** | Jobs and dispatch | Oct | A request reaches a captain and he accepts |
| **5** | Notifications, queue, job lifecycle | Oct–Nov | Accept from the lock screen, job runs to completion |
| **6** | 🔴 **Soft launch — sowing window** | Nov | 40 real jobs, 50 captains |
| **7** | Admin console, ratings, hardening | Dec | Every failure from Nov is fixed |
| **8** | Migrant combine mode | Jan–Feb 2027 | Ganganagar operator pre-books into Fazilka |
| **9** | Harvest readiness | Mar | Survives peak-load rehearsal |
| **10** | 🔴 **The season** | Apr 2027 | 250 jobs, >40% repeat |

Phases 6 and 10 are the two that matter. Everything before 6 exists to make 6 possible; everything between 6 and 10 exists to make 10 survivable.

---

## Testing strategy

Different phases need different proof. Reaching for the wrong kind wastes time and, worse, gives false confidence.

| Layer | Applies to | How |
|---|---|---|
| **Unit** | `packages/units`, `packages/geo` | Vitest. Every conversion, every edge case. Already 65 tests. |
| **Statistical** | Geometry accuracy | Hundreds of simulated walks over known fields. Bias and worst case, not one lucky seed. |
| **Schema / RLS** | Database | SQL tests asserting a farmer cannot read another farmer's field boundary. |
| **Integration** | Dispatch, pricing | Seeded database, run the function, assert the outcome. |
| **Device** | Anything touching GPS, push, battery | A real Android phone. Emulators lie about all three. |
| **Field** | Measurement, and the whole product | Standing in a field in Fazilka. Nothing else substitutes. |

**The rule:** anything that touches money or area gets a unit test *before* it gets a UI. `packages/units` was built that way and it stays that way.

---

## Phase 0 — Foundations ✅

*August 2026 — complete*

**Built**

- `packages/units` — killa/kanal/bigha/marla, compound display, Gurmukhi and Devanagari parsing · **41 tests**
- `packages/geo` — filter → smooth → simplify → rectangle fit · **24 tests**
- `apps/mobile` — Expo SDK 57, walk + satellite confirmation · bundles clean
- Ten product documents

**What it already taught us**

Three design assumptions died here, before any of them could cost a season:

- The speed filter was rejecting 150 of 196 honest GPS fixes
- A minimum bounding rectangle inflates area by ~22%
- Karam grid snapping — the original premise — makes accuracy *worse*, and ships off

**Still open:** never run on a physical device.

---

## Phase 1 — Prove the measurement 🚦

*Late August 2026 · ~2 weeks · **this is a gate***

Nothing else gets built until this passes. If a walked boundary does not match a farmer's papers, every downstream feature is built on sand.

**Build**

- [ ] Development build on a real Android phone (`npx expo run:android`)
- [ ] Google Maps API key wired into `app.json`
- [ ] **Field-test recorder** — a screen that captures, per plot: walked area, jamabandi area, plot size, GPS accuracy, walk duration, and whether the corners needed dragging
- [ ] CSV export so the results can be analysed rather than remembered

**Test**

- [ ] **20 real plots in Fazilka**, each with a known jamabandi area
- [ ] Deliberately spread the sizes: at least 5 under one killa, at least 5 over two
- [ ] Walk 5 of them **twice** to measure real repeatability
- [ ] Record GPS accuracy alongside every walk
- [ ] Device test: battery drain over a 20-minute walk, screen off
- [ ] Device test: airplane mode throughout — the walk must survive and recover

**Do**

- [ ] Ask 3–4 farmers you know for access and their jamabandi numbers
- [ ] Watch someone who is *not* you use the app, without helping

**Gate — all must pass**

| Check | Bar |
|---|---|
| Plots ≥ 2 killa | within **2%** |
| Plots < 2 killa | within **4%** |
| Two walks of the same plot | agree within **3%** |
| Walk survives airplane mode | recovered on relaunch |
| Battery, 20-min walk | under 10% |

**If it fails:** stop. Do not build features on top of a broken measurement. Fall back to draw-on-satellite as the primary method and re-plan.

**Also settle here**

- Does karam snapping help on *real* canal-colony plots? (Simulation said no.)
- Is real correlated GPS error worse than the independent noise simulated? (Probably yes.)

---

## Phase 2 — Backend foundation

*September 2026 · ~3 weeks*

**Build**

- [ ] Supabase project, PostGIS enabled
- [ ] Full schema from [DATA_MODEL.md](DATA_MODEL.md) as migrations
- [ ] RLS policies on every table
- [ ] Seed data: machine types, services, Fazilka villages, region + unit set
- [ ] Phone OTP auth (MSG91 or Twilio — needs DLT registration in India, start it early)
- [ ] Profile creation, language preference
- [ ] Field sync: local walk → Postgres, with the `area_sqm` trigger computing area **server-side**
- [ ] Generated TypeScript types from the schema

**Test**

- [ ] The area trigger: a client cannot submit its own acreage
- [ ] RLS: farmer A cannot read farmer B's field boundary — this is land records, not public data
- [ ] RLS: a captain sees a field's geometry only through an accepted job
- [ ] Geospatial: `ST_Area` on a stored polygon matches what the app computed
- [ ] Auth: OTP round-trip on a real phone number
- [ ] Sync: walk offline, reconnect, field appears in Postgres unchanged

**Do**

- [ ] Start DLT registration for SMS — it takes weeks and blocks OTP
- [ ] Decide the legal entity (see PRD open questions)

**Gate:** a field walked on your phone in a Fazilka field appears in Postgres with the correct area, and no other account can read it.

---

## Phase 3 — Captain onboarding and machine registry

*Late September – October 2026 · ~3 weeks*

**This is the phase the business actually depends on.** Supply first — an empty marketplace is worthless to a farmer, and a captain will keep the app anyway because his phone is his business line.

**Build**

- [ ] Onboarding flow from [USER_FLOWS.md](USER_FLOWS.md#flow-1--captain-onboarding)
- [ ] **Illustrated machine picker** — pictures of a combine, rotavator, laser leveller. Never an English dropdown.
- [ ] Owned vs **arrangeable** distinction, with lead time
- [ ] Machine photos, compressed hard for 2G
- [ ] `with_operator_only` flag (Balwinder's constraint)
- [ ] Services and rates per machine, with rate *units*
- [ ] Base location + service radius, live map preview
- [ ] Online/offline toggle
- [ ] Farmer/captain/**both** role switching

**Test**

- [ ] Device: full onboarding on a low-end phone, 2 GB RAM
- [ ] Device: photo upload on a 2G connection
- [ ] Every screen complete in Gurmukhi — no English leaking through
- [ ] Arrangeable machines are excluded from instant jobs, included in scheduled ones beyond their lead time
- [ ] A `role = 'both'` account can act as either without re-registering

**Do**

- [ ] **Onboard 5 real captains yourself**, sitting with them
- [ ] Photograph their machines personally — registry quality is a founder-made asset
- [ ] Time it. If onboarding takes over 8 minutes, cut fields until it doesn't.

**Gate:** a real captain in Fazilka completes onboarding on his own phone, in Punjabi, with you watching and not helping.

---

## Phase 4 — Jobs and dispatch

*October 2026 · ~3 weeks*

**Build**

- [ ] Job posting: field → service → timing
- [ ] Seasonally reordered service grid (harvesting first in April, sowing in November)
- [ ] Rate guidance — a *range* from recent nearby jobs, never a single number
- [ ] Price calculation: `(area ÷ unit) × rate + travel beyond 5 km`
- [ ] **Dispatch edge function**: eligibility query, scoring, broadcast to top 5, 90-second timeout, three rounds
- [ ] Live matching screen showing who was pinged and who replied
- [ ] Accept/decline, assignment, cancelling the other dispatches

**Test**

- [ ] **Pricing unit tests before any UI** — money code, same rule as area
- [ ] Dispatch eligibility: right service, right machine, inside radius, online, verified
- [ ] Owned vs arrangeable filtering by job timing
- [ ] Race: two captains accept simultaneously — exactly one wins
- [ ] Timeout escalates to the next five
- [ ] No eligible captains → farmer is told, offered a wider radius
- [ ] Travel charge: 5 km → ₹0, 9 km → 4 × rate

**Do**

- [ ] Ask three captains what they actually charge per killa. Seed the rate ranges with real numbers, not guesses.

**Gate:** you post a job from one phone and a captain accepts on another.

---

## Phase 5 — Notifications, queue, lifecycle

*Late October – November 2026 · ~2 weeks*

**Build**

- [ ] Push via Expo → FCM, dedicated max-importance Android channel, custom loud sound
- [ ] **Full-screen job ping** that wakes the device and behaves like an incoming call
- [ ] Accept/decline as notification actions, no app launch needed
- [ ] Escalation: unanswered in 30 s, ring again
- [ ] Respect declared working hours
- [ ] Captain queue with reorder and distance-sorted suggestion
- [ ] Queue position and ETA visible to the farmer
- [ ] Lifecycle: en route → in progress → completed, photos at start and end
- [ ] Live captain location during an active job, with the tracking intervals from [TECH_ARCHITECTURE.md](TECH_ARCHITECTURE.md#location-tracking)
- [ ] Call button on every job screen
- [ ] Amount and payment mode recorded — settled off-app
- [ ] Offline outbox with retry and idempotency keys

**Test**

- [ ] Device: ping arrives on a locked phone, screen off, app killed
- [ ] Device: accept from the lock screen without opening the app
- [ ] Device: **battery over a 10-hour working day with tracking on** — this is a real uninstall risk
- [ ] Offline: accept a job with no signal, reconnect, no duplicate
- [ ] Doze mode / battery optimisation doesn't kill the ping

**Do**

- [ ] Have a captain tell you whether the alert sound is loud enough over a running combine

**Gate:** a captain accepts a job from his lock screen, drives to a field, and completes it in the app.

---

## Phase 6 — 🔴 Soft launch, sowing window

*November 2026 · live*

**Not a build phase.** A motorcycle, a phone, and doorsteps. The software is now the easier half.

**Do**

- [ ] Onboard **50 captains** within 25 km — every combine, every laser leveller
- [ ] Recruit CHC operators: pre-verified, underutilised supply
- [ ] Invite **150 farmers**, walking the first field with each one personally
- [ ] Shadow every single job. Every failure is a design input.
- [ ] Be reachable by phone at 6 am

**Test — in production, on real people**

- [ ] 40 jobs completed end to end
- [ ] Zero area disputes
- [ ] Track: how many requests reach ≥3 captains; acceptance rate; time to accept; cancel-after-accept

**Gate**

| Metric | Target |
|---|---|
| Captains | 50 |
| Farmers | 150 |
| Fields mapped | 200 |
| Jobs completed | 40 |
| Area disputes | 0 |

**Kill criterion:** if fewer than 30 captains will register when you ask face to face, the supply assumption is wrong. Stop and re-examine before writing more code.

---

## Phase 7 — Admin, ratings, hardening

*December 2026*

**Build**

- [ ] Next.js admin console on Vercel: verify captains, view live jobs, intervene, basic metrics
- [ ] Two-way ratings
- [ ] Dispute flow (you mediate manually this season)
- [ ] Fix everything November exposed — this is most of the phase

**Test**

- [ ] Ratings write once per job per rater
- [ ] Admin can reassign or cancel a stuck job
- [ ] Regression pass over the whole flow

**Do**

- [ ] Write down every complaint from November and sort by frequency. Fix in that order, not in the order that's interesting.

---

## Phase 8 — Migrant combine mode ⭐

*January – February 2027*

The differentiator, and the reason Fazilka is the right beachhead. Built now so it is stable *before* the fleet starts moving in March.

**Build**

- [ ] Travelling toggle: current location, days staying, forward route
- [ ] "Combine available now" banner for farmers in radius
- [ ] Pre-booking on a declared forward route
- [ ] Portable ratings — reputation earned in Ganganagar must travel into Fazilka
- [ ] Field access notes surfaced to the operator (can a truck reach it?)
- [ ] Geographic clustering of a migrant's queue

**Test**

- [ ] Operator goes live → nearby farmers see him within a minute
- [ ] Pre-booking in a district he has not yet entered
- [ ] Ratings visible across district boundaries

**Do**

- [ ] **Go to Sri Ganganagar and register 15 combine operators before the season starts.** This is the single highest-leverage acquisition activity of the whole plan.
- [ ] Keep the kinnow-season services running so Fazilka captains stay active through winter

---

## Phase 9 — Harvest readiness

*March 2027*

**Build**

- [ ] Whatever the last three months proved necessary. Nothing new and ambitious.

**Test**

- [ ] **Load test the dispatch function** — peak week is 20× a normal day
- [ ] Notification reliability under concurrency
- [ ] Database query plans under realistic row counts
- [ ] Full regression on a low-end device
- [ ] Restore-from-backup rehearsal. Actually do it.

**Do**

- [ ] Confirm every pre-registered migrant operator is still coming
- [ ] Clear your March and April calendar

**Gate:** the system survives a simulated peak day without dropping a job.

---

## Phase 10 — 🔴 The season

*April 2027*

No building. You are on call.

| Metric | Target |
|---|---|
| Jobs completed in April | 250+ |
| Migrant captains active | 25 |
| Fill rate | > 80% |
| Cancel after accept | < 10% |
| **Repeat booking rate** | **> 40%** |

**This is the go/no-go for the whole company.** If April works in Fazilka, the model is proven and the rest is expansion. If it doesn't, the reason will be specific and visible.

---

## Standing rules

Things that apply in every phase, and are easiest to lose when a deadline is close.

1. **Money and area code gets tested before it gets a UI.** No exceptions.
2. **Ship nothing that hasn't run on a real low-end Android phone.** Emulators lie about GPS, push and battery.
3. **Gurmukhi is not a translation pass at the end.** A screen isn't done until it's complete in Punjabi.
4. **Every negative result gets written down.** Karam snapping is a passing test asserting it doesn't help — so nobody quietly re-enables it in month six.
5. **When a measurement contradicts a plan, the measurement wins.**
6. **Cut features, never cut the season.** April does not move.

## What is deliberately not in this plan

Deferred with reasons in [MVP_SCOPE.md](MVP_SCOPE.md): in-app payments, bare equipment rental, iOS, chat, commission, Aadhaar verification, route optimisation. Each is a real piece of work. None of them is why a farmer opens the app in April.
