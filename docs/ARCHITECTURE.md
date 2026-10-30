# Architecture — the map of the code

Where every part of Zamindara lives, and why it lives there. Read top to bottom
once and the repository should stop being mysterious: **this file is the folder
by folder tour**, [TECH_ARCHITECTURE.md](TECH_ARCHITECTURE.md) is how the pieces
talk at runtime, [TECH_STACK.md](TECH_STACK.md) is why each technology was picked.

---

## The three lands

Everything in this repository is one of three things:

| Land | Folder | What it is | Runs where |
|---|---|---|---|
| **Frontend** | `frontend/` | The Android app. Every screen the farmer and the captain touch. | On the phone |
| **Shared logic** | `packages/` | Pure TypeScript: units, geometry, pricing, queueing, the catalogue. No screens, no React Native. | On the phone **and** in CI |
| **Backend** | `supabase/` | The Postgres + PostGIS database: tables, security rules, business functions. | On the server |

**The fact that surprises people: today, the backend is a database, not a server
we wrote.** There is no `server/` folder with API code. The business rules — who
gets offered a job, what a job costs, who wins when two captains tap accept in
the same second — live in SQL functions inside Postgres, and the phone talks to
them through Supabase's auto-generated API. A dispatch *edge function* (small
server-side TypeScript) joins later, in `supabase/functions/`, which already
exists empty and waiting.

```
   frontend  (frontend)
   ┌─────────────────────────────┐
   │  screens · GPS · storage    │
   │  notifications · sign-in    │
   └──────┬──────────────┬───────┘
          │ imports      │ HTTPS (Supabase API)
          ▼              ▼
   packages/*        supabase/  (backend)
   ┌────────────┐    ┌────────────────────────┐
   │ units      │    │ Postgres + PostGIS     │
   │ geo        │    │ tables · RLS policies  │
   │ pricing    │    │ accept_job · quote_job │
   │ scheduling │    │ eligible_captains      │
   │ catalog    │    │ (seed generated from   │
   └────────────┘    │  packages/catalog)     │
   compiled into     └────────────────────────┘
   the app
```

The left arrow is **compile time** — the packages are bundled into the app, so
they work with zero signal. The right arrow is **runtime** — it carries
sign-in and, since Phase 2.5, the data: profiles, fields and jobs sync
between the phone and Postgres, offline-first (write locally, upload when
there is signal, server wins on conflict). The models were mirror-images of
the tables from the start, so sync is a change of storage, not a change of
model.

---

## The root

```
C:\Zamidara\
├── apps\               frontend — currently one app: mobile
├── packages\           shared logic — five packages, all tested
├── supabase\           backend — migrations, seed, database tests, config
├── docs\               the document set (11 files, indexed in README)
├── .github\workflows\  CI — tests, bundle check, and the whole database, per push
├── assets\             the logo
└── temp\               scratch space, gitignored
```

`apps/` and `packages/` are npm workspaces: `npm test` at the root runs every
package's suite, and the app imports a package by name (`@zamindara/units`)
without anything being published. The admin console (Phase 7) will arrive as
`apps/admin` — same arrangement.

---

## The frontend — `frontend/`

One binary, two roles. A farmer and a captain open the same app; a captain's
home screen opens to his availability toggle and machines, a farmer's to his
fields. There is deliberately **no navigation library** — `App.tsx` holds a
"screen union" (a list of which screen is showing and why), which keeps the APK
small and the flow linear, the way the flows in [USER_FLOWS.md](USER_FLOWS.md)
are drawn.

### `src/` file by file

