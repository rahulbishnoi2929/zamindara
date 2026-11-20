# Current state

**The single source for what exists today.** Folder names, packages, counts and what is actually built live here, and only here. Other documents describe plans and reasons. Where one of them disagrees with this page, this page wins, and the other is marked *Superseded*.

**As of 20 Nov 2026: the 16 Nov brief done, plus Batches A, B and C of the open BUILD_PLAN items, and a security pass over every endpoint ([SECURITY.md](SECURITY.md)).** Update this page in the same commit as any change to a count or a folder.

---

## Folders

```
C:\Zamidara\
├── frontend\              the Android app (Expo SDK 57, React Native 0.86)
│   ├── App.tsx            the one screen switch: no navigation library
│   ├── src\               screens, sync, notifications, i18n
│   │   ├── fieldTest\     the accuracy-test recorder and its CSV export
│   │   ├── onboarding\    sign-up flow and the machine registry
│   │   └── sync\          the server calls (sync.ts) and wire mapping
│   ├── e2e\               the end-to-end test, run against CI's database
│   ├── plugins\           Expo config plugins: signing, CPU split, minification
│   └── android\           generated native project; never edited by hand
├── packages\              shared TypeScript logic, no React Native, all tested
├── backend\
│   ├── supabase\
│   │   ├── migrations\    numbered SQL; never edited once merged, only added to
│   │   ├── tests\         pgTAP database tests
│   │   ├── functions\     edge functions: notify-dispatch
│   │   ├── seed.sql       generated from packages/catalog
│   │   └── config.toml    local and CI config (never `supabase config push`)
│   ├── scripts\           backup and restore
│   └── check-plans.sh     CI: each test file's plan(n) matches its assertions
├── docs\                  the document set (this page included)
├── .github\workflows\     ci.yml (every push), backup.yml (nightly)
├── assets\                the logo
├── SETUP.md               the work waiting on the founder
└── BUILDLOG.md            what was built and why, newest first
```

There is **no `apps/` folder**, no admin web console, and no `packages/types`.

## Packages

npm workspaces; the app imports each by name, nothing is published.

| Package | What | Unit tests |
|---|---|---|
| `@zamindara/units` | killa / kanal / bigha / marla conversion, compound display, Gurmukhi and Devanagari parsing | 41 |
| `@zamindara/geo` | walk pipeline (filter → smooth → simplify → rectangle fit); `squareUp` for the draw screen | 27 |
| `@zamindara/catalog` | 21 machine types, 14 services; generates `seed.sql` | 18 |
| `@zamindara/pricing` | farmer-facing price math, kept equal to the SQL `quote_job` | 20 |
| `@zamindara/scheduling` | the captain's queue and ETAs | 19 |

## Counts

| | Count | How to check |
|---|---|---|
| Database migrations | **40** (`…0001_extensions` to `…0040_lock_down`) | `ls backend/supabase/migrations` |
| Database test files | **26** | `ls backend/supabase/tests` |
| Database assertions | **334**, run twice in CI: before and after a backup, wipe and restore | CI log, "Files=26, Tests=334" |
| Unit tests | **292**: 125 packages + 167 app | `npm test` at the root |
| End-to-end steps | **20**, the app's own sync code against a real database | CI, "Core loop, end to end" |
| Edge functions | **1** (`notify-dispatch`) | `ls backend/supabase/functions` |

## What is built

**Machine pictures** are DUMMY placeholders in `frontend/assets/machines/`; replace each with a real photo of the same name.

**Measuring a field**
- Walk the boundary with GPS, or draw on satellite imagery. Drawing uses a fixed crosshair, a zoom limit and a rectangle snap (Stage 6).
- The server measures the area from the boundary; the phone's number is never trusted.
- A farmer can dispute an area and record the area on his land papers (4.4).
- The field-test recorder captures tape, jamabandi and each measurement, and exports a CSV.

**Sign-in and accounts**
- Phone number and code. A fixed founder code works with no SMS provider (1.2).
- Farmer and captain roles live in one app.
- Captain onboarding covers machines, rates, a smallest job size (4.5), and a phone-setup screen at the end (5).
- The founder verifies captains from inside the app.

**Jobs and dispatch**
- A farmer books work.
  - A "now" job is offered in rounds of five for 90 seconds each. An unanswered ping rings again at 30 s. After three rounds the farmer is told and can widen the search (Batch B).
  - A job for a later day is an open offer, listed quietly to every eligible captain (4.8).
  - The first to accept wins. A retried accept is safe.
- Who counts as eligible:
  - near enough, verified and offering the service;
  - free on the right machine type, with a queue per machine (4.6);
  - at a route stop that covers the job's day (4.7);
  - the job is at least his smallest size.
- A farmer sees which in-season machines are free near his field now (counts only), and, while his captain is on the way or working, how far away he is (Batch C).
- Both sides can call each other while a job is live. A farmer's note on how to reach a field shows on the captain's card.
- A captain can accept, travel, work, complete, hand a job back, or log a phone booking and measure the field on arrival (4.3).
- A request lapses at the end of its day.
- The founder can create farmers and jobs for people who only phoned, and assign them (4.1, 4.2).

**Switches, all in one `app_config` row**
- Automatic dispatch: **off**. The founder matches by hand.
- Loud ping: **off**.
- Founder sign-in code.
- Minimum supported app version.

**Running it**
- Incremental sync.
- Nightly encrypted backup. It needs two GitHub secrets that aren't set yet.
- A metrics view.
- A signed release APK of 35 MB.
- Over-the-air updates.

## What is not built, on purpose

Per the brief's do-not-build list and MVP_SCOPE:
- voice or SMS providers;
- payments;
- a separate admin web console (the founder's tools are screens inside the app);
- error-tracking or analytics services;
- paid routing or map APIs;
- Play Store release.

Also not built yet:
- a full-screen "incoming call" ping (STAGE_5_DESIGN: native code, 2–3 days, only if the first phone test shows heads-up pings being missed);
- a server timer for dispatch rounds. Rounds move on while the farmer's app is open (Batch B).

## Not yet live

Nothing runs on a hosted server yet. The hosted Supabase project, Firebase push, the Google Maps key, the APK host and the first phone test are all waiting on the founder: see [SETUP.md](../SETUP.md).
