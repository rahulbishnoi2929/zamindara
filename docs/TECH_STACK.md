# Tech Stack

Every technology in Zamindara: **what it is, where it's used, why it was chosen, and what it was chosen over.**

[TECH_ARCHITECTURE.md](TECH_ARCHITECTURE.md) explains how the pieces fit together. This document is the decision register — the reasoning behind each pick, so a choice can be revisited later without re-deriving the argument from scratch.

---

## The five constraints that decided everything

Almost every choice below falls out of these. Where a decision looks odd, it is usually one of these five overriding a more conventional answer.

| # | Constraint | Consequence |
|---|---|---|
| 1 | **One person builds and maintains all of it** | Fewest moving parts wins. Managed services beat self-hosted. One language everywhere. |
| 2 | **This is a geospatial app with a marketplace on top** | The database must understand polygons natively. This single fact eliminated Firebase. |
| 3 | **Android only, on cheap phones** | No iOS. Small bundle. Nothing heavy. |
| 4 | **Bad or absent network in fields** | Offline-first for anything a farmer does standing in a field. |
| 5 | **Near-zero budget until revenue** | Free tiers must carry season one. No paid API on the critical path. |

---

## At a glance

| Layer | Choice | Version |
|---|---|---|
| Language | **TypeScript** | 5.6 / 6.0 |
| Runtime | **Node** | 22.16 |
| Mobile | **Expo + React Native** | SDK 57.0.13 / RN 0.86.2 |
| UI | React | 19.2.3 |
| Maps | **Google Maps** via `react-native-maps` | 1.27.2 |
| GPS | `expo-location` | 57.0.10 |
| Local storage | AsyncStorage | 2.2.0 |
| Database | **Supabase — Postgres + PostGIS** | PG 15 / PostGIS 3 |
| Auth | Supabase Auth, phone OTP | — |
| SMS | MSG91 | — |
| Realtime | Supabase Realtime | — |
| Server logic | Supabase Edge Functions (Deno) | — |
| Push | Expo Notifications → FCM | — |
| Admin | **Next.js on Vercel** | — |
| Testing | **Vitest** | 2.1.9 |
| Monorepo | npm workspaces | npm 10.9 |
| Geometry | **Our own** — `packages/geo` | — |

---

## Language and tooling

### TypeScript, everywhere

**Where:** mobile app, admin console, edge functions, shared packages, database types.

**Why:** the single highest-leverage decision for a solo founder. Mobile, backend, admin and database types are all the same language — no context switching, ever.

The specific payoff is Supabase's generated types: rename a database column and the mobile app **fails to compile**. That is a class of bug that would otherwise reach a farmer in a field during harvest week.

Strict mode is on, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. On code that computes prices, the compiler earning its keep is worth the friction.

**Chosen over:** Flutter + Python + React. A better *team* stack and a much worse *solo* one — three languages, three toolchains, three sets of idioms, one person.

### npm workspaces

**Where:** repo root.

**Why:** built into npm, zero configuration, no extra tool to learn. `packages/units` is consumed by both the app and (later) the admin console without publishing anything.

**Chosen over:** pnpm, Turborepo, Nx. All better at scale. At three packages they are configuration overhead with no return.

### Vitest

**Where:** `packages/units`, `packages/geo`.

**Why:** fast, TypeScript-native, no Babel configuration. The `packages/geo` accuracy suite runs hundreds of simulated field walks in under a second, which means it can run on every save rather than being something you remember to do.

**Chosen over:** Jest — slower, and needs configuration to handle ESM TypeScript that Vitest simply doesn't.

---

## Mobile

### Expo + React Native

**Where:** `apps/mobile`. Android only.

**Why:**
- Managed builds — no Android Studio, no Gradle debugging
- **OTA updates**: push a fix mid-harvest without a Play Store review. In April that could matter enormously.
- Batteries included: location, notifications, storage, keep-awake, all first-party and version-matched
- React knowledge carries straight into the Next.js admin console

**Chosen over:**

| Alternative | Why not |
|---|---|
| Native Kotlin | Best GPS and battery control, but slowest to build and no code shared with the admin console |
| Flutter | Genuinely good, arguably better on low-end Android. But Dart shares nothing with the backend or admin — see the language argument. |
| Bare React Native | Same result, plus native build maintenance as a permanent tax |

**The real cost:** Expo Go can't render Google Maps on Android, so a development build is required (`npx expo run:android`). Since drawing on the map is the primary capture method, that is a hard requirement, not an inconvenience.

### Google Maps via `react-native-maps`

**Where:** the draw screen and the walk confirmation screen.

**Why:** **imagery quality over rural Punjab.** This is not a small preference — the whole product now rests on a farmer recognising his own field from above, picking out his bunds and his watercourse. Google's imagery in this belt is the best available, and second best is not good enough for the job it has to do.