| File | Does |
|---|---|
| `App.tsx` | Entry. Owns the screen union and the app-level state (profile, fields, jobs). |
| **Screens** | |
| `HomeScreen.tsx` | Role-aware home: fields and booking for a farmer, availability and job feed for a captain. |
| `SignInScreen.tsx` | Phone number + one code. Skippable — measuring works with no account. |
| `onboarding/OnboardingFlow.tsx` | Language → role → name and village. |
| `onboarding/MachineRegistry.tsx` | The glyph grid of 21 machine types; owned or arrangeable, lead time, rates derived from machines. |
| `ChooseMethodScreen.tsx` | Draw on satellite (default) or walk the boundary. |
| `DrawScreen.tsx` | Tap-the-corners on satellite imagery, centred on his GPS position. |
| `WalkScreen.tsx` | The boundary walk. Refuses to start on red GPS; vibrates on loop closure. |
| `ConfirmScreen.tsx` | Satellite check with draggable corners — required after a walk, not after a draw. |
| `JobPostFlow.tsx` | Field → work → when → review. Seasonally reordered service grid. |
| `JobList.tsx` | The captain's queue, in working order. |
| `CompleteJobSheet.tsx` | Amount and payment mode at completion, prefilled from his own rate. |
| **Device and data** | |
| `useBoundaryWalk.ts` | The GPS subscription and walk state machine; crash recovery. |
| `location.ts` | One-shot GPS fix (going online, anchoring a captain). Best effort, never throws. |
| `storage.ts` | Fields and the in-progress walk, in AsyncStorage. Checkpointed on **every** GPS point. |
| `profile.ts` | Who the user is, what machinery he has, where he stands. Mirrors `public.profiles` + `public.captains` + `public.captain_machines`. |
| `jobs.ts` | Jobs, local. Mirrors `public.jobs`; `acceptJob` mirrors `public.accept_job` including the status guard. |
| `sync/mapping.ts` | The wire format: corners ↔ GeoJSON, epoch ms ↔ ISO, enums, uuid minting. **Pure** — no Supabase, no React Native — and tested, because every line here touches area or money. |
| `sync/sync.ts` | The sync pass: profile, then fields, then jobs — push then pull, server wins on conflict, a status never moves backwards. Calls `dispatch_job` and `accept_job` in the database. |
| `auth.ts` | Sign-in outcomes (typed, never throws) — `requestCode` / `verifyCode` / `signOut`. |
| `supabase.ts` | The Supabase client. Sessions in AsyncStorage; token refresh driven by app state, not a timer. |
| `notifications.ts` | The job ping: max-importance channel, working-hours gate, lock-screen accept. |
| `mapsKey.ts`, `MapKeyWarning.tsx` | Detect the placeholder Google Maps key and explain the fix on screen. |
| **Look and language** | |
| `theme.ts` | Sunlight contrast, 56 px minimum touch targets. |
| `components.tsx` | Shared buttons, cards, rows. |
| `i18n.ts` | Every string in Punjabi (Gurmukhi), Hindi (Devanagari) and English. |
| **The founder's tool** | |
| `fieldTest/` | The Phase 1 recorder: tape reference per plot, automatic capture of accuracy and method, the pass/fail gate card, CSV export. Uses the same capture screens the app ships. Comes out once Phase 1 clears. |

Two rules the app enforces on itself:

- **No geometry lives here.** Every decision about filtering, smoothing, area
  and rectangle fitting comes from `@zamindara/geo`. The app owns the device —
  permissions, the location stream, persistence, screens.
- **Everything works with no backend configured.** `supabase.ts` gates every
  call on `isBackendConfigured()`; a missing backend is a degraded mode to
  report, never a crash. Dispatch is currently simulated on-device, which is
  enough to demo the whole loop to a captain in his yard.

`android/` (when it exists) is **generated** by `expo prebuild` and gitignored —
never edit it by hand. See [frontend/README.md](../frontend/README.md)
for building the APK.

---

## The shared logic — `packages/`

Five packages. None of them imports React Native, which is the point: they run
inside the phone app, inside CI on every push, and — later — inside the admin
console and edge functions, unchanged.

| Package | Tests | Does | The rule it carries |
|---|---|---|---|
| `@zamindara/units` | 41 | Killa / kanal / bigha / marla: conversion, compound display, Gurmukhi and Devanagari parsing. | **The most safety-critical code in the repo** — a bug here overbills a farmer. Whole-number marla arithmetic; never show a decimal. |
| `@zamindara/geo` | 24 | The boundary-walk pipeline: filter → smooth → simplify → rectangle fit, plus a walk simulator. | Every design choice is backed by a simulated measurement, not an opinion. Three reversals came out of this suite. |
| `@zamindara/catalog` | 18 | The 21 machine types and 14 services, named in three languages. | **One source of truth.** `backend/supabase/seed.sql` is *generated* from it (`npm run gen:seed --workspace @zamindara/catalog`), so the database and the app cannot disagree about what a Happy Seeder is. |
| `@zamindara/pricing` | 20 | The price math the farmer sees before he commits. | Duplicated from the SQL function `quote_job` **on purpose** — the database prices authoritatively, and the tests assert both halves round identically so the docs, SQL and TypeScript can never drift apart. |
| `@zamindara/scheduling` | 19 | The captain's queue: order, ETA, knocking-off time. | Never promise tonight what rolls to tomorrow morning. Time-priced work books a half day. |