**Chosen over:** Mapbox / MapLibre — cheaper, more flexible styling, and genuinely attractive. But satellite imagery in rural Fazilka is thinner. If Maps costs ever become a problem, this is the first thing to revisit.

**Cost:** free monthly credit covers season one comfortably. Map loads are low — a farmer maps each field once, forever.

**Requires:** a Google Maps Android API key in `app.json`. Without it the map is blank.

### `expo-location`

**Where:** the boundary walk; centring the draw screen on the farmer.

**Why:** first-party, version-matched to the SDK, and handles the Android foreground-service permission dance that gets tedious quickly.

Configured to `BestForNavigation` at 1 Hz during a walk. Note the raw stream is **not** trusted — everything goes through `packages/geo` filtering first. See [Units & Measurement](UNITS_AND_MEASUREMENT.md).

### AsyncStorage

**Where:** the in-progress walk, saved fields, language preference.

**Why:** simplest thing that survives an app kill. A walk is checkpointed on **every GPS point**, because losing twenty minutes of walking would only ever happen to the farmer least able to tolerate it.

**Chosen over:** `expo-sqlite` — the right answer once there are jobs, queues and a sync outbox, and a premature one for a handful of polygons.

**Migration path:** `expo-sqlite` at Phase 5, or **PowerSync** if offline sync outgrows a hand-rolled outbox. PowerSync integrates with Supabase directly and handles the hard parts properly. Not a Phase 1 problem.

---

## Backend

### Supabase — Postgres + PostGIS ⭐

**Where:** everything server-side.

**Why — and this is the load-bearing decision in the whole stack.**

Zamindara is a geospatial app. Every core question is a geometry question, and PostGIS answers each in one line:

| Question | PostGIS |
|---|---|
| How big is this field? | `ST_Area(boundary)` |
| Which captains are in range? | `ST_DWithin(...)` |
| How far, for the travel charge? | `ST_Distance(...)` |
| Is this polygon valid? | `ST_IsValid(...)` |

Critically, `ST_Area` runs **server-side in a trigger**, so a client cannot submit its own acreage. Area sets the price; it is computed by the database or it is not trusted.

Everything else Supabase provides is a thing a solo founder would otherwise have to build and operate alone: auth, realtime, file storage, row-level security, backups, connection pooling.

**Chosen over:**

| Alternative | Why not |
|---|---|
| **Firebase / Firestore** | Cannot store a polygon at all. Field boundaries become coordinate arrays and all the geometry gets reimplemented client-side, where the farmer could tamper with his own acreage. Disqualifying. |
| **MongoDB + Express** | *Correction to an earlier claim in this project: Mongo handles this far better than Firestore.* GeoJSON polygons, `2dsphere` indexes, `$near` and `$geoWithin` all work. It lacks `ST_Area`, so area would be computed in Node with turf.js — still server-side, still safe. The real argument against it is operational: auth, realtime, storage, backups and hosting all become yours to build and run, solo, before April. |
| **Raw Postgres on a VPS** | Same database, none of the managed layer. Strictly more work. |

**Cost:** free tier through season one, then $25/month Pro.

### Supabase Auth — phone OTP

**Where:** the only login path.

**Why:** farmers have no email address. **The phone number is the identity.** No passwords — nothing to forget, nothing to reset, nothing to steal.

**Requires MSG91** (or Twilio) for SMS delivery. MSG91 is cheaper in India and DLT-compliant.

> ⚠️ **DLT registration with TRAI takes weeks and blocks OTP entirely.** It is flagged as a start-immediately item in [Phase 2](BUILD_PLAN.md#phase-2--backend-foundation). This is the most likely schedule surprise in the whole plan.

### Supabase Edge Functions (Deno)

**Where:** dispatch, pricing, notification fan-out.

**Why:** the dispatch engine has to run server-side — a client cannot be trusted to decide which captains get pinged. Deno runs TypeScript directly, so the same language and the same shared packages apply.

**Chosen over:** Postgres functions in PL/pgSQL (harder to test, no shared code) and a separate Node service (another thing to deploy and monitor).

### Supabase Realtime

**Where:** job status, live captain position during a job.

**Why:** it is Postgres logical replication over websockets — no separate message broker, no extra service. Subscribe to a row; get changes.

---

## Notifications

### Expo Notifications → FCM

**Where:** the captain's job ping.

**Why:** **this is the most important notification in the product.** It must behave like an incoming call, not a WhatsApp message — a dedicated max-importance Android channel, a custom loud sound, a full-screen intent that wakes the device, and accept/decline directly from the lock screen.

Expo wraps FCM and handles token registration and channel setup.

**The real risk isn't the library.** It is Android battery optimisation and Doze mode killing the ping on cheap phones — which varies by manufacturer and is genuinely hostile on some Chinese OEM skins. This is explicitly a **device-test item** in [Phase 5](BUILD_PLAN.md#phase-5--notifications-queue-lifecycle). Emulators will not reveal it.

---

## Admin

### Next.js on Vercel

**Where:** the founder's ops console — verifying captains, watching live jobs, resolving disputes.

**Why:** React again, TypeScript again, and the same Supabase client. Free tier. Deploys on push.

**Chosen over:** Retool — faster to build, but a monthly bill and another vendor. Supabase Studio alone covers Phase 2; a real console is Phase 7.

---

## Our own code

### `packages/units` — land measurement

Killa, kanal, bigha, marla. Conversion, compound display, Gurmukhi and Devanagari parsing. **41 tests.**

**Why not a library:** none exists for Punjab revenue units, and the rules are specific — square metres stored always, never a decimal shown, and *bigha means four different sizes in four states*. This is exactly the code that must be ours and must be tested.

### `packages/geo` — the measurement pipeline

Filter → smooth → simplify → rectangle fit. **24 tests**, including an accuracy suite that simulates hundreds of walks over fields of known size.

**Why not turf.js:** turf gives `area`, `simplify` and `booleanPointInPolygon` and would have covered maybe 40% of this. The parts that matter — noise-aware GPS filtering, median edge fitting, the canal-grid experiment — do not exist in any library because they are specific to this problem. Pulling in turf for the remainder would add bundle weight to a low-end Android app for functions that are a few dozen lines each.

The deciding factor: **this code sets prices.** It needed to be understood line by line and tested against known ground truth, not trusted from a dependency.

That investment already paid for itself three times — the speed filter destroying 150 of 196 fixes, the bounding rectangle inflating area by 22%, and grid snapping making accuracy *worse*. None of those would have surfaced behind a library API.

### i18n — hand-rolled

**Where:** `apps/mobile/src/i18n.ts`. Punjabi (Gurmukhi), Hindi (Devanagari), English.

**Why:** three languages and one flow do not need a library, and every kilobyte counts on a cheap phone.

**Migration path:** `i18next` once there are more than a few dozen strings, or when pluralisation rules start to bite.

---

## Deliberately not used

| Not using | Why |
|---|---|
| **iOS** | Farmers and captains here are on Android. Saves ~40% of build effort. |
| **Redux / Zustand** | One linear flow. `useState` is sufficient and will stay so for a while. |
| **A navigation library** | Three screens, one direction. A hand-rolled screen union keeps the APK small. |
| **A UI component library** | Requirements are unusual — sunlight contrast, 56 px touch targets, Gurmukhi-first. Generic libraries fight all three. |
| **Razorpay / payments** | v1 is free, so there is no commission to collect. Needs an entity and KYC. Deferred to v2. |
| **Docker / Kubernetes** | Nothing is self-hosted. There is nothing to containerise. |
| **GraphQL** | Supabase's REST and RPC cover it. Another layer for one client. |
| **Sentry, analytics** | Worth adding at Phase 6 when there are real users. Noise before that. |

---

## What season one costs

| Service | Launch | ~1,000 users |
|---|---|---|
| Supabase | Free | $25/mo |
| Vercel | Free | Free |
| Expo | Free | Free |
| Google Maps | Free credit | $0–20/mo |
| SMS OTP | ~₹0.15 each | ~₹1,500/mo |
| Play Store | $25 once | — |

**Roughly ₹0–3,000/month through season one.** Two choices keep it there: doing all geometry locally rather than calling a geoprocessing API, and approximating road distance as straight-line × 1.3 instead of paying for a routing API.

---

## Lock-in, and how to get out

Worth knowing before you are dependent, not after.

| Component | Lock-in | Exit |
|---|---|---|
| **Supabase** | 🟢 Low | It is plain Postgres. `pg_dump` and move to any Postgres host. Auth and realtime would need replacing; the data is never trapped. |
| **Expo** | 🟡 Medium | It is React Native underneath. `expo prebuild` produces a standard native project. Losing OTA updates is the real cost. |
| **Google Maps** | 🟢 Low | `react-native-maps` supports other providers. Swappable in a day — you would be trading imagery quality, not rewriting. |
| **FCM** | 🟢 Low | The Android standard. Everyone uses it. |
| **Vercel** | 🟢 Low | Next.js runs anywhere. |

**Nothing here is a one-way door.** For a solo founder before a hard seasonal deadline, that mattered as much as any feature comparison.

---

## Still open

1. **Offline map tiles.** Drawing needs a connection; walking does not. Pre-cache tiles around the village, or fall back to walking? [Phase 1](BUILD_PLAN.md#phase-1--prove-the-measurement-) measures how often signal is actually missing before this gets solved.
2. **SMS provider.** MSG91 versus Twilio — decide alongside DLT registration.
3. **Offline sync at scale.** Hand-rolled outbox versus PowerSync. Revisit at Phase 5.
4. **Error tracking.** Sentry from Phase 6, probably.
5. **CI.** GitHub Actions running `npm test` on push. Cheap; not yet set up.