House rule these enforce: **money and area code gets tested before it gets a
UI** ([BUILD_PLAN](BUILD_PLAN.md#standing-rules), rule 1). That is why every
package has a suite and the screens don't.

---

## The backend — `supabase/`

```
supabase\
├── migrations\   12 SQL files, run in order — the entire schema
├── seed.sql      GENERATED from packages/catalog — never hand-edit
├── tests\        pgTAP — the guarantee suite, run by CI
├── config.toml   local Supabase config, incl. the fixed OTP codes for dev/CI
└── functions\    empty — where the push-broadcast edge function lands
```

### The migrations, in order

Order matters; each builds on the ones before it.

| # | File (suffix) | Creates |
|---|---|---|
| 1 | `extensions` | PostGIS and pgcrypto. PostGIS is not optional — every core question is a geometry question. |
| 2 | `regions` | `regions` — a region owns its unit vocabulary, so a new district is a row insert, not a migration. |
| 3 | `shared` | Trigger helpers every table below uses (`touch_updated_at`). |
| 4 | `profiles` | `profiles` + `captains`. Phone is the identity — no email, no password anywhere. |
| 5 | `catalog` | `machine_types`, `services`. The Fazilka catalogue the seed fills in. |
| 6 | `machinery` | `captain_machines`, `captain_services` — the owned / arrangeable split and rates. |
| 7 | `fields` | `fields`, with `area_sqm` computed **server-side** by trigger. A client cannot submit its own acreage. |
| 8 | `jobs` | `jobs`, `job_dispatch`, the append-only audit trail. |
| 9 | `ratings` | Two-way ratings — what makes a migrant captain bookable on day one. |
| 10 | `dispatch` | The functions: `eligible_captains`, `quote_job`, `rate_guidance`, `accept_job`. |
| 11 | `rls` | Row-level security on every table. A farmer's boundary is his land record, not public data. |
| 12 | `dispatch_job` | The offer, callable from the farmer's phone: runs `eligible_captains` and writes the `job_dispatch` rows. RLS deliberately has no client insert on dispatch — who gets offered work is not a phone's decision. |

### The tests — `tests/`

Three pgTAP files, run by CI against a real Postgres started with the Supabase
CLI (the founder's Docker Desktop cannot run it locally — CI is where the
schema is actually *executed*, which in twenty minutes found two fatal bugs
that three sessions of reading the SQL had missed). The three guarantees:

1. A client cannot set its own acreage.
2. Farmer A cannot read farmer B's field boundary.
3. Two captains contesting a job produce exactly one winner.

The third file, `03_dispatch.test.sql`, walks the exact path two phones
take — post, offer, accept — and asserts the eligibility rules themselves:
unverified never offered, arrangeable only when the lead time clears, no
duplicate pings, only the posting farmer can dispatch.

### `config.toml`

Local-development configuration only — it carries `env()` references and
defaults, plus the **fixed test OTP codes** that let the whole login flow run
with no SMS provider (India's DLT registration takes weeks; the paperwork must
not block the app). CI asserts phone auth stays enabled, because it is the only
way in.

---

## How the pieces talk — now vs April

| Conversation | Now (after Phase 2.5) | April |
|---|---|---|
| App → packages | compiled in; works offline | same |
| App → Supabase (auth) | sign-in when a backend is configured | same |
| App → Supabase (data) | profiles, fields and jobs sync, offline-first; two phones see each other | realtime queue and captain position |
| Dispatch | `dispatch_job` offers to the top 5; `accept_job` settles the race for real | edge function broadcasts with push notifications |

The mobile models were built mirror-image to the tables for exactly this
reason: `profile.ts` ↔ `profiles`+`captains`+`captain_machines`, `jobs.ts` ↔
`jobs`, `storage.ts`'s `SavedField` ↔ `fields` (its `synced` flag is already
there, waiting).

---

## Where new code goes

The lookup table for "I'm adding X":

| You're adding | It goes in | And also |
|---|---|---|
| A screen | `frontend/src/` + a case in `App.tsx`'s screen union | strings in `i18n.ts`, **all three languages** |
| A machine type or service | `packages/catalog/src/` | regenerate `backend/supabase/seed.sql` |
| A pricing rule | `packages/pricing/src/` **and** the SQL function in a new migration | tests asserting SQL and TS agree |
| A unit or conversion rule | `packages/units/src/` | tests first — money code |
| A table or column | a new numbered file in `backend/supabase/migrations/` + RLS policy | a guarantee test in `backend/supabase/tests/` |
| The admin console (Phase 7) | `apps/admin/` (new workspace) | — |
| Server-side dispatch | `supabase/functions/` | — |

---

## The commands

```bash
npm install                                   # once, at the root

npm test                                      # every package's suite (139 tests)
npm run typecheck                             # TypeScript across all workspaces

npm run gen:seed --workspace @zamindara/catalog   # after changing the catalogue

cd frontend && npx expo export --platform android   # does it still bundle?
cd frontend && npx expo prebuild --platform android --clean   # regenerate android/
cd frontend/android && ./gradlew assembleRelease    # the installable APK
```

CI (`.github/workflows/ci.yml`) runs the tests, the typecheck, the bundle
export, and the full database with its guarantee tests on every push — a green
checkmark means all four passed, on all of it.

---

## The rules the layout enforces

Read this list before adding a folder or moving a file — the structure is doing
quiet work:

1. **Logic that touches money or area never lives in a screen.** It lives in a
   package with tests, and the screen calls it. No exceptions.
2. **One source of truth per fact.** Machine names: `catalog` (the seed is
   generated). Land constants: `units` (the SQL test asserts equality). Prices:
   the database (the TS tests assert agreement).
3. **The app degrades, never crashes, without a backend.** Everything a farmer
   does standing in a field works offline first and syncs later.
4. **`android/` is generated.** Hand edits die at the next `prebuild`.
5. **Generated files are marked.** `seed.sql` says so at the top; regenerate,
   don't edit.
