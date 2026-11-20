# Build Log

A running record of **what we built and why**, one entry per instruction.

Newest first, so the most recent work is always at the top. Each entry says what was asked, what changed, which decisions were made, how it was verified, and which commit it landed in.

> **Maintained by Claude.** A new entry is appended at the top after every piece of work. If an entry is missing, the work was not finished.

---

## Where things stand

| | |
|---|---|
| **Phase** | Code done through 5. **Phase 1 field test never run — the gate was walked past.** See the revision at the top of BUILD_PLAN. |
| **Brief** | Working through the 16 Nov staged brief. Stage 1 done (awaiting your phone install). **All seven stages of the brief are done.** Current facts: [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md). Waiting on you: Supabase project, Firebase, first-phone test. |
| **Tests** | 279 unit (125 packages + 154 app) + **287 database assertions** (run twice in CI: before and after a backup-and-restore) + **18-step end-to-end test** covering every server call, against a real database, all green in CI |
| **App** | Signed release APK, **35.3 MB** (from 75.8), R8 on, ARM only. Shows `v0.1.0` on home; an `app_config` row tells old phones to update. **Install once:** JS changes reach a phone over the air. |
| **Not yet done** | Never run on a physical device; sync never run against a hosted Supabase project |
| **Blocking next step** | Setup: Maps key, hosted Supabase project, `expo prebuild` + APK, a phone, a 50 m tape |
| **Repo** | [rahulbishnoi2929/zamindara](https://github.com/rahulbishnoi2929/zamindara) — private, CI green |
| **Backend** | ✅ **Schema verified.** 37 migrations apply; all three guarantees hold. |

```
C:\Zamidara\
├── docs\              16 product and engineering documents
├── frontend\          Expo SDK 57 Android app — 154 tests + e2e
├── backend\supabase\  37 migrations, RLS, dispatch functions — 287 assertions
├── packages\          units · geo · catalog · pricing · scheduling — 122 tests
└── assets\            logo
```

---

## Reversals — decisions we changed our minds about

The most useful part of this log. Each of these was believed, written down, then overturned by evidence or by a question worth asking.

| # | We thought | Turned out | Why it changed |
|---|---|---|---|
| 1 | Canal-grid **karam snapping** would collapse the error — "Fazilka's unfair advantage" | It makes accuracy **worse** (53% vs 60% within 2%) | One karam is 2.8% of a 36-karam side. Quantising an estimate already inside 2% rounds it away from truth. Now ships off, kept as a passing test so nobody re-enables it. |
| 2 | **MongoDB can't do the geospatial work** | It can — GeoJSON polygons, `2dsphere`, `$near` all work | Confused it with Firestore, which genuinely cannot store a polygon. The real argument for Supabase is operational, not technical. Recorded honestly in [TECH_STACK](docs/TECH_STACK.md). |
| 3 | The field test grades the app against the **jamabandi** | Ground truth is a **50 m measuring tape** | The record describes the legal parcel, not the cultivated field, and is often decades stale. Prompted by the user asking "why would we need jamabandi". |
| 4 | **Walking** the boundary is the primary capture method | **Drawing on satellite** is, and walking is the fallback | Georeferencing offset shifts a polygon without changing its area — and the farmer can *see* whether a traced field is right. Prompted by the user asking for map drawing. |
| 5 | A minimum **bounding** rectangle would clean up a noisy walk | It inflates area by **+22%** | It must enclose every point, so it latches onto the worst noise excursion on each side. Replaced with median edge fitting: +1.3%. |
| 8 | RLS on every table is simply good security | **It silently broke two triggers** | Enabling RLS without an insert policy made the audit trigger throw on every job status change, and the ratings trigger on every rating. System-written rows need `security definer`, not a user policy — a policy would let users forge history. |
| 7 | The backend SQL was carefully reviewed and probably sound | **Two bugs, both fatal to dispatch** | Reading SQL is not running it. Three sessions of review missed an enum cast that killed every accept, and a guard that told the losing captain he was never asked. CI found both in twenty minutes. |
| 6 | Reject GPS fixes moving faster than walking pace | That rejected **150 of 196 honest fixes** | Two fixes 1 s apart, each ±5 m, can sit 10 m apart while the walker barely moved. Now subtracts the admitted error budget first. |

| 9 | Rate guidance was finished — the function existed and the screen read it | **It learned from its own guesses, and no farmer could ever see it** | `rate_guidance` ordered by `quoted_rate`, the number the platform invented, so a rate talked down from ₹1200 to ₹900 still fed ₹1200 to the next farmer and the guide could only rise. And nothing in the app called it: the screen read the farmer's *own* history, which for a first-time farmer is empty. Now derived from `final_amount`, and actually called. |

| 11 | Lock-screen accept failed because the **session token had expired** (brief item 2.7) | The token refreshes itself; the real bug was **two silent returns** — no profile on a cold start, and a job not yet in local storage | Read the installed auth-js source: `getSession` refreshes an expired token. The tap did nothing for a different reason, which fixing the token would never have touched. |

| 12 | Push was wired (entry 31) and the local ping showed the real presentation | **No Android phone could receive a remote push**, and the local ping was never loud | Expo push reaches Android only through Firebase Cloud Messaging, and no FCM project exists. And `trigger: null` posts to Expo's *default* channel, not the max-importance one the comment promised. Found while building the loud-ping switch and the cost ledger. |
| 13 | Supabase's documented backup and restore is a safe copy | **It came back with two locked functions open to anyone** | pg_dump writes grants relative to plain Postgres, so a new project's automatic grants to `anon` survive and `REVOKE … FROM anon` is never written. Every row count matched; only re-running the security tests on the restored copy caught it. |

| 14 | Sync worked: 200+ unit tests on the mapping, typecheck clean, bundle builds | **No field, no job and no job update had ever travelled between a phone and the server** | Seven separate faults, each invisible to unit tests and each found by the first test that ran the app's real sync against a real database: test numbers without the country code; Auth refusing phone sign-in with no SMS provider enabled; geometry sent as GeoJSON, which a geography column cannot parse; no `owner_id`/`farmer_id` sent, so RLS refused every insert; the upsert checked against a read policy that cannot see a row not yet inserted; the farmer's job query joining through the wrong foreign key (twice); and fields read back as binary the phone cannot decode. |

| 15 | Becoming staff is one SQL row: your ten-digit number in `admins` (SETUP step 5) | **That row could never match**, so no captain could ever be verified, and so none could ever be offered work | `profiles.phone` comes from Auth with the `91`; both docs said to enter ten digits; `is_admin()` compared them exactly. Now compared on the last ten digits, and proven by the end-to-end test signing in as the founder and verifying a captain through the app. |

| 16 | 4.1 needs `profiles.id` decoupled from `auth.users` (the brief's own wording) | **It needs only the opposite: a placeholder re-keyed to the account id on claim** | Decoupling meant a lookup in every RLS policy and function, about 40 rewrites on the security path. Making every key to a profile `ON UPDATE CASCADE` turns a claim into one `UPDATE`, and RLS is untouched. Recorded in [STAGE_4_DESIGN](docs/STAGE_4_DESIGN.md). |

| 10 | The distance surcharge was built — pricing library, schema columns, server function, twenty tests | **It was applied to nothing.** `travel_charge` was 0 on every job ever created | The app priced a job at *posting* time, when there is no captain and so no distance, and nothing ever priced it again. A combine 25 km out earned exactly what one in the next village earned. `accept_job` now prices the job at the one moment all three unknowns — whose rate, how far, which machine — are known. |

**Rule that came out of this:** when a measurement contradicts a plan, the measurement wins. It is written into [BUILD_PLAN](docs/BUILD_PLAN.md#standing-rules).

---

# Entries

## 59 · Stage 7 — one page for what exists today

**Asked:** create `docs/CURRENT_STATE.md` as the single source for folder names, the package list, the migration count, the test count and what is actually built. Mark superseded sections in the other docs instead of deleting them.

**What "working" meant:** anyone opening the repo finds one page that is true today, and every older section that says otherwise points to it rather than misleading them.

**Built:**
- **`docs/CURRENT_STATE.md`.** It covers the real folder tree, the five packages with their test counts, the counts with the command that checks each, what is built (by area), what is deliberately not built, and what is not yet live. Every count on it was read from the repo or CI, not from memory. It is linked first in the README's document table.
- **18 "Superseded" markers** across README, ARCHITECTURE, TECH_ARCHITECTURE, TECH_STACK, BUILD_PLAN, DATA_MODEL, MVP_SCOPE and USER_FLOWS. Nothing was deleted. The main corrections:
  - the old `apps/`, `supabase/` and `apps/admin` folder trees;
  - the Next.js and Vercel admin console (forbidden by the brief; the founder tools are in-app screens);
  - i18next (a plain object is used), Supabase Realtime (sync polls) and MSG91 (no SMS provider yet);
  - the server-side 90-second dispatch rounds, which were never built;
  - `planned_route` (now route stops);
  - "tap the corners" (now the crosshair);
  - old test counts.
- A script checked that no marker sits inside a code block. Markers in tables were moved above the table, so no table is broken.

**Verified by running:** the counts on the page (`ls` of migrations, tests and functions; each package's test run); the fence check. **Not applicable:** no code changed.

---

## 58 · Stage 6 — the draw screen: crosshair, zoom gate, rectangle snap

**Asked:** place corners with a fixed crosshair while the map moves underneath, enforce a minimum zoom, offer a right-angle snap for rectangles, and make the field-test recorder capture which of these were used. The founder OK'd the sketch ("lets move to next stage and build").

**What "working" meant:** a corner lands exactly where he aimed, never under his fingertip; no corner is placed from so far out that one tap spans twenty metres; a canal-colony rectangle can be squared in one tap without changing its area; and the field-test export says which aids each drawn measurement used.

**Built:**
- **Crosshair.** A fixed ✛ sits at the map's centre. He moves the map, then taps **+ Add corner**. Tapping the map no longer places a corner, so panning can't add one by accident. Corners can still be dragged.
- **Zoom gate.** **Add corner** only works when the map shows 400 m across or less. Wider than that, it reads "Zoom in closer". He can still zoom out to find his field.
- **Rectangle snap.** With exactly four corners, **⊾ Make it a rectangle** squares them: right angles, the same area, the same orientation. It reuses the walk pipeline's rectangle fit, now exported as `squareUp` from `@zamindara/geo`. **Undo** gives back his own corners.
- **Recorder.** Each drawn test measurement now stores `snapped`, `cornersAdjusted` (whether he dragged a corner) and `viewWidthM` (the widest view any corner was placed at). The CSV export gains `snapped_to_rectangle` and `draw_view_m` columns.
- **Fixed, found on the way:** the field-test CSV's columns were misaligned.
  - Measurement rows had one value fewer than the header (`reference_source` was never written), so every value from the reference area onward sat under the wrong column: the measured area appeared under "method", and so on.
  - Rows for unmeasured plots overwrote the reference area with the jamabandi value, and put the notes in the wrong column.
  - Both are fixed. Unmeasured rows are now filled by column name, and a test checks that every row lines up with the header. **Any CSV exported before this has shifted columns.** Re-export from the phone; the stored measurements were never wrong, only the export.

**Verified by running:** 279 unit tests (125 packages + 154 app; 6 new: 3 snap, 2 zoom gate, 1 CSV alignment), typecheck clean, bundle exports. **In CI:** 287 database assertions twice, 18 end-to-end steps.

**Not verified (needs a phone):** the crosshair sitting exactly on the map's centre, the zoom gate's feel at 400 m, and the snap on a real field.

---

## 57 · Stage 5 — phone setup, so a work ping is heard

**Asked:** detect whether a full-screen intent is allowed and fall back to a heads-up alert if not; a "phone setup" screen in captain onboarding (full-screen permission, battery optimisation off, autostart on, test ping); no voice or SMS provider.

**Decided first (design note, `docs/STAGE_5_DESIGN.md`, OK'd by the founder):** no full-screen ping for now.
- `expo-notifications` has no full-screen option, and server pushes arrive through Expo's own handler, which can't show one either.
- A real call-style screen needs our own Android code and an APK rebuild per try: 2–3 days, untestable in CI.
- Our ping is already the brief's fallback, a maximum-priority heads-up. The full-screen ping becomes its own item if the first phone test shows heads-up pings being missed.

**What "working" meant:** a captain can see, in one place, every phone setting that decides whether he hears a work ping. He can fix each with one tap and prove it with a test ping. If notifications are off or the work alert is turned down, his home screen says so at the top.

**Built (no new dependency, no native code, no server change):**
- **Phone setup screen** (ਫ਼ੋਨ ਤਿਆਰ ਕਰੋ). It is the last step of a new captain's onboarding, and also a button on his home screen. Each row shows ✓ or ✗ and has a button:
  - **Notifications allowed:** read from Android. The button asks; if Android has stopped asking, it opens the app's notification page.
  - **Work alert at full strength:** read from the work-request channel's importance. The button opens that channel's own settings page.
  - **Battery saver off:** Android won't report it. The button opens the battery list, and he ticks "done".
  - **Autostart on:** there is no standard setting. The button opens the app's info page with a hint, and he ticks "done".
  - **Test ping:** it rings in 10 seconds so he can lock the phone first. It uses the channel real pings use right now (loud or quiet, per the founder's switch). He answers "I heard it" or "I didn't"; if he didn't, he gets a hint to check the rows and the volume.
  - The screen re-reads the settings whenever he comes back from a settings page. His ticks stay on the phone only.
- **Home warning:** "⚠ Work alerts are off — fix" at the top of a captain's home screen when either readable check fails.

**Verified by running:** 273 unit tests (3 new, for the "turned down" rule), typecheck clean, bundle exports. **In CI:** 287 database assertions twice, 18 end-to-end steps.

**Not verified (needs a phone):** that each settings button opens the right page on Xiaomi, Vivo, Oppo and Samsung; the 10-second test ping on a locked phone; the home warning after turning the channel down.

---

## 56 · Stage 4.8 — jobs for a later day are open offers

**Asked:** a job for a later date becomes an open offer: listed quietly to every eligible captain (base location, or a route stop covering the day) for as long as it stands, first to accept wins. The 90-second ping stays for "now" jobs only.

**Built:**
- **Database (migration 0037).**
  - `jobs.dispatch_mode` is 'instant' for a "now" job and 'open' for any other. It is computed from `is_immediate`, never written, so no phone (old or new) can set it wrong.
  - `claim_open_offers()`: a captain's sync pass calls it, and every open job he is eligible for is added to his feed as an ordinary pending offer. Accepting, the first-accept-wins race and the offer list all work exactly as before; nothing new to go wrong there.
  - It sends no push, obeys the automatic-dispatch switch (off: nobody is listed anything), skips unconfirmed fields, never re-lists a job he declined, and lists nothing from a farmer with more than five requests open (a runaway loop).
  - An open offer closes when someone takes it or when its day ends (the existing expiry).
- **Pings.** The server push and the app's own ping ring loud only for a "now" job. A later job is an ordinary notification even with the loud switch on.
- **App.** No new screen: the offer card already shows the job's date.

**Verified by running:** 270 unit tests, typecheck clean, bundle exports. **In CI:** 287 database assertions (9 new), twice; 18 end-to-end steps. The new step: a farmer books for the day after tomorrow and nobody is offered it; the founder turns dispatch on; the captain's next sync lists it and he accepts it.

**Not verified:** the quiet push from the deployed function (notify-dispatch is not deployed yet), and how an open offer looks in a captain's feed on a phone.

---

## 55 · Stage 4.7 — a migrant combine's route, as dated stops

**Asked:** replace `planned_route text[]` with dated route stops, and match migrant combines using the stop that covers the job's day.

**What "working" meant:**
- A captain who says "Sirsa, from the 5th, for a week" is offered work near Sirsa for those days, even while he is still elsewhere or offline today.
- He is **not** offered work back home for those days.
- Jobs for today, and days no stop covers, match exactly as before.

**One change from the design note:** it said a stop is (captain, **region**, dates). Regions have no map shape in the database, so a region can't say whether a field is within a captain's reach. A stop is a named place with a map pin instead, the same kind of point as his base. `planned_route` is untouched: nothing ever wrote or read it, and it stays in case an installed build does.

**Built:**
- **Database (migration 0036).** `captain_route_stops`: place, point, from and to dates (at most 120 days). A trigger refuses two places on one day. The captain can write only his own stops; farmers can't see them, staff can.
- `eligible_captains` is re-declared: for work more than 12 hours out, a stop covering that day (India time) replaces where he is now. It keeps two separate branches, each on its own spatial index, so 0018's fix still holds.
- **App.** A captain's home screen gets a **ਮੇਰਾ ਰੂਟ** (My route) button. The screen lists his stops and adds one with a place name, − / + steppers for the start date and the number of days, and a map pin. There's no calendar library: no new dependency, and big targets. Stops sync with his profile (removed ones first, then upsert). The founder form's map pin is now a shared `PinMap`.

**Verified by running:** 270 unit tests (1 new), typecheck clean, bundle exports. **In CI:** 278 database assertions (10 new), twice; 17 end-to-end steps. The new step has the captain add a Sirsa stop through his profile sync; the server then offers him a Fazilka field today but not next week.

**Not verified on a phone:** the route screen at large font size, and the map pin zoomed out to district level.

---

## 54 · Stage 4.3 — a captain logs his phone bookings, and measures the field on arrival

**Asked:** a captain books a job by phone and logs it himself. On arrival he re-traces the field and the server recomputes the area. The farmer is notified if he has the app.

**What "working" meant:**
- A captain's phone booking lands straight in his own queue, priced at his rate, for a farmer who may have no account. If that farmer installs the app later, the job is already his (4.1).
- A captain can log only work he offers, and only if he is verified.
- His measurement replaces the declared square, never a field the farmer traced himself.

**Built:**
- **Database (migration 0035).** The founder's three steps from 4.2 are moved, word for word apart from the staff check, into internal functions: `farmer_by_phone`, `create_declared_job` and `assign_job`. The founder functions keep their names and grants and now call them, so the founder and the captain share one body instead of two copies.
- `captain_create_job()` checks that the caller is a verified captain who offers that service, and that the number isn't his own.
- `captain_retrace_field()` checks that the caller is the job's captain, the job is in progress, and the field was declared. It replaces the boundary; the server re-measures it, and the job takes the new area and a new quote.
- **App.** The founder's booking form is now shared. A captain gets **"+ ਫ਼ੋਨ ਵਾਲਾ ਕੰਮ ਜੋੜੋ"** on his home screen, showing only his own services. A phone-booked job in his queue gets a **ਖੇਤ ਨਾਪੋ** button. It opens the usual draw-or-walk screens, and the result goes to the server instead of his field list. That also covers jobs the founder booked (4.2).
- **Push.** `notify-dispatch` can now tell the farmer "ਤੁਹਾਡਾ ਕੰਮ ਬੁੱਕ ਹੋ ਗਿਆ", but only when the job's own captain asks. A farmer with no app gets nothing, which is the usual case.

**Known side effect:** a self-logged job is recorded as an accepted offer, as founder assignments already were. So it nudges his accept rate, which is 10% of the match score. That's harmless at this scale; exclude these from the rate if captains start gaming it.

**Verified by running:** 269 unit tests (3 new), typecheck clean, bundle exports. **In CI:** 268 database assertions (13 new), twice; 16 end-to-end steps. The new step has a captain log a three-killa phone booking, find it in his queue as declared, walk one killa, and get it back measured with a lower quote.

**Not verified:** the farmer push (edge function, needs a deploy and two phones); on a phone, the booking form at large font and the measure-the-field flow from a job card.

---

## 53 · Stage 4.6 — a job runs on a specific machine; two combines, two queues

**Asked:** jobs reference a specific machine, so one owner with two combines has two queues.

**What "working" meant:** a captain's second job goes to his idle combine, not behind the first; dispatch counts an idle machine as free capacity; and the machine stays attached to the job across syncs.

**Found on the way:** the app replaced a captain's machines on the server (delete all, insert all) on **every** sync pass, so every machine got a new id each time. Any job pointing at a machine would have been unhooked within minutes. Machines now keep the phone's id and are upserted; only the ones he removed are deleted. Machines saved by older builds get a proper id once.

**Built:**
- **Database (migration 0034).** `jobs.machine_id`. One trigger picks the machine whenever a job gets a captain, whether by accept, by the founder, or by anything added later: his least-busy active machine of the right kind, owned before arranged. A machine that isn't his, or is the wrong kind (a wheat harvest on a tractor), is refused. Jobs already under way were given a machine. `eligible_captains`' queue load is now the load on his least-busy machine for that work, so a second idle combine counts as free.
- **App.** A captain with two of a kind sees "ਕੰਬਾਈਨ 1" or "ਕੰਬਾਈਨ 2" on each job card, and his list is grouped by machine. A farmer's "when does the machine reach me" estimate now queues behind that machine only, not behind the captain's other combine.

**Not built:** a founder screen to move a job to another machine. The server picks it, and the captain can move his own job between his machines. Add it when a real case asks.

**Verified by running:** 266 unit tests (2 new), typecheck clean, bundle exports. **In CI:** 255 database assertions (9 new), twice; 15 end-to-end steps, including a captain adding a second combine, the founder giving him two jobs, one landing on each, and a later profile push leaving both attached.

**Not verified on a phone:** the machine label on the job card at large font size.

---

## 52 · Stage 4.5 — a captain's smallest job, and the farmer told why

**Asked:** captains can set a minimum job size per service; dispatch filters on it, and the farmer sees it.

**What "working" meant:** a field below a captain's minimum is never offered to him; a farmer whose job reached nobody *because of size* is told the smallest size nearby captains take; and a captain with no minimum behaves exactly as before.

**Built:**
- **Database (migration 0033).** `captain_services.min_area_sqm`, with a sanity check. `eligible_captains` is re-declared with one added condition. It can't be wrapped like `accept_job` and `dispatch_job` were, because the filter sits inside the query, so the copy is marked line by line against 0018. `job_size_floor(job)` answers only the farmer who posted the job. It returns a size only when nobody is eligible **and** size is the reason; otherwise null, so a job that reached nobody for another reason is never blamed on size.
- **App.** Each service in the captain's rates step gets a **ਘੱਟੋ-ਘੱਟ ਕਿੱਲੇ** box, in whole killa, sent with the rate. On the farmer's waiting job, in place of "nobody asked yet", it reads **"ਨੇੜਲੇ ਕੈਪਟਨ ਸਿਰਫ਼ 2 ਕਿੱਲਾ ਜਾਂ ਵੱਡੇ ਕੰਮ ਲੈਂਦੇ ਹਨ"**, in local units. Only his own waiting jobs with no offers are asked about, so it costs a handful of calls at most.

**Verified by running:** 264 unit tests (1 new), typecheck clean, bundle exports. **In CI:** 246 database assertions (7 new), twice; 14 end-to-end steps, including a captain setting "2 killa and up" through onboarding's own sync and the farmer's app being told so about a one-killa job, on the next pass.

**Not verified on a phone:** the extra box in the rates step at large font size.

---

## 51 · Stage 4.4 — "the area is wrong", and the area on the papers

**Asked:** a one-tap "area is wrong" on a job, stored and countable, and an optional "area on my papers" on each field.

**What "working" meant:** either party can mark a job once and nobody can undo or forge it; the count shows up in metrics; the papers area is stored and shown but never priced.

**Built:**
- **Database (migration 0032).** `jobs.area_disputed_at` and `area_disputed_by`. A trigger decides both from the server: the first mark gets the server clock and the caller's id, whatever the phone sent, and after that neither can change. A stranger cannot mark someone else's job (the existing party policy). `fields.papers_area_sqm` has a sanity check. `metrics.area_disputes` shows, per region and week, completed jobs, disputes, which side raised them, and how many were on **declared** (phoned-in) fields. That last number says whether 4.2's square-on-a-pin is good enough.
- **Sync.** A dispute tapped with no signal is saved on the phone and sent on the next pass, and only once (the phone remembers the server already has it). The papers area travels with the field.
- **App.** A quiet **"ਰਕਬਾ ਗਲਤ ਹੈ?"** link on both the farmer's and the captain's job card, once a captain is on the job. It asks first, because it can't be undone, and afterwards shows **⚠ ਰਕਬੇ ਤੇ ਇਤਰਾਜ਼ ਦਰਜ ਹੈ**. Each field gets **+ ਕਾਗਜ਼ਾਂ ਵਾਲਾ ਰਕਬਾ** with killa + kanal entry, shown in local units beside the measured area.

**Verified by running:** 263 unit tests (2 new), typecheck clean, bundle exports. **In CI:** 239 database assertions (9 new: stranger refused, server stamps who and when whatever is sent, cannot be cleared or re-attributed, counted by side, papers stored but not priced, nonsense refused), run twice; 13 end-to-end steps, including the farmer disputing through the app's own sync, a second pass not re-sending it, and the papers area reaching the server.

**Not verified on a phone:** the confirmation dialog, and the papers entry fitting at large font size in Gurmukhi.

---

## 50 · Stage 4.1 + 4.2 — you can match real work by hand, from the app

**Asked:** write all Stage 4 design notes and start building. The notes are in [STAGE_4_DESIGN.md](docs/STAGE_4_DESIGN.md), approved in one go.

**What "working" meant:**
- The founder books a job for a farmer who only phoned, assigns a captain, moves it to done and records the money.
- Every one of those powers is refused to non-staff, by the database.
- When that farmer later installs the app, his job and field are already his.

### 4.1 Farmers before sign-up

The design changed from the brief (reversal 16). A **placeholder profile** has a fresh id and no account. When the farmer first signs in, `claim_profile()` matches the phone **Auth verified by OTP**, read on the server and never sent by the phone, and re-keys the placeholder to his account id. Every foreign key to a profile now cascades on update, so his fields and jobs follow in one statement. The app calls it on every sign-in; it does nothing for anyone without a placeholder.

The key from `profiles` to `auth.users` became a trigger with the same effect, because a placeholder has no account.

**Found on the way:** `derive_field_geometry` and `road_km` used PostGIS types with no search path of their own, so they only worked when the caller's happened to include `extensions`. A claim re-keys fields and failed with "type geometry does not exist". Both are pinned now.

### 4.2 Founder dispatch

**Database:** `founder_create_farmer`, `founder_create_job`, `founder_assign`, `founder_advance` and `founder_captains`. Each refuses a non-staff caller with 42501, and that is tested. A phoned-in job's field is **declared**: a square of the stated area on a pin you drop, marked as such, within 1% of the area asked (tested). Assigning prices the job exactly as a normal accept does. Advancing goes through the same transition rules as everyone else: you cannot send an en-route job to "expired", and you cannot move a finished one. Staff can read the whole marketplace through new staff-only read policies.

**App:** a **Match work** link on home, for staff only, opening one screen:
- open jobs, newest first, with the right next action on each (choose captain → on the way → started → done with the amount)
- a new-job form: phone, name, village, work-type chips, killa + kanal, now/today/tomorrow, and a pin set by moving the map
- a captain picker listing verified captains nearest first, with 🟢 for online
- **Share** opens the phone's own share sheet with a Punjabi message: work, area in local units, village, time, the farmer's name and number. No new dependency.

All strings are in three languages, every touch target is 56 px, and the screen has loading, empty and failed states. Android back leaves the form before it leaves the screen.

**Verified by running:** 261 unit tests (6 new: share text in local units with no decimals, killa + kanal entry, row reading), typecheck clean, bundle exports. **In CI:** 230 database assertions (20 new), twice; 12 end-to-end steps, two new ones running the app's own calls: book, list, pick a captain, assign, advance, complete with ₹8,400, then the farmer signs in with his own number and finds the job and field already his.

**Not verified on a phone:** the founder screen itself, meaning the map pin, the share sheet, and how text fits at large font size in Gurmukhi. Add to the first-phone test: book a job for a made-up farmer, assign it, share it to yourself on WhatsApp.

---

## 49 · Getting ready: every server call proven, three more blockers removed

**Asked:** "we can do fast, don't wait for April — we have to get ready."

**Fixed:**
- **The founder could never have become staff (reversal 15).** `admins` holds your number as the docs said, ten digits; profiles hold it with `91`; `is_admin()` compared them exactly. So nobody could verify a captain, and an unverified captain is never offered work. Now compared on the last ten digits (migration 0030, 3 assertions).
- **Home lists, two bugs.** A user who is both farmer and captain saw his own posted job under *Work nearby*, offered back to him, and every offer he received under *My jobs*. And *my queue* matched the captain **by name**, so two captains called Gurpreet Singh would have seen each other's jobs. Now ownership is by field and holding is by id (`splitJobs`, 4 tests).
- **Firebase is picked up automatically.** Drop `google-services.json` into `frontend/` and the build uses it, with nothing to edit. Without it, the app still builds. Checked both ways with `expo config`. The secret service-account key is gitignored.

**SETUP.md:**
- **Step 4** now says what sign-in actually needs: a placeholder SMS provider enabled, and test numbers written with `91`.
- **Step 6** has the Firebase steps, read from Expo's and Firebase's docs today. FCM is on the free Spark plan, which says "No payment method needed".
- **New: a 15-minute first-phone test** — nine steps, each naming what to report if it fails.

**The end-to-end test now covers every server call the app makes.** In order: a captain onboards with a machine and a rate; the founder signs in, is recognised as staff, verifies him through the app's own verify calls and reads the switches; the job is offered by hand, accepted, worked and completed; both sides rate (a retried rating counts once); rate guidance answers; a second job is handed back by the captain ("combine broke") and withdrawn by the farmer; and a phone with no local copy gets everything back. **10 steps, all passing.** Every `sync.ts` call has now run against a real database.

**Verified by running:** 255 unit tests, typecheck clean, bundle exports. **In CI:** the 10-step end-to-end test; 210 database assertions before and after backup-and-restore.

**Not verified:** anything that only exists on a phone: GPS walking, the satellite map, notifications and the lock screen. That is what the first-phone test in SETUP is for.

---

## 48 · Sync pulls only what changed — and the first real run of sync found it had never worked

**Asked:** fix the sync first, then counter everything that is setting us back.

**What "working" meant:** a sync pass downloads only rows changed since the last one; nothing is re-inserted or lost; and the whole core loop runs, by the app's own code, against a real database.

### The fix that was asked for

- **Each stream remembers the newest server timestamp it has seen.** The streams are fields, my jobs and assigned jobs. Each pass asks only for rows changed since then, oldest first, 200 at most, and re-reads a 5-minute overlap so a late-committing transaction cannot slip past. The cursor is always the server's time, never the phone's.
- **Named indexes behind each query:** `jobs_farmer_updated_idx`, `jobs_captain_updated_idx` and `fields_owner_updated_idx`.
- **Making or answering an offer now moves the job's `updated_at`** (a trigger, with no audit row). Without that, the farmer's "offered to N captains" would never change under incremental sync.
- **"Absent from this pull" no longer means "the server has never seen it".** The phone remembers what the server last said about each job, and pushes from that. Under incremental pulls the old rule would have re-inserted every job on every pass.
- **Offers are still read in full each pass** (capped at 50), so an offer another captain took disappears from this captain's screen. Before, it stayed there as "searching".
- **If a phone holds nothing locally, it starts from the beginning**, whatever the cursors say.

**Measured:** an idle pass downloads **879 bytes**, which is the one job inside the overlap. Before, every pass re-sent every job ever, about 880 bytes each.

### The test that did not exist, and what it found

Your brief required an end-to-end CI test of the core loop, and none had been built. `frontend/e2e/core-loop.test.ts` now runs the app's real `sync.ts` against the CI database. A farmer signs in with a fixture test number, saves a field and posts a job; the founder offers it by hand; the captain accepts, goes en route, starts and completes with ₹4,200; the farmer sees it done with the captain named; and a phone with no local copy gets everything back.

**It failed at almost every step, and every failure was real (reversal 14).** Before today, no field, no job and no job update had ever travelled between a phone and the server:

| # | Fault | Fix |
|---|---|---|
| 1 | The fixture test numbers lacked the `91`, so Auth never matched them and tried to send a real SMS | Country code added; CI whitelist updated |
| 2 | Auth refuses any phone sign-in unless *some* SMS provider is enabled, even for test numbers | Twilio enabled locally with **placeholder** credentials, which never send anything |
| 3 | Boundaries sent as GeoJSON; a geography column parses WKT, so "invalid geometry" | Sent as EWKT (`toEwkt`, tested) |
| 4 | No `owner_id` or `farmer_id` was sent, and the policies require them, so every insert was refused | Server defaults them to the signed-in user (migration 0027). Naming someone else is still refused (tested) |
| 5 | The field upsert is checked against the read policy, and `can_see_field(id)` cannot see a row not yet inserted | An owner-reads-own policy (0028). Grants nothing new |
| 6 | The farmer's job query joined `jobs→profiles` through `captain_id`, which points at `captains`, and then `captains→profiles` ambiguously | Two named hops |
| 7 | Fields came back as hex EWKB, which the phone cannot parse, so every pulled field was dropped | `boundary_geojson` computed column (0029) |

Also fixed on the way:
- **Profiles and fields now get a region** (the single live one, and the owner's). Nothing set one before, so every per-region number was empty.
- **Sync now logs a failed pull instead of swallowing it.** Silence is how fault 6 survived.
- **The restore-proof wipe now empties all of Auth**, as a new project has it.

**Verified by running:** 251 unit tests (6 new), typecheck clean, bundle exports. **In CI:** the 7-step core loop passes against a real Supabase stack; 207 database assertions (16 new) pass before and after the backup-and-restore.

**Not verified:**
- **On a phone.** Every fault above would have shown on day one with real captains, which is the strongest argument for doing Stage 1's phone install now.
- **Whether the hosted dashboard needs the same placeholder SMS provider.** Fault 2 is measured locally only. The onboarding doc now says what to do.
- **The real egress saving at scale.** The 879-byte figure is one farmer with one job.

---

## 47 · Stage 3 — running on nothing: backup, switches, metrics, costs

**Asked:** a free nightly encrypted backup with a restore that has actually been run; remote switches for automatic dispatch, the loud ping, founder-code sign-in and the minimum version; SQL metrics views; a cost ledger. Free limits checked against each provider's own docs, not memory.

**What the docs said (20 Nov 2026), which shaped everything:** Supabase Free takes **no backups at all**, pauses a project after **a week of inactivity**, and allows 500 MB. GitHub Free gives about 2,000 Actions minutes and 500 MB of artifacts, and with no card it **blocks instead of billing**. Nothing here can cost money.

### 3.1 Nightly backup

`backup.yml` runs at 03:00 IST. It dumps roles, schema and data with Supabase's documented commands, encrypts them with AES-256 under a `BACKUP_PASSPHRASE` secret, and keeps 30 nights as artifacts. Until `SUPABASE_DB_URL` and the passphrase exist as secrets, it says "nothing backed up" and stays green. Restoring is in [BACKUP_AND_RESTORE](docs/BACKUP_AND_RESTORE.md).

**The restore is proven on every CI run, and that is where the value turned out to be.** CI inserts a real farmer, backs up, checks that a wrong passphrase fails, wipes the database to what a new Supabase project looks like, restores, compares, and then **runs every database assertion again on the restored copy**. The first run matched every row and failed the security tests: `dispatch_job` was callable signed-out, and the internal `accept_job_claim` by anyone (reversal 13). `restore.sh` now switches Supabase's automatic grants off while the schema loads. The fingerprint compares *effective* privileges on every function and table, because one trap stays live: the CLI drops every grant line that mentions `"extensions"`, so a future locked function with a PostGIS parameter would reopen. CI will catch it.

I also made a mistake here. My first fix did not apply, because the edit script did not assert that it had matched. A diagnostic run showed the restore script was unchanged.

Measured: 22 KB encrypted; about 75 s for the whole database job including the proof. The Supabase CLI is now **pinned to 3.2.0**: `latest` is an unauthenticated GitHub API lookup that was rate-limited twice today, and for the nightly job that would mean a silently missed night.

### 3.2 Switches

Two new columns on the `app_config` row, both **off by default** as you asked: `auto_dispatch` and `loud_ping`. The other two already existed.

- **Automatic dispatch is enforced in the database.** Old APKs call `dispatch_job` on every sync and have never heard of the switch. The original is renamed and wrapped, as with `accept_job`, not copied. While it is off, you match by hand: in Studio, add a `job_dispatch` row (job, captain, rank 1), and that captain sees the offer on his next sync.
- **The loud ping gets a separate quiet channel**, because Android freezes a channel's importance when it is created. Both the push function and the on-device ping choose a channel by the switch.
- **Offline,** the last-known values come from the existing cache. A missing switch reads as its safe value: not loud, founder code on.
- **App-side, the row mapping was untested inline code;** it is now a tested pure function. The app reads `*` instead of a column list, so a new APK talking to an older server gets an answer rather than an error.

### 3.3 Metrics

Views in a `metrics` schema the API does not expose and no phone is granted (tested: signed-in and signed-out both get 42501). Every view is per region: jobs per week (posted, completed, cancelled, lapsed), fields by mapping method, farmers who came back within 60 days, and verified captains active in the last 7 days. Active means he reported his location or moved a job. **Area disputes cannot be counted, because nothing records them.** Item 4.4 adds exactly that column, so I did not add it here. Open them in Studio → Table editor → schema `metrics`.

### 3.4 Costs

[COSTS.md](docs/COSTS.md) lists every external service the code calls, with linked limits and estimates at 10 and 100 captains. Three findings:

- **Sync re-downloads everything on every pass.** Every field, every job, and for a captain every job he has ever done, with no limit. That makes Supabase's 5 GB egress the first free limit hit, at around 100 captains. The brief already names the fix (incremental, limited pulls). It is recorded, not fixed, and should be done before about 30 captains.
- **No Firebase/FCM project exists, so no Android phone can receive a remote push** (reversal 12). It is a third-party account, so it is flagged for you rather than created.
- **The update notice has nowhere to point.** A private GitHub repo's release files need a login. The APK host is your decision.

**Verified by running:** 244 unit tests (4 new), typecheck clean, Android bundle exports. **In CI:** 191 database assertions (14 new) pass on a clean database and again on the restored one; backup, wrong-passphrase rejection, restore and fingerprint match. **Not verified:** a backup of the hosted project (there is none yet); the edit to the `notify-dispatch` edge function, which has no test harness and needs FCM before it can deliver anything; the quiet versus loud ping on a phone.

**Your part:** (1) once there is a hosted project, add the `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE` secrets, keep the passphrase somewhere other than GitHub, and run "Nightly backup" by hand once; (2) decide on FCM; (3) decide where APKs are downloaded from.

---

## 46 · 2.8 — back goes back, and a phone call no longer costs him his place

**Asked:** persist the current screen and any draft job so leaving for a phone call and returning restores the same place; check the Android back button on every screen. Sketch approved ("next step").

**What I found:** the app never handled Android back. From **every** screen — mid-drawing, mid-booking — back left the app. And the screen, the half-booked job and the drawn corners lived only in memory, so a cheap phone that killed the app in the background brought him back to home with the work gone. A farmer without an account also landed back on sign-in, because "carry on without signing in" was not remembered either.

**Built (no new dependency, no new screen, no new strings):**
- `src/navigation.ts` — the back table and the restore rules as pure functions. draw/walk → choose (or the test plot, matching their own Cancel); confirm → the walk, which is still checkpointed, so it is "walk again", not a discard and needs no confirmation; testPlot → test; everything else → home; home → Android's default.
- One `BackHandler` in App reading state through a ref; the booking registers its own after it, so back walks *when → service → field* before leaving. Sign-in and first onboarding keep Android's default — there is nothing to go back to. The completion sheet is a `Modal`, which already handles back.
- Saved on every change and restored at start: the screen (the walk result is not stored — confirm restores as the recovered walk), the booking draft (only on the day it was made, since it says "today"), the drawn corners (keyed by field vs test plot, and the map re-centres on them), and the no-account choice. Stale data falls back somewhere safe: a deleted test plot goes to the test list, anything unreadable to home.

**Verified by running:** 240 unit tests (9 new: every back target, restore fallbacks, booking steps, the draft day rule), typecheck clean, Android bundle exports. **Not verified:** on a phone — the back button and process death only exist there.

**Manual check:** (1) Book work, choose a field and a service, go to the time step; press back — you are on the service step, again — field step, again — home. (2) Book work again — your choices are still there; press Cancel — they are gone. (3) Draw a field, place 3 corners; force-stop the app in Android settings (simulates the phone killing it); reopen — you are on the draw screen with 3 corners, map centred on them. (4) On home, back leaves the app as normal.

---

## 45 · 2.9 — walk checkpoints are appended, not rewritten

**Asked:** stop rewriting the whole track on every GPS point; move to append-only storage and migrate any existing saved data.

**What "working" meant:** each fix is one small write regardless of walk length; a crash restore returns every point in walking order; a new walk can never inherit an old walk's points; a walk saved by the previous build survives the update.

**Before:** every GPS fix (one a second) re-serialised and re-wrote the entire track as one JSON blob. Twenty minutes in, that is ~1,200 points — around 100 KB — written every second on the cheapest phone in the district, while it is also running GPS and the screen.

**Now:** one AsyncStorage key per point, `zamindara/walk/<startedAt>/<seq>`, plus a small meta key. No new dependency. Restore reads them back and sorts **numerically** (as text, point 10 sorts before point 9 — there is a test). Keys carry the walk's start time, so leftovers from an earlier walk are ignored and swept; starting a walk clears everything *except* its own keys, because its first fix can land before the clear finishes.

**Migration:** the old single-blob key is read once, rewritten as point keys, and removed — so a farmer mid-walk when the update lands keeps his walk.

**Verified by running:** 231 unit tests (6 new, AsyncStorage mocked in memory: largest write under 200 bytes across a 300-point walk, numeric order, no inheritance, legacy migration, clear, the start race), typecheck clean, Android bundle exports. **Not verified:** on a phone.

**Manual check:** (1) start walking a field; (2) after a minute, swipe the app away from recents; (3) reopen and go to Walk — it shows the walk recovered and paused with the distance it had; (4) resume, finish — the area is shown; (5) start a new walk — it begins at 0 m, not with the old track.

---

## 44 · 2.5 — an accept on a bad signal says "sending", and a retry is not a lost race

**Asked:** an accept that has not reached the server shows "sending", never "accepted", and is dropped when the offer window ends.

**What "working" meant:** the button reads *Sending…* and cannot be tapped twice while the accept is in flight; a failure is retried while the offer stands; when the job stops searching or 90 s pass, it is dropped and he is told; a retry of an accept that already landed is reported as his, not as taken.

**Built:** `sendAccept` (`frontend/src/sendingAccept.ts`) tries, waits 5 s, checks the job is still `searching`, tries again, for at most 90 s — the window in TECH_ARCHITECTURE. Both the card button and the lock-screen Accept go through it, guarded so the two cannot send at once. Nothing is persisted: if the app dies, the attempt dies with it, which is the same as dropping it. The old "Check your signal and try again" message is gone — the phone now does the trying.

**The bug the retry would have created.** If the first accept commits and only the reply is lost on 2G, a retry found the job no longer `searching` and `accept_job` raised 55006. The phone would have said **"Another captain took this job" about a job that was his**, and he goes home while the farmer waits for nobody. Migration 0023 puts a thin wrapper in front: a repeat accept by the holder returns the job and writes nothing. The original is renamed `accept_job_claim` rather than copied — its body holds the race guard, the pricing and two hard-won fixes — and closed to direct calls.

**Raised, not decided:** the 90 s window exists only on the phone. Nothing on the server closes an offer; it stands until someone takes it or the day ends. Building server-side rounds is the real fix and is outside 2.5.

**Verified by running:** 225 unit tests (5 new: lands on first try, through a dead patch, lost race not retried, dropped at the window, dropped when the job stops searching), typecheck clean, Android bundle exports. **Verified in CI:** 6 new DB assertions — retry by the holder lives, writes nothing (same `accepted_at`, same price, one audit row), another captain still gets 55006, the inner function is not callable. **Not verified:** on a phone. Manual check below.

**Manual check on a phone:** (1) signed in as a verified, online captain, have a farmer post a job; (2) when it appears, switch on airplane mode and tap Accept — the button must read *ਭੇਜ ਰਹੇ ਹਾਂ…* and be greyed; (3) within 30 s switch airplane mode off — the card becomes accepted, no alert; (4) repeat with airplane mode left on — after about 90 s an alert says no signal reached the server and the job is not shown as his.

---

## 43 · 2.7 — the lock-screen Accept could silently do nothing

**Asked:** accepting from the lock screen must work when the app was killed and the token has expired.

**The premise was wrong; the bug was worse** (reversal 11). An expired token refreshes on its own — `getSession` does it, checked in the installed auth-js source. The real failure was two silent `return`s: `claimJob` begins `if (profile === null) return`, and a cold start from a notification has no profile yet; and it looked the job up locally first, where a job offered since the last sync is not. Either way the tap did nothing, with no message. A captain that happens to does not report a bug — he stops trusting the sound.

**Fix:** the handler calls `accept_job` directly (it needs only a job id and a session), reconciles local state afterwards, and always tells him something. Tapping the notification *body* no longer accepts — that would commit him to a job because he looked at it.

**Verified:** 220 unit tests (3 new, `lockScreen.test.ts`), 171 DB assertions, typecheck, bundle, CI green. **Not verified:** a real killed-app tap on a phone. Commit `1d69ce5`.

---

## 42 · Stage 1.2 — sign-in without an SMS provider

**Asked:** sign in with Supabase test numbers and a code the founder assigns; a config switch so the screen says "enter the code the founder gave you"; keep real numbers out of git; write the onboarding doc.

**Built:** `app_config.founder_code_signin` (new migration 0022). A column, not a build flag: the day DLT registration clears, the wording must change on phones already in captains' hands. Defaults to **on** at every layer that can fail — column, wire mapping, component — because with nothing configured "no SMS is coming" is the honest answer. Cached on the phone, since sign-in happens in a yard with one bar.

An **i18n completeness test**: every string in pa/hi/en, and no English pasted into the Punjabi slot. All existing strings passed. CI also now rejects any phone number in `auth.sms.test_otp` other than the four fictional fixtures — `supabase config push` would copy them to the hosted project as permanent back doors.

[ONBOARDING_A_CAPTAIN.md](docs/ONBOARDING_A_CAPTAIN.md): dashboard to handset, start to finish.

**Verified:** 217 unit, 171 DB assertions, CI green. **Not verified:** a real sign-in against a hosted project. Commit `49d6b61`.

---

## 41 · Stage 1.1 — a signed APK, and 75.8 MB down to 35.3 MB

**Asked:** exact commands to build a signed APK at home, keystore backup advice, and the size with cuts proposed if over 30 MB.

**Signing** is a config plugin, because `android/` is regenerated by `prebuild --clean` and a hand edit silently vanishes. Passwords live in `~/.gradle/gradle.properties`, never the repo. The plugin **throws** if it cannot apply: the quiet failure is a debug-signed APK, and Android will never update that over a correct one without an uninstall that loses his unsynced fields. Confirmed with `apksigner` (the `keytool` command I first documented reports "Not a signed jar" on a correct v2-only APK — corrected). [SIGNING_AND_RELEASE.md](docs/SIGNING_AND_RELEASE.md) covers backup and what losing the key means.

**Size, measured each step:** 75.8 MB → **43.0** (drop x86/x86_64, emulator-only) → **35.3** (R8 on; dex 29.4 → 8.9 MB). The remaining 26 MB is ARM native code; a per-architecture split would reach ~22 MB at the cost of two APKs to keep straight. Not done. **Keep `mapping.txt` (28 MB) with every APK handed out**, or crash reports are unreadable.

**Two build traps documented:** a build that stops with no error is gradle running out of Metaspace; "Unable to delete classes.jar" is an old daemon holding the file on Windows.

**Not verified:** R8 can break reflection at runtime. Three on-phone checks are in the doc — map draws, a walk counts up, a ping arrives. Commits `776777b`…`503243f`.

---

## 40 · Stage 1.1 — the app can tell you it is out of date

**Asked:** show the version on the home screen; an "update available" notice from one database row.

**Built:** `app_config`, one global row readable without signing in (a phone below the floor must learn it before sign-in). **No write policy at all** — the anon key ships in every APK, and a writable row would let anyone lock out the district or point everyone at their own APK. Version compare is numeric per part (`0.10.0` > `0.9.0`); unreadable compares equal, so a dashboard typo cannot lock out every phone. Home shows `v0.1.0` plus the OTA update id, replacing a fingerprint hash a captain could not read out.

`required` is a stronger sentence, not a locked door — blocking the app mid-harvest is its own decision.

Also corrected three tests: an RLS-blocked UPDATE/DELETE succeeds on zero rows rather than raising, so the meaningful assertion is that the row did not move.

**Verified:** 212 unit, 168 DB assertions, CI green. Commits `0c443c5`, `46afb56`, `2046dd9`.

---

## 39 · An audit, and four things the audit was wrong about

**Asked:** a numbered brief — audit Batches 1–4 against the code, then fix Batch 1. New standing rules came with it: **never edit an existing migration**, failing test before any money or area fix, and every change traced from a tap to a row.

**The audit mattered more than the fixes.** Of ten Batch 1 items, **four were already done** and one had a wrong premise:

- **Area carry** (9603.7 m² → "2 killa 3 kanal") already works. I ran it rather than reading it: `2 killa 3 kanal`, and `500.857 → 1 kanal`. No SQL formats area at all, so that half was not applicable either.
- **`search_path` on every `security definer`** — all sixteen already have it.
- **`lead_time_hours` against scheduled time** — already correct and asserted in 03.
- **One row per captain with several machines** — the machine check is inside `exists(…)`, so duplication was never possible.
- **"Offline accept shows accepted"** — it does not. A failed accept leaves the job searching and says so. The real gap is the absence of a queued "sending" state, which is a different and smaller thing.

Writing that down is the point. Four fixes I did not make is four diffs not reviewed and four chances not taken to break something that worked.

**What was real:**

**A farmer could set his own field area, and therefore his own price.** `derive_field_geometry` recomputes area from the boundary and ignores the client — the column comment even says so. But the trigger was `before insert or update **of boundary**`, which in Postgres fires only when that column is in the UPDATE's list, and `fields_update_own` lets an owner write any column on his own field. So `update fields set area_sqm = 1000000` never fired it, and a one-killa field became four hundred acres: priced, quoted, and fed into rate guidance at that size. The first assertion in the new test file *is* the attack.

Also added a floor of one marla. There was a 200-hectare ceiling and nothing below — a three-square-metre field is equally a mis-drawn polygon, two corners on the same spot while the map was zoomed out. One marla is the smallest unit the app can express, so below it a field already displays as nothing.

**The captain search could not use the spatial index.** `st_dwithin(…, c.service_radius_km * 1000)` reads its distance from the candidate row, so PostGIS has no constant to seek on and the planner scans every captain. The comment beside it claimed the opposite. Now a constant bound first — `captains_radius_sane`'s own maximum, so nobody who would have matched is lost — then the per-captain radius as a filter.

**`dispatch_job` had no abuse limits**, while running on every sync pass and sending a push on success. Now: a confirmed field, five open requests, twenty an hour. And a correction worth keeping — my first test could not even post a job on an unconfirmed field, because `jobs_insert_own` already refuses that. The gap is narrower and more real than I wrote: the field is confirmed when the job is posted and **un-confirmed afterwards by re-drawing it**, and the existing job kept being offered at whatever the new boundary said.

**The phone said when the work happened.** `started_at` and `completed_at` came up from the handset stamped with `Date.now()`. They are what a farmer and a captain argue about, so they cannot be one party's word. A trigger stamps each on the transition that earns it and **freezes all three otherwise** — the freeze being the half that matters, because without it the completion write still carried the handset's `started_at` up with it. The client stops sending them.

**Verified:** 204 unit tests, **159 database assertions** (20 new), typecheck clean across 6 packages, 828 modules bundling, CI green.

**Raised, not decided:** five open requests and twenty an hour are my numbers, and wrong if a commission agent books for ten farmers from one handset. A 200 km service radius is the whole of Punjab, so the new index bound is correct but not sharp. And server time means a captain who finishes at 14:00 with no signal and syncs at 19:00 is recorded at 19:00.

**Noted conflict:** entries 33 and 36 edited migrations 0008 and 0010 in place, on the reasoning that nothing was deployed. That is now forbidden. Harmless while there is no hosted project; a problem the moment there is one.

---

## 38 · The request that never died

**Asked:** get started and continue.

`expired` has been in the `job_status` enum since the **first migration**. The constraint permits it, the transition guard allows `searching → expired`, and the app had code to handle it. **Nothing ever set it.**

So: a farmer asks for a combine tomorrow morning. Nobody takes it. Tomorrow comes and goes, and the job stays `searching` — forever. And because re-dispatch runs on every sync pass (entry 30) and push is wired (entry 31), that dead request keeps **ringing captains' phones about work from last week**. By late November the pool would be full of them, every captain's phone going off for harvests already done.

That is precisely the failure `cancel_job` was built to stop — except cancelling needs a farmer to remember. A request for a day that has ended should lapse on its own.

**One rule, and it fits in a sentence a farmer would accept: a request stands for the day it was wanted, and no longer.** `scheduled_date` for a booked job, the day it was posted for an immediate one. Nobody wants yesterday's harvest request quietly filled today.

**No scheduler.** `expire_stale_jobs()` is time-based and idempotent, so it is safe for *any* signed-in client to call on *every* sync pass — and that is the mechanism rather than a waste. Whoever opens their app next keeps the pool clean. A function that writes other people's rows and is callable by anyone deserves the scrutiny, so: it can only move `searching → expired`, only for jobs whose day is already over, and no caller can name a job or expire one early. The clock decides. There is an assertion that a captain running it gets the same answer as the farmer, and one that an unauthenticated caller cannot run it at all. (`pg_cron` is the textbook home for this and is marked as the upgrade path; it needs enabling and scheduling, and expiring when someone next looks is enough for a district.)

**It closes the offers too.** The open `job_dispatch` row *is* the stale ping — a captain sees pending offers in his feed whether or not anyone re-dispatches. Expiring the job without closing them would have fixed the symptom I could see and left the one he could.

**Order matters, twice.** The sweep runs before the pull and before re-dispatch. After the pull, this pass would still ping captains about a job about to expire, and the farmer would see "finding a captain" for one more pass on a request that had already stopped standing.

**And the app had to stop hiding it.** `jobFromWire` dropped `expired` along with `draft`, so a lapsed request would have **vanished from the farmer's list with no explanation** — worse than the "finding a captain" it replaced, and it hid the single fact he needs: *no captain was free that day.* Now a real local status, muted rather than red because nobody did anything wrong, with a sentence under it in all three languages.

**Deliberately skipped:** a one-tap "ask again". His crop still needs cutting, but he already has a Book work button, and what a re-post should carry over is a November question, not a guess. Noted here so it is a decision rather than an omission.

**Verified:** 203 unit tests (4 new), **139 database assertions** (11 new), typecheck clean across 6 packages, 828 modules bundling.

---

## 37 · Install once, not once per change

**Asked:** we shouldn't have to download it again and again — changes should reach the app by themselves, because there will be a lot of changes.

Correct, and nothing was set up for it. Neither `expo-updates` nor `expo-dev-client` was installed, there was no `eas.json`, and the only documented way to see a change was `prebuild` → `assembleRelease` → reinstall a 70 MB APK. Over a season of hourly changes that is not a workflow, it is a tax.

**Two mechanisms, because there are two different situations** and conflating them is how people end up handing a captain a build that needs a laptop.

**While building (fifty times a day):** a **development build** — `expo-dev-client` in a debug APK. Installed once, it loads the app's code from Metro on the laptop, so a saved file is on the phone in about a second. `--tunnel` covers a phone on mobile data out in a field rather than on the office Wi-Fi.

**Once other people have it:** `expo-updates` against EAS Update. A JS change published with `eas update` is running on every captain's phone the next time he opens the app. He is asked nothing and downloads no APK.

**Three decisions worth recording:**

- **`fallbackToCacheTimeout: 0`** — the app *never* waits on the network to start. It opens on the bundle it already has and fetches a new one in the background for next time. Verified in the generated manifest as `EXPO_UPDATES_LAUNCH_WAIT_MS=0`. The alternative is a farmer watching a splash screen on 2G, which is worse than running yesterday's code.
- **`runtimeVersion: { policy: "fingerprint" }`** rather than `appVersion`. Fingerprint hashes the native project, so an update physically cannot be delivered to an app whose native side does not match. The alternative relies on a solo founder remembering to bump a version string before publishing — and the failure mode of forgetting is a crash on a captain's phone mid-harvest. This removes the whole class.
- **The update URL is derived, not configured.** `eas init` writes a project id into app.json; `app.config.ts` builds `https://u.expo.dev/<id>` from it. No second thing to set, no placeholder pointing at nothing, and no project id = updates cleanly off, which is the correct state today. Proven both ways with `expo config`: no id → no `updates` block and `expo.modules.updates.ENABLED=false` in the manifest; with an id → the full block resolves.

**A build line on the home screen**, like `v1.0.0 · a3f9c2e1 · 2026-11-06`. Not decoration: once updates are live, two captains holding the *same APK* can be running different code, so when one rings to say the app did something odd, that line is the only way to know whether his phone has the fix. `built in` when he is on the original bundle.

**Written down plainly in SETUP, including what OTA cannot do** — a table of what needs a real APK (new native library, new permission, anything in the `android` block, an SDK bump). The fingerprint policy enforces it, but the founder should know why an update sometimes reaches nobody.

**Cost checked, not assumed:** EAS Update's free tier is 1,000 monthly active users with no overage charge. Fifteen captains and a hundred and fifty farmers is nowhere near it. And **EAS Build is not needed** — the APK keeps being built locally with gradle, as it is now; only the updates go through Expo.

**Verified:** 199 unit tests, 128 database assertions, typecheck clean, 828 modules bundling, `expo prebuild` now succeeds (the adaptive-icon failure from entry 18 is gone), the native manifest carries the intended values (`expo.modules.updates.ENABLED=false` until `eas init`, `EXPO_UPDATES_LAUNCH_WAIT_MS=0`), and **the development APK builds and really is one** — `DevLauncherActivity` is in the merged debug manifest and there is no embedded JS bundle, which together are what make it load from Metro. 46 minutes clean, 190 MB; both expected for a dev build and both now in SETUP so they do not read as faults.

**Two traps found by actually running it, both now in SETUP.**

`prebuild --clean` deletes `frontend/android/` and rebuilds it from `app.json` — which is the point — but it does **not** regenerate `android/local.properties`, the file telling gradle where the Android SDK is. The next build fails with "SDK location not found". It also deletes any APK already built there; the 70 MB release APK from entry 18 went with it.

Recreating that file, I wrote the Windows path with single backslashes. It is a **Java properties file**, so `C:\Users\...` is read as escape sequences — `\r` became a carriage return — and gradle failed with *"The filename, directory name, or volume label syntax is incorrect"*, which says nothing about the real cause. Forward slashes need no escaping. Both the file and the SETUP instructions now use them.

**And a mistake in how I checked.** The first build ran as `./gradlew assembleDebug -q 2>&1 | tail`, so the exit code reported was `tail`'s, not gradle's: the harness said **exit 0** while the log said **BUILD FAILED**. A pipeline hides the failure of everything but its last command. Re-run writing to a log and testing `$?` directly, which is how both traps above were actually found.

**Not verified, and not verifiable here:** that an update actually lands on a handset. That needs `eas init`, a phone, and a published update — three things that are yours. The configuration is proven; the delivery is not.

---

## 36 · "If it's 5 km away, increase some amount of fare"

**Asked:** next step. I ran a caller audit first — every table and every function in the schema, checked against everything the app can reach — to prove the entry-35 family was actually closed rather than assume it. Three tables and twelve functions have no caller; eleven of those are correct (trigger bodies, RLS policy helpers, SQL used inside other functions). Two were not.

**`quote_job` had no caller anywhere** — not in the app, not in SQL. And with it dead, so was everything downstream: `machine_types.travel_rate_per_km` (₹40–60/km, set per machine), `regions.free_travel_km` (5 km), and the whole travel half of the pricing library.

Which means the thing asked for in the second message of this project — *"if its 5 km away than increase some amount of fare"* — **was applied to nothing.** `travel_charge` was literally `0` on every job the app ever created.

The reason is a genuine design trap rather than an oversight: the app priced a job at **posting** time, and at posting time there is no captain, so there is no distance. The comment in `JobPostFlow` even says so — "travel is unknown until a captain accepts". It was right. Nothing ever came back to price it afterwards.

**So `accept_job` prices the job now.** Accepting is the one moment all three unknowns resolve together: whose rate, how far, which machine. It calls `quote_job` — which rescues it from being dead code — and writes `quoted_rate`, `quoted_unit`, `quoted_subtotal`, `travel_charge` and `quoted_total` from the captain who actually took the work.

Note what that changes: the farmer posted against **district guidance**, a range midpoint with no travel in it. Accepting replaces it with **this captain's own rate plus his drive**. Informative, not binding — v1 moves no money and the amount taken is typed in on completion. What it buys is a captain 25 km out who can see he is paid for coming, instead of one who learns to refuse distant work and strands the farmers hardest to reach.

**The card shows both halves** — "work ₹2,668 · travel ₹200 = ₹2,868". Without that the total silently moves after a captain accepts, which reads as the app putting the price up.

**And the duplication had already drifted.** `quote()` in TypeScript and `quote_job` in SQL deliberately duplicate each other so the phone can price with no signal. For an hourly job TS returned a **null** total, correctly — the total is unknowable until the work is done. The SQL returned `coalesce(subtotal, 0) + travel`: **the travel charge on its own**, a price made entirely of the drive out. Nothing had ever compared the two. The SQL now matches the TS, and a new assertion pins the `PRICING.md` worked example on *both* sides — 388 marla at ₹1,100 plus 4 chargeable km at ₹50 = ₹2,867.50 — so the next drift fails CI instead of quoting a farmer the cost of a drive.

**10 new assertions** in a new `06_pricing.test.sql`: the captain in the next village is charged nothing, the combine 30 km out is paid for coming, the charge is exactly the kilometres past the free five at the machine's own rate, the total is the work plus the drive, an hourly job says it cannot say yet, and accepting writes all of it onto the job.

**And CI caught my own assertion.** The one checking "exactly the kilometres beyond the free five, at the machine's own rate" hardcoded **₹40** — the column default — while a combine is **₹60/km**. It wanted ₹1,354.40 and the code produced ₹2,031.60. The code was right; the expectation was wrong, and in exactly the way the sentence beside it warned against. Now read from the catalogue.

**Verified:** 199 unit tests, **128 database assertions**, typecheck clean across 6 packages, 828 modules bundling, CI green on all three jobs.

**Audit result, for the record.** The remaining uncalled things are uncalled correctly: `job_events` is written by a trigger and read out-of-band when a dispute needs evidence; `admins` is reached only through `is_admin()`; `regions` is read by `quote_job` and by RLS, not by the app. The family entry 35 described is closed.

---

## 35 · Every captain ranked as the same 3.5

**Asked:** solve the bugs, then start building. This is the last of the family entry 34 flagged.

`eligible_captains` gives rating **30% of the match score**. The `ratings` table existed, the trigger that moves `captains.rating_avg` existed — and was fixed in entry 28 when RLS broke it — and the RLS insert policy was already exactly right. **Nothing in the app could write one.** So 30% of the decision about who gets offered work was `coalesce(rating_avg, 3.5)`: the same constant for every captain in Fazilka, forever. A captain who did forty good jobs ranked identically to one who had just signed up.

**No RPC needed**, and that is the lazy part worth noting. `ratings_insert_party` already proves the job is completed, that the rater was a party to it, and that the ratee is the other one. A plain insert is enough; adding a function would have duplicated a guard that was already correct.

**Farmer rates captain only.** Two-way reputation is a Phase 7 item and it buys dispatch nothing — the farmer is not ranked by anything, so rating him changes no decision. Building both halves would have doubled the work to fix none of the bug. `ratingAsk` returns null for the captain's side on purpose, with the reason in the code.

**Five taps, no comment box, asked once.** On the card, right after the work is done, which is the only moment he remembers it. Each star is a full touch target because five glyphs in a row is the classic way to make a farmer in gloves hit the wrong one. Stars are `★`/`☆` characters — no icon font to ship. Written locally first so a tap with no signal stays tapped, then pushed; the unique `(job_id, rater_id)` makes the retry idempotent, and `23505` is treated as success because it means the rating already landed.

**Three new assertions**, on rules a star row can now actually hit and nothing had ever exercised: tapping twice is refused and his average is *not* dragged by the retry, and work nobody has done cannot be rated.

Also added `captainId` to the local job — rating someone needs his id, and the row already carried it under `select('*')`; it was simply never mapped. His existing rating rides along in the farmer's own-jobs round trip, next to the offer count, rather than costing a second query on 2G.

**Verified:** 199 unit tests (4 new), **118 database assertions**, typecheck clean across 6 packages, 828 modules bundling, CI green on all three jobs.

**What this closes.** Four entries — 29, 30, 33, 34, 35 — were all the same bug: a server capability that was built, tested and correct, with no caller. Verification, re-dispatch, rate guidance, getting out of a job, ratings. The lesson is not about any of them individually: **a passing database suite proves the server keeps its promises, and says nothing about whether anyone ever asks it to.** Tracing each flow from a thumb on a screen to a row in Postgres is what found all five, and it is now a standing rule in BUILD_PLAN.

---

## 34 · There was no way out of a job

**Asked:** solve the bugs, then start building.

With the money path fixed, the next thing November actually needs is not a feature from the plan — it is the one that was missing. **Nothing could get out of a job.**

A farmer who posted by mistake, or whose crop turned out not to be ready, had no way to withdraw. The job sat in `searching` and — since entry 30 made re-dispatch run every sync pass — was re-offered to captains **forever**. The fastest possible way to teach a captain to ignore the ping, which is the one thing that has to work in April. And a captain whose combine broke after accepting could not hand the job back: the farmer waited on a machine that was never coming, and the job could never reach anyone else.

**Two functions, deliberately not one.** `cancel_job` is the farmer saying he no longer wants the work. `release_job` is the captain saying he cannot do it — and the job goes **back to `searching`**, unassigned, so it reaches someone else. Collapsing them would have been shorter and wrong: a breakdown is not a cancellation, and the job should go back on the market rather than die with his gearbox.

Release is only worth having *because* re-dispatch now runs every pass. The two entries fit together: 30 made a stranded job findable, 34 is what creates one honestly.

**Neither is allowed once work is `in_progress`.** A machine is in the field and diesel has been burned; what is being asked for then is a settlement, and a button cannot decide one. The app says so — "work has already started, settle it by phone" — which is the season's stated plan for disputes anyway.

**And the guard had to move onto the table.** `jobs_update_party` lets a farmer or his captain write *any* column on their own job, status included. So both function guards were advisory: a client setting `status = 'cancelled'` directly on a job already being cut sailed straight past them. Our app wouldn't — but "our app wouldn't" is not a guarantee, and everything else in this schema puts its guarantees in the database. `jobs_transition_guard` now enforces the legal moves on the table itself.

Forward moves stay permissive on purpose, `accepted → completed` included: a captain who drives out, cuts, and only then touches his phone never tapped "on my way", and refusing his completion would be the app arguing with what actually happened. What is refused is a job going backwards without being released, and work being cancelled after it started.

**The affordances are deliberately quiet** — a text press, left-aligned, last on the card, never a full-width button beside "on my way". Ending a job is not what either of them came to do, and a bumpy tractor seat makes a mis-tap expensive. Both ask first. Nothing moves locally unless the server agreed, because a cancel that half happened is worse than one that did not: the farmer would stop expecting a machine that is still coming.

**No reason text.** The founder is shadowing every job this season and will hear the reason by phone; a free-text box in a field, in the sun, collects nothing worth reading. The column stays for when that changes.

**18 new database assertions** — a stranger cannot cancel, an *offered captain* cannot cancel the farmer's job, the farmer can and the open offers close, a cancelled job stops being re-dispatched, a released job reaches the other captain and he can take it, and writing the status column directly gets around none of it.

**Verified:** 195 unit tests (3 new), **115 database assertions**, typecheck clean across 6 packages, 828 modules bundling, CI green on all three jobs.

**Found while writing it, not fixed yet:** nothing in the app can write a **rating**. The table, the trigger and `captains.rating` all exist, and `eligible_captains` gives rating **30% of the match score** — so today it ranks every captain by the same constant 3.5. Same family as entries 29, 30 and 33: a built, tested server capability with no caller. That is the next one.

---

## 33 · The rate guide was quoting itself

**Asked:** solve the bugs, then start building.

Traced the money — post, accept, complete, what the next farmer is then told. Three bugs, all on that path, all invisible to the suite because nothing tested the end of it.

**1 · Guidance learned from its own guesses.** `rate_guidance` took the percentiles of **`quoted_rate`** — the number the platform suggested — not of the money. So a farmer who was shown ₹1200 and settled at ₹900 still fed ₹1200 into the next farmer's guide. Nothing it ever said came from money changing hands, and the guide could only rise. The posting screen says, in a comment I had written myself: *"Guidance comes from what has actually been paid nearby, never from a number the platform invented."* It was the number the platform invented.

Now `(final_amount − travel_charge) / killa`, in the SQL and in `completedRates` identically. Travel comes off first because it is a charge for distance, not a rate for work — leave it in and every far field looks like an expensive one. A job completed with no amount named does not vote.

**2 · No farmer could ever have seen it.** `rate_guidance` was **never called**. The screen computed guidance from `history` — the farmer's *own* jobs — which needs three completed per-killa jobs of the same service on his own phone. Every farmer in April has none, so the price estimate simply never appeared. Same shape as the verification gap in entry 29: a built, tested, correct server function with no caller. Its signature took a PostGIS `geography`, which supabase-js cannot send — so it was not callable from a phone even in principle. Now lat/lng, called with the field's centroid, with his own history still the offline fallback.

**3 · The completion sheet held the previous job's money.** `CompleteJobSheet` was mounted permanently with `job={completing}`, usually null. `useState` runs once, so the prefill never arrived — and after one completion the amount field kept the **last job's number**, one tap from being recorded as what was taken for this one. Fixed by mounting it only while a job is being closed, which also let the null branches inside it go.

**Four new database assertions**, the ones that tell a quote from a payment: three jobs all quoted ₹1200 and paid ₹800/₹900/₹1000 must report ₹850, travel must not be read as rate, an unpaid job must not vote. There were **no assertions on `rate_guidance` at all** — that is why it lived.

**Verified:** 192 unit tests (5 new), 97 database assertions, typecheck clean across 6 packages, 828 modules bundling, CI green on all three jobs.

**Migrations edited in place** rather than added: nothing is deployed yet (SETUP step 4), and CI drops and reapplies from scratch. Once there is a hosted project this stops being allowed.

---

## 32 · "Finding a captain" now says whether anyone was asked

**Asked:** (message arrived truncated — "leave it and try to solve and") continued with the item I had named as next on my side.

Entry 30 left this written down as known and left: a farmer watching **"ਕੈਪਟਨ ਲੱਭ ਰਹੇ ਹਾਂ"** could not tell a captain thinking it over from nobody having been asked at all. Those are different situations and he acts differently on them — the second one means ring someone himself.

**`searchState(job)` in `frontend/src/jobs.ts`**, a pure function with three answers: `offered` with a count, `nobody-yet`, and `unknown`. Unknown matters as much as the other two — before a sync, or with no backend, the app genuinely does not know, and saying "0 captains" there would be a lie that costs the farmer a phone call.

**The count comes free.** The farmer's own-jobs select already runs; it gained `job_dispatch(count)` in the same round trip. `job_dispatch_read` already lets a farmer see offers on his own job, so **no migration** was needed — checked before writing one.

**A swap found by typing, not by reading.** Adding the parameter exposed that `sync.ts` passed `distanceKm` and `offeredCount` in one order and `mapping.ts` declared them in the other. Both are `number | null`, so TypeScript was happy and the farmer would have been told his captain was *3 km away* when 3 was the number of captains asked. Caught because a test asserted `distanceKm` was still 2.5 and got 3. Signature now matches the caller, and `offeredCount` has its own assertion so the pair cannot silently swap again.

**Verified:** 187 unit tests (3 new), 93 database assertions, typecheck clean across 6 packages, 828 modules bundling.

**Deliberately small:** one muted line under the status, no spinner, no "asked 3, waiting on 3". `readCount` returns `null` rather than guessing when the wire shape is unexpected.

---

## 31 · Push that reaches a captain who is not looking at his phone

**Asked:** do the push notification one.

The ping was local only — a captain on a second phone found out about work by **opening the app**, which is the opposite of behaving like an incoming call.

**`push_tokens`, keyed on the token rather than the profile.** A device token is globally unique, so when a phone changes hands the row follows the device instead of leaving a stale one pointed at the wrong person — which would send a captain's work to a stranger. One person may hold several devices and all of them ring.

**9 assertions, mostly about who *cannot* read them.** A push token is a delivery address; a leaked set is a spam channel aimed at every captain in the district. So: another user reads nothing, cannot register a token against someone else, a moved device leaves the old owner, and a malformed token is refused at the door rather than failing silently at send time.

**`notify-dispatch` edge function.** Verifies from the caller's JWT that he is the farmer who posted the job, then reads tokens with the service role so they never reach a client. Message in Punjabi with the area in killa, and it sets the **same channel id the app creates** — a mismatch there makes Android downgrade it to a quiet notification and loses the entire point.

**Two deliberate restraints:**
- Rings only when someone *new* was offered the job. Re-dispatch returns 0 for captains already holding the offer, and ringing them every sync pass would teach them to ignore the sound.
- Push failures are swallowed. A push that does not arrive is a captain who sees the job when he opens the app; a push that blocks the farmer's sync is a farmer staring at a spinner.

**Verified:** 177 unit tests, **93 database assertions**, typecheck clean, 828 modules, all three CI jobs green.

**Not verified, and not verifiable here:** the edge function and actual delivery need a deploy and two real phones. The token table and its policies are proven; everything from the function to the handset is not. SETUP.md carries the two commands — a free `eas init` for the project id, and one `functions deploy`.

---

## 30 · The 6am job that nobody would ever see

**Asked:** keep working on what is mine.

Traced the whole November flow looking for more silent dead ends of the same kind as the verification gap. Most of it held up — `dispatch_job` *is* called, online state and location *do* reach the server, machines and rates *are* pushed. One thing did not.

**`dispatch_job` was called only when a job was first inserted.** So a job posted at 6am, before any captain came online, was offered to nobody and sat in `searching` **forever** — the farmer watching a screen that said "finding a captain" and meant nothing. Like the verification gap, it would have read as *no demand* rather than as a bug.

Now re-offered on every sync pass. The function is idempotent (`on conflict do nothing`) and farmer-only, both already asserted, so repeating it is safe and picks up anyone who has come online since.

**And a mistake worth recording.** My first test for this verified a captain halfway through `03_dispatch` to prove re-dispatch finds newly available supply. The fixture is shared, and five later assertions depended on that captain being *unverified* — including the one checking an unverified captain is not offered work. Rewritten as the actual regression, on its own job, after everything else: take the only captain offline, post a job, assert it reaches nobody, bring him online, assert the same job is then offered.

A test that mutates shared fixture state mid-file does not just fail — it invalidates everything downstream of it, and the failures point at innocent assertions.

**Verified:** 177 unit tests, **93 database assertions**, typecheck clean, 828 modules, all three CI jobs green.

**Known and left:** the farmer is not told *how many* captains were offered his job, so "finding a captain" is still silent about whether anyone was asked. And the job ping is still local — a captain on a second phone learns about work only by opening the app, because remote push needs a token table and an edge function. Neither is a dead end now; both are worth doing before captains are relying on it.

---

## 29 · No captain could ever have worked

**Asked:** start on the work that is mine; the field test waits for his time.

**Went looking for what actually blocks November rather than picking a feature — and found it.**

**There was no path to `verified` at all.** `captains.verification` defaults to `pending`, every dispatch query requires `verified`, and the RLS policy correctly stops a captain promoting himself. But nothing else could promote him either.

So every captain onboarded in November would have been a ghost: invisible to farmers (`captains_read` only exposes verified), never returned by `eligible_captains`, never offered a single job. **The soft launch could not have worked**, and the failure would have looked like "nobody is getting work" rather than like a bug.

**Built:**
- `admins` table, phone-keyed, RLS deny-all with no policies by design. A table rather than a JWT claim or an env var, so there is one obvious place to look and no chance of app and database disagreeing about who is staff.
- `is_admin()`, `pending_captains()`, `set_captain_verification()` — all `security definer`, guard in the database.
- A one-tap verify screen, staff-only, used in the yard next to the machine. That is where the decision is actually made, and it is better evidence than a document check.
- **14 pgTAP assertions**: a farmer cannot verify, a captain cannot verify himself through the function either, a captain cannot read the pending queue, the founder can, who decided and when is recorded, and the captain becomes visible to farmers afterwards.

**Two rules that fell out of the design:** verification cannot be set back to `pending`, because that would erase who decided. And a captain with no machine cannot be verified — there is nothing to match him to, so the button stays disabled.

**Stopped hand-counting pgTAP plans.** Third miscount; a wrong number fails a whole file even when every assertion passes. `backend/check-plans.sh` compares each declared plan to the assertions in the file and runs before the containers boot, so it fails in seconds instead of two minutes. It found 04 at 14 rather than 13 and confirmed the other three were right. Git on Windows does not track the exec bit, so CI invokes it through `bash`.

**Verified:** 177 unit tests, **93 database assertions**, typecheck clean, 828 modules bundling, all three CI jobs green.

**Added to SETUP.md:** the one `insert into admins` row that makes him staff. Without it he cannot verify anyone, and nothing in the app would explain why no captain ever gets work.

---

## 28 · Setup, and the handover list

**Asked:** set up, then give me the full instructions for what is pending on my side.

**Done here:**

- **Secrets moved out of tracked files.** The Maps key sat inline in `app.json`, which is committed — a live key pasted there is a leaked key. `app.config.ts` now reads all three from a gitignored `.env`, `.env.example` names them, and `app.json` carries none of them.
- **Closed the sync test gap** from the audit. `sync.ts` had 507 lines with no coverage, and its two merge decisions are where a sync silently discards work done in a field. Both extracted, tested, and *used by `sync.ts` itself* rather than copied: `localProfileIsNewer` (tie goes to the server to stop two phones ping-ponging; an undateable server row loses, because discarding confirmed edits is the worse mistake; marked that it trusts the device clock) and `keepJustPushed` (the pull predates this pass's writes, so a job just accepted must not flip back to searching on the captain's screen).
- **Release APK rebuilt** — 72 MB, standalone, JS bundled, all four CPU types.
- **[SETUP.md](SETUP.md)** — the founder's pending work, ordered, with the commands verified rather than guessed. The Google SHA-1 is inlined because I read it off the machine rather than asking him to.

**Verified:** 177 unit tests, 68 database assertions, typecheck clean, CI green on all three jobs.

**Still his, and unblockable by me:** Google Maps key, a hosted Supabase project, the app on a real phone, a 50 m tape, and the 20-plot field test. Plus DLT registration with TRAI, which is the longest lead time in the plan and blocks every real captain from logging in.

---

## 27 · Full audit, and the plan re-dated

**Asked:** go through the plan again, check every line, re-test everything from the start, then re-analyse.

**Everything ran. All of it green.**

| Check | Result |
|---|---|
| Unit tests | **167** — units 41, frontend 45, geo 24, pricing 20, scheduling 19, catalog 18 |
| Database assertions | **68** — schema 31, guarantees 19, dispatch 18 |
| Typecheck | 0 errors across 6 packages |
| Metro bundle | 827 modules from the new `frontend/` path |
| CI | all three jobs green |
| Code | frontend 7,692 lines · packages 3,759 · backend 2,113 |

**The audit finding that matters is not in the code.**

Today is 31 October. The plan was written on 15 August for an April harvest. **The code is ahead of plan — and the field work is zero.** No commits between 28 August and 30 October.

Phase 1 was written as a gate: nothing else gets built until a measured boundary matches a tape. Phases 3, 4 and 5 were built anyway. Defensible at the time — the schema does not change based on whether GPS reads 2% or 3% — but the debt is due now, and it is due before a captain ever sees the app.

**Prerequisites, all still missing:** Google Maps key is the placeholder, so the primary capture method does not work at all. No hosted Supabase project, so sync has never run against anything. No `android/` directory — my restructure removed it. No device. No tape.

**The sowing window is open right now** and roughly three weeks remain of it. It is one of only two chances to rehearse on a main crop before April.

**Plan revised in place**, original kept as the record. November's target cut from 50 captains and 40 jobs to **10–15 captains and 5–10 real jobs** — fifty captains in three weeks from a standing start, by one person who has not yet put the app on a phone, is a wish rather than a plan. The kinnow season becomes the real soft launch. April does not move.

**One real test gap found:** `frontend/src/sync/sync.ts` is 507 lines with no test. The pure mapping beneath it has 28, and `mergeById` is tested and documented as remote-wins — but the orchestration around it is not covered, and it decides when a farmer's local field or job is overwritten. Its profile merge also compares `updatedAt` against the server, which trusts the phone's clock.

Screens being untested is fine and deliberate. `packages/geo/src/rectangle.ts` looked untested to a naive scan but is exercised through `processWalk`.

---

## 26 · Backend and frontend, separated by folder

**Asked:** keep backend in a backend folder and frontend in a frontend folder, so the layout is readable. Also: cross-check and test everything before claiming it works.

**Moved:**

```
backend/supabase/   migrations, pgTAP tests, config — CLI runs from backend/
frontend/           the Expo Android app  (@zamindara/frontend)
packages/           logic shared or mirrored between them
docs/
```

`supabase/` sits under `backend/` rather than being renamed, because the Supabase CLI discovers that folder by name — the database CI job just runs from `backend/` now, with no flags.

**What a rename actually touches**, all of it verified rather than assumed: npm workspaces, Metro's `workspaceRoot` (one level up, not two), the seed generator's output path, the CI app job's working directory, the CI database job's defaults, three source comments, five docs, and the package name — which was still `@zamindara/mobile` while the folder said `frontend`, exactly the confusion the move was meant to remove. Lockfile regenerated so no stale name survived in it.

Dropped `frontend/android/` and the app's `node_modules` before moving: both regenerate in one command, and the CMake cache holds absolute paths that a rename would leave pointing at a directory that no longer exists.

**Verified:** 167 unit tests, typecheck clean, 827 modules bundling from the new path, seed regenerating into `backend/`, and all three CI jobs green including the SQL.

**One self-inflicted break on the way, worth recording.** Deleting the lockfile to clear the old package name regenerated it on Windows, and rollup ships one native binary per platform as an optional dependency — so the Linux one vanished and `npm ci` left vitest with no engine on CI. `npm install` did not help either: it honours the lockfile including the *absence*. Fixed by declaring both binaries explicitly, each carrying its own `os` constraint, so `npm ci` and its determinism stay.

**Standing instruction recorded:** written and verified are different states, and only CI running the SQL counts as verified for the backend.

---

## 25 · Three bugs the sync work was hiding

**Asked:** continue.

Found ~2,100 lines of uncommitted sync work in the tree, locally green. Committed it and let CI run the SQL, which had never executed. **Three real bugs, all of them production bugs rather than test nits.**

**1. The audit trigger could never write.** `job_events` had RLS with a read policy and no insert policy, so `log_job_status_change` threw on every single job status change. Phases 4 and 5 built the entire job lifecycle on a trigger that always failed.

**2. The ratings trigger had the same shape, latent.** A farmer rating a captain updates the captain's row, which `captains_update_own` forbids. Nothing had left a rating yet, so nothing noticed. Both are now `security definer` — which is right on its own merits: an audit trail is written by the system, and an insert policy on it would let a user forge job history.

**3. A captain was punished for a ping he had not answered yet.** `accept_rate` divided accepted offers by *all* offers, so a pending dispatch counted as a refusal. Offer a captain work and his acceptance rate drops instantly — meaning in harvest week the busiest, most responsive captains would rank below strangers with no history at all. Exactly backwards.

The dispatch test caught it as a symptom: the nearer owned combine lost rank 1 to a borrowed machine twice as far out, purely because it had one unanswered ping from a job dispatched seconds earlier. Now divides by resolved offers only.

**Noted while there:** distance is normalised over 50 km, so two captains a few hundred metres apart score almost identically and the softer terms decide. Fine while one district is the whole market; marked with a `ponytail:` comment rather than redesigned.

**Verified:** all three CI jobs green. 167 unit tests, 68 database assertions.

---

## 24 · Phase 2.5 — sync, and the marketplace is real

**Asked:** build the next phase.

**Why this one.** Sync was the stated last step before a working marketplace: the local models (`profile.ts`, `storage.ts`, `jobs.ts`) were built mirror-image to the database tables in Phase 2 precisely so this phase would be a change of storage, not a change of model. That promise mostly held — and where it did not, the mapping layer is where the difference lives, tested.

**Built:** profiles, fields and jobs cross between the phone and Postgres.

- **Mobile `src/sync/`** — two files, one rule each. `mapping.ts` is the pure wire format (corners ↔ GeoJSON, epoch ms ↔ ISO, enums both ways, uuid minting) with 28 tests, because every line there touches area or money. `sync.ts` is the orchestration: push before pull, catalogue codes resolved to server ids, typed outcomes, nothing throws.
- **Migration 12, `dispatch_job`** — the farmer's phone calls it after posting; it runs `eligible_captains` and writes the `job_dispatch` rows server-side. This closes the gap the RLS left on purpose: there is no client insert policy on `job_dispatch`, because who gets offered work is not the farmer's phone's decision.
- **pgTAP suite 03** — 18 assertions walking the exact path two phones will take: post, offer, accept. The eligibility rules are the assertions — the unverified captain is never offered, the borrowed combine is offered only when the job is far enough ahead to clear its lead time, nobody is pinged twice, only the posting farmer can dispatch, anon cannot dispatch at all, and the accept path still produces exactly one winner.
- **App wiring** — ids minted as UUIDs at creation; a sync pass on start and on every app activation (the same moment token refresh already ran); posted/claimed/advanced jobs push immediately; going online takes a one-shot GPS fix.

**Decisions:**

- **The offer is a SQL function, not the edge function.** The edge function's job is the *push broadcast* — waking phones — which needs the server outside Postgres. The *offer* is only rows in `job_dispatch`, and Postgres already has the eligibility logic and the transaction. Shipping the offer as SQL means dispatch works end-to-end today and the edge function, when it comes, adds wake-ups rather than intelligence.
- **Ids are minted on the phone, as UUIDs.** A field measured with no signal must become the same row on the server it already is on the phone — not a twin with a new id. Old `Date.now()` ids are detected and pushed *without* an id, so the server assigns one and the phone adopts it on the merge.
- **The server wins every conflict — except a status cannot move backwards.** Pull happens before push is judged, and a job's status only crosses the wire when it *advances* past what the server has (searching < accepted < en_route < in_progress < done). Without the rank guard, a farmer reopening his phone an hour after the captain finished would push his stale "accepted" over the recorded "completed". The record of what happened must not be destroyable by a refresh.
- **A field insert carries no acreage.** This is guarantee 1 cashed in: the phone sends the boundary only, the trigger derives area and centroid, and the phone adopts the server's number as its own on the merge. The area a job snapshots is therefore the server's area, on both phones.
- **A captain the phone cannot place is not on the market.** `captains.base_location` is NOT NULL, so his row cannot exist until GPS has produced a point — going online takes a one-shot fix (8 s budget, best effort, no error screen). Honest state, corrected by the next toggle.
- **Catalogue drift cannot delete a captain's registry.** Machines and rates push as a replace-set; if even one local code has no server id (an app and a database out of step), the whole replace is abandoned rather than silently dropping the row it could not name.
- **Offline is still the first-class case.** Every stage of sync returns its input unchanged when there is no session or no signal; the ⟳ on a field card is the honest state of "saved here, not yet there", and the next activation retries. The on-device dispatch simulation remains for the not-signed-in yard demo.

**Four bugs of mine, caught by reading before CI had to:** a 60 km-tall test polygon (dropped zero: 0.5442° for 0.0005442°), a planned assertion count that did not match the written one, four fixture users with no phone number, and the PostgREST embed key (`field:fields(name)` returns as `field`, not `fields` — wrong key, silently empty field names).

**Verified:** 167 unit tests (45 of them new) and the workspace typecheck green locally; the Android bundle still exports. The 12 migrations and all 67 database assertions run in CI on push, where Docker exists — same as every schema change before this one.

**Not done:** sync has never run against a *hosted* Supabase project — there is no project yet, only a schema. Wiring `app.json`'s `extra` to a real project and trying two phones is the next physical step, and it needs the thing that has been missing all along: the app on real hardware. Push notifications still wait on the edge function.

---

## 23 · The map of the code

**Asked:** work phase by phase, but first make the architecture understandable — which folder is the backend, which is the frontend — so the founder can read the repository too.

**Built:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — the folder-by-folder tour. Three lands (phone app, shared packages, database), every file in `apps/mobile/src` in one table, all five packages with the rule each one carries, the eleven migrations in order, a today-vs-April table of what talks to what, a **"where new code goes" lookup table**, and the commands.

**Decisions:**
- **Written for the founder, not for a reviewer.** Every folder is justified by what it protects, not by convention.
- Says the confusing part out loud, in bold: **today the backend is a database, not a server we wrote.** There is no `server/` folder, business rules live in SQL functions, and `supabase/functions/` sits empty waiting for dispatch. Someone opening this repo cold would look for the API code for an hour.
- The mobile models' mirror-image relationship to the tables (`profile.ts` ↔ `profiles`, `jobs.ts` ↔ `jobs`, `SavedField.synced` already waiting) is stated explicitly, because it is the contract Phase 2.5 will cash in.
- The layout section in TECH_ARCHITECTURE was a *plan* — it listed `apps/admin`, `packages/types`, `packages/shared`, none of which exist. Replaced with the real tree, planned pieces marked as planned, and pointed at the new doc.
- README's code section still said three packages and no backend; it now lists all five plus `supabase/`, and ARCHITECTURE joined the document index.

**Verified:** docs-only change, no code touched. The 139 unit tests were green before it.

**Not done:** no entry for `apps/admin` exists yet, deliberately — the doc describes what is, and marks what is planned.

---

## 22 · Phase 2.4 — sign in with a phone number

**Asked:** build the next phase.

**Why this one.** Phases 3–5 were built local-only, which means two captains on two phones cannot see each other — a single-device simulation rather than a marketplace. With the schema now verified, identity is the step that changes that, and it was skipped when Docker blocked Phase 2.

**Built:** phone number, one code, no password. Supabase client with sessions in AsyncStorage, an auth module that returns outcomes rather than throwing, and a sign-in screen.

**Decisions:**
- **Fixed OTP codes for development and CI.** The whole login flow is testable with no SMS provider at all. India requires DLT registration with TRAI before real SMS can be sent and that takes weeks — this exists so the paperwork does not block the app. Swapping in MSG91 later is config, not code.
- **Sessions persist.** Being logged out in a field mid-harvest would be unforgivable, and there is no password to type back in even if he wanted to.
- **Token refresh follows app state, not a timer.** The default keeps the phone awake to renew tokens; across ten hours in a pocket that costs battery and buys nothing.
- **Signing in is skippable.** Measuring a field works fully offline with no account. A captain in a yard with no signal should be able to see what the app does before committing to one.
- **Phone numbers are normalised** — ten digits, a leading zero, or +91 all mean the same person and must not create three accounts.
- Every auth function returns a typed outcome rather than throwing. A captain on one bar of signal will hit every failure mode, and each needs advice he can act on.

**CI now asserts phone auth stays enabled.** It is the only way in — no email column, no password — so a config change that quietly disabled it would lock out every user, and nothing else in the suite would notice.

**Verified:** all three CI jobs green. 139 unit tests, 49 database assertions, 824 modules bundling.

**Not done:** nothing syncs yet. Profiles, fields and jobs still live only on the device. That is 2.5, and it is the last thing between here and a working marketplace.

---

## 21 · CI, and the schema finally runs

**Asked:** set up CI.

**Built:** three GitHub Actions jobs — unit tests and typecheck, an Android bundle export, and **the database**.

**The database job is why this mattered.** The migrations had never run anywhere: Docker Desktop will not start its WSL backend on the founder's machine, so for two sessions the schema was written, committed, and marked UNVERIFIED. GitHub's runners have Docker. CI is where it finally executed — and it will keep executing on every push, which is better than a one-off local check would have been.

**It found two real bugs in twenty minutes, both fatal.**

1. **Every accept was broken.** `accept_job` set `job_dispatch.response` from a CASE expression yielding `text`, and Postgres will not implicitly cast text into an enum in an UPDATE. Error 42804 on every call — meaning no captain could ever have taken a job. The function reads perfectly well.

2. **The losing captain was told he was never asked.** The guard checked for a *pending* dispatch row, but the winning accept marks every other pending row `timed_out`. So the second captain — legitimately offered the job, answered in seconds — got "this job was not offered to you". Wrong, and insulting to someone who was quick.

**Three test bugs of mine as well:** a miscounted plan (31 assertions declared as 28), a `tests` schema the `authenticated` role had no rights on, and an assertion that expected the self-verification policy to silently drop the row when it actually raises — which is the better behaviour, so the test moved rather than the policy.

**Added while fixing that:** an assertion that a captain **can** still take himself offline. The same policy governs both, and one that blocked his availability toggle would break the product every morning while looking like good security.

**Now verified, not asserted:**
- 11 migrations apply cleanly from zero
- The Fazilka catalogue loads, Gurmukhi and Devanagari intact
- SQL and TypeScript agree exactly on the size of a killa
- A client cannot set its own acreage
- A farmer's field boundary is invisible to strangers
- Two captains contesting a job produce exactly one winner

**Also:** pgTAP is enabled in the CI step rather than in a migration — a test framework has no business in the production database. Line endings normalised, which were warning on every commit.

---

## 20 · On GitHub

**Asked:** push it to GitHub.

**Done:** [rahulbishnoi2929/zamindara](https://github.com/rahulbishnoi2929/zamindara), **private**, 13 commits, 121 files, default branch renamed `master` → `main`.

**Checked before pushing, not after:**
- No `.env`, keystore, or PEM tracked
- The Google Maps key is still the placeholder, not a live key
- `supabase/config.toml` carries only `env()` references and defaults
- `android/`, `node_modules/` and `temp/` (a 702 MB tutorial video) all correctly excluded — the whole repo is 2.1 MB

**Private on purpose.** The docs are the entire playbook: the PRD, the competitive analysis, the pricing strategy, the Fazilka launch plan, and the migrant-combine wedge nobody else is serving. Public would hand a competitor the strategy *and* the kill criteria. It can be flipped public any time; what has been indexed or forked cannot be recalled.

---

## 19 · Phase 5 — the queue, the ping, and finishing a job

**Asked:** build the next phase.

**5.1 — `packages/scheduling`, 19 tests.** A combine serves eight fields back to back, so a captain has a *queue*, not one job at a time. The farmer's real question is never "is a machine coming" but "when does it reach me" — and that is a promise made to someone whose crop is on the ground, so it gets tests before it gets a screen.

Work past knocking-off time **rolls to the next morning** rather than being quietly promised for tonight. A farmer told 8pm who sees nobody arrive stops believing the app.

Time-priced work (levelling, earthwork) has no knowable duration, so it books a half day rather than being treated as instant — otherwise the next farmer is told his combine arrives in twenty minutes.

**5.2 — the job ping.** Its own Android channel at **maximum importance**, a long insistent vibration pattern, `bypassDnd`, and accept/decline reachable from the lock screen without opening the app. The channel is created before the first ping, because Android fixes a channel's importance at creation and ignores later changes — get it wrong once and every captain on that install has a quiet ping until he reinstalls.

Nothing rings outside declared working hours. A captain woken at midnight for work he was never going to take turns notifications off, and then misses the ones that mattered.

**5.3 — completion.** Amount and payment mode, prefilled from his own rate and the field's area so the common case is one tap. v1 takes no commission, so no money moves through the app — but what was *agreed* is recorded, because that is the number a dispute turns on and a season of them is what makes rate guidance honest.

**Decisions:**
- ETA shows **"around 14:30", never an exact time.** Travel between fields is left at zero until the backend supplies real distances; work duration dominates, and inventing distances would make the promise worse rather than better.
- Queue order is the captain's own, with a suggested nearest-first ordering he can override. Greedy nearest-neighbour, not anything cleverer — at eight stops the difference is minutes, and he knows the roads.
- The ping is local until there is a server to push from. The *presentation* is the real thing, so what a captain sees and feels now is what he sees in April.

**Verified:** 139 tests green, typecheck clean across six packages, Metro bundles at 772 modules.

**Honest gap:** Expo does not expose Android's full-screen intent, so the ping is a maximum-importance heads-up notification rather than a true incoming-call takeover. Whether that is loud enough over a running combine is a **device test in April's conditions**, not something answerable here. A custom sound file would also help and none exists yet.

---

## 18 · Phase 4 — jobs and dispatch

**Asked:** build the next phase.

**Built in three steps, money first.**

**4.1 — `packages/pricing`, 20 tests.** The price math, written and tested before any screen touched it. Duplicated from `quote_job` in SQL on purpose: the database prices authoritatively, but the app has to show a farmer a figure *before* he commits, and showing one number then billing another ends a business in a village. The tests assert both halves round identically, including the worked example from `PRICING.md` — so the docs cannot quietly drift from the code.

**4.2 — job posting.** Field → work → when → review. Field first, and it is the shortest step because his fields are already measured; every booking after the first is two taps. The service grid reorders by month, so April opens on harvesting and November on sowing.

**4.3 — the captain side.** An incoming request is the loudest thing on his screen: what work, how big, where, when, and nothing else. Accept, then on-my-way → start → complete.

**Decisions:**
- **Rate guidance is a range from jobs actually completed nearby, or nothing at all.** With no history the app says "the captain will quote you" rather than inventing a typical rate. Below three data points, a "typical rate" is one man's opinion dressed up as data.
- The word **approximate** is on every estimate, always. Over-promising a price is how trust dies.
- Time-priced work (levelling, earthwork) returns **no total**, because it cannot be known before the job is done. Inventing one would be worse than admitting we do not have it.
- **The field boundary is not shown to a captain before he accepts** — matching the RLS policy in the backend. It is the farmer's land record.
- `acceptJob` keeps the same shape as the SQL function: the status check is the guard. On one device the race is not real, but the swap to the server stays a swap.
- Job area is snapshotted at booking, as in the schema.

**Verified:** 120 tests green, typecheck clean across five packages, Metro bundles at 707 modules.

**What this unlocks:** the whole loop now runs on one phone with no server — measure a field, post a job, accept it as a captain, work it to completion. That is a demo you can put in front of a captain in his yard months before there is a backend.

**Still simulated:** dispatch is local, so there is no ranking, no radius filter and no push notification. Those need the server.

---

## 17 · Phase 3 — captain onboarding and the machine registry

**Asked:** stop waiting on the field-test data and start making the app.

**Right call.** The data gate blocks *trusting the measurement*, not building the product around it. That makes Phase 3 next — the phase the business actually depends on, since captains are the side you seed first. It needs no backend, so it is unblocked by Docker too.

**Built:**

- **`packages/catalog`** — 21 machine types and 14 services, named in Gurmukhi, Devanagari and English. **18 tests.**
- **`supabase/seed.sql` is now generated from it** (`npm run gen:seed`). The database and the app can no longer disagree about what a Happy Seeder is.
- **Onboarding flow** — language, role, name and village, then machines and rates. A farmer skips the last two; "I do both" does not.
- **Machine registry** — a grid of glyphs and local names, never a dropdown of English words. Records **owned or arrangeable**, with lead time, plus Balwinder's "I go with the machine" constraint.
- **Rates derived from machinery.** Register a combine, get offered wheat and paddy harvesting. He never says it twice.
- **Home reshaped by role** — a captain opens to his availability toggle and his machines; a farmer to his fields.

**Decisions:**
- The catalogue is one source of truth in TypeScript, and the SQL seed is derived. Two hand-maintained lists would drift, which is the same class of bug as `sqm_per_unit` and was worth solving the same way.
- Removing a machine drops the rates for work it enabled, so a price can never be quoted for something he cannot do.
- Emoji glyphs are placeholders. The flows call for photographs of the actual machines, and a farmer choosing between captains chooses the one whose machine he can see.
- Village is free text for now, flagged in code. It needs a searchable list of Fazilka villages or it will collect five spellings of the same place.

**Verified:** 100 tests green, typecheck clean across four packages, Metro bundles at 702 modules.

**Not done:** no phone auth, nothing syncs to Postgres — both wait on the backend. Local storage sits behind a model that mirrors the schema, so wiring Supabase is a change of storage rather than a rewrite.

---

## 16 · Phase 2.1 — backend schema (written, not yet verified)

**Asked:** design and build the backend; then, after a correction, go phase by phase rather than all at once.

**Pushed back on one thing:** the brief said "scale to millions of users". That is the wrong target and would actively hurt — the plan is 50 captains and 400 farmers in one district by April. Postgres and PostGIS serve a million users on a $25/month box for this workload. Built for correctness and safety, not premature distributed systems.

**Written — 11 migrations, seed data, two test suites:**

- Regions with region-scoped unit sets, so adding a bigha/biswa district is a row insert
- Profiles and captains — phone is the identity, no email and no password anywhere
- Machinery with the **owned / arrangeable** split enforced in the dispatch query, not the app
- Fields, with area and centroid **derived server-side** from the geometry
- Jobs, dispatch, an append-only audit trail, two-way ratings
- `eligible_captains`, `quote_job`, `rate_guidance`, `accept_job`
- RLS on all twelve tables
- Fazilka catalogue: 21 machine types, 14 services — straw reaper and orchard sprayer included, because both are real second markets here

**Decisions:**
- Business logic lives in the database because it decides who gets work and what a farmer pays. A client cannot be trusted with either.
- `accept_job` handles the race with a status predicate inside the UPDATE. Two captains tapping accept in the same second yield exactly one winner.
- Land constants are duplicated in SQL (`sqm_per_unit`) and asserted equal to `packages/units` by test, because a silent divergence would misprice jobs.
- Job area is **snapshotted** at booking. Re-measuring a field next season must not move historical prices.

**⚠️ Status: unverified.** None of this has run against a database. Docker Desktop will not start its WSL backend — the UI reports "already running" while the `docker-desktop` distro sits Stopped, which needs attention in the Docker UI. **Nothing here should be trusted until `supabase test db` passes.**

**Three guarantees the tests exist to prove:** a client cannot set its own acreage; farmer A cannot read farmer B's boundary; two captains contesting a job produce one winner.

---

## 15 · An APK you can actually install

**Asked:** continue.

**Context:** Phase 1 is physical work, but the app could not get onto a phone — which is what was actually blocking it. Checked the toolchain and found **Java 17, the Android SDK** (platforms 36/36.1, build-tools to 37, NDK 27) and **adb** already installed, so an APK was buildable here.

**Built:** `expo prebuild` for Android, then a **release APK** — `app-release.apk`, 70 MB, `com.zamindara.app`, targetSdk 36, all four ABIs, JS bundle embedded. Verified with `aapt2 dump badging` and by listing the archive.

**Three things this caught that nothing else had:**

1. **The app icon config was wrong.** `app.json` referenced `adaptive-icon.png`; the SDK 57 template ships `android-icon-foreground/background/monochrome.png`. Prebuild failed outright. Only a native build surfaces this — typecheck and `expo export` both passed happily.

2. **A debug APK is useless in a field.** `assembleDebug` does not embed the JavaScript bundle; it expects Metro on the laptop and shows an error screen without it. That failure would have been discovered *after* driving to a plot. `assembleRelease` bundles the JS and runs standalone. Documented with a warning in the app README.

3. **A missing Maps key failed silently.** `react-native-maps` renders a blank grey rectangle and says nothing. Added `mapsKey.ts` and `MapKeyWarning.tsx` — both map screens now detect the placeholder key and explain the fix on screen, noting that walking still works without one.

**Decisions:**
- `android/` and `ios/` are gitignored. They are generated by `expo prebuild`; hand edits are destroyed by the next run.
- Release is signed with the **debug keystore**, which the RN template configures by default. Fine for sideloading and the field test; a real keystore is needed before the Play Store, and an app signed with the debug key cannot be published or updated.
- Left the APK at 70 MB rather than splitting per ABI. Cutting it to ~25 MB (arm64-only) needs `expo-build-properties` to survive prebuild, which is complexity worth spending only if the file ever needs sending over WhatsApp.

**Verified:** 82 tests green, typecheck clean, `BUILD SUCCESSFUL in 14m`, JS bundle confirmed inside the archive at `assets/index.android.bundle`.

**APK:** `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

---

## 14 · Build log

**Asked:** maintain a file recording what we build and how, updated every prompt.

**Built:** this file. Newest-first entries, a current-state summary, and a reversals table collecting every decision that was overturned.

**Decision:** reversals get their own table at the top. They are the highest-value thing to re-read — each one is a mistake caught before it cost a season, and the pattern in them is worth seeing.

---

## 13 · Field test recorder

**Asked:** build the field test recorder.

**Built:** `apps/mobile/src/fieldTest/` — the tool for the Phase 1 gate.

- **Per plot:** tape reading as two sides in **m / ft / karam**, and jamabandi typed the way it reads on the paper ("4 killa 2 kanal"), parsed by `@zamindara/units`
- **Per measurement, captured automatically:** area, signed error vs tape, mean GPS accuracy, walk duration, fixes accepted/rejected, pipeline path, and **whether corners were dragged**
- **Summary:** accuracy by method, accuracy by plot size against a size-dependent bar, repeatability, median jamabandi gap, and a pass/fail gate card listing what is missing
- **CSV export** — wide and flat, one row per measurement, unmeasured plots included so a gap in the sample is visible

**Decisions:**
- The recorder drives **the same capture screens the app ships**, not a copy. A test exercising different code proves nothing.
- `cornersAdjusted` is captured automatically, because it separates accuracy coming from the algorithm from accuracy coming from the farmer's eyes.
- English, dense, and behind a small link — this is the founder's tool, and it comes out once Phase 1 clears.
- `stats.ts` and `csvBuilder.ts` were split to be pure and testable. They decide whether the project proceeds, so they are tested before trusted.

**Verified:** 17 new tests, typecheck clean, bundles at 694 modules.

**Commit:** `0eee3c6`

---

## 12 · Tech stack decision register

**Asked:** a tech stack file — what we use, where, and why.

**Built:** [docs/TECH_STACK.md](docs/TECH_STACK.md). Every technology with its alternatives, a cost table, a lock-in table with exit paths, and the five constraints that decided everything.

**Decisions:**
- Kept separate from `TECH_ARCHITECTURE.md` — that covers *how the pieces fit*, this covers *why they are the pieces*
- Recorded the MongoDB correction (reversal #2) rather than quietly leaving the wrong reason in place
- Added the lock-in table because for a solo founder before a fixed deadline, "can I leave?" matters as much as any feature comparison

**Flagged:** DLT registration with TRAI takes weeks and blocks phone OTP entirely. Most likely schedule surprise in the plan.

**Commit:** `0891e57`

---

## 11 · Draw the field on satellite

**Asked:** farmers should be able to draw their field on the map.

**Built:** `DrawScreen` — satellite map centred by GPS on where the farmer stands, tap to place numbered draggable corners, live area from the third corner, labels toggle for orientation. Plus `ChooseMethodScreen`. **Made the default** (reversal #4).

**Decisions:**
- Drawing leads because georeferencing offset shifts an outline without changing its **area**, and because he can *see* whether it is right — a walked track gives him a number he cannot judge
- **No confirmation screen after drawing.** He traced it on the imagery and watched the area throughout; showing the same picture again is friction, not a safeguard. Walking keeps its confirmation step for exactly the opposite reason.
- Map centred on his GPS position, which removes the hardest part of the task: finding your own field on a satellite map

**Open, honestly:** this is reasoning, not measurement. Phase 1 now tests **both methods against the same tape on the same plots** and decides on data. Also: drawing needs a connection for map tiles, where walking works in full airplane mode. Unresolved — Phase 1 measures how often signal is actually absent first.

**Commit:** `cbca81c`

---

## 10 · Ground truth is a tape

**Asked:** "why would we need jamabandi"

**Changed:** Phase 1 now grades the app against a **50 m fibreglass tape** (~0.2% error, against a 2% target), on rectangular canal-colony plots. Jamabandi is recorded as a separate, non-gating column.

**Decisions:**
- Two questions had been conflated: *is the app accurate* (tape) and *will the farmer accept the number* (jamabandi). Only the first is a test of the code.
- The gap between tape and paper is kept because it is its own finding — if walked areas come in consistently below the records, every farmer meets our number already convinced it is wrong. That is a launch problem, better found in August than April.

**Commit:** `69c5027`

---

## 9 · Phase-by-phase build plan

**Asked:** a phase-wise document of what we build, test, and do.

**Built:** [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) — eleven phases from August 2026 to the April 2027 wheat harvest, each with *build / test / do / gate*.

**Decisions:**
- Two phases are **gates that can stop the project**: Phase 1 (measurement vs tape) and Phase 6 (soft launch — fewer than 30 captains signing up face to face means the supply assumption is wrong). Written as explicit kill criteria now, rather than as things to rationalise away in February.
- Every phase includes work that is not code. Phase 8's most important line is *go to Sri Ganganagar and register 15 combine operators before the season starts.*
- Migrant mode is Phase 8, not Phase 4 — it needs a working marketplace underneath it, and it must be stable *before* the fleet moves north in March.
- Testing strategy is per-layer, because reaching for the wrong kind of proof gives false confidence. Anything touching GPS, push or battery needs a **real phone**; emulators lie about all three.

**Commit:** `cb1decb`

---

## 8 · Expo app — the walk

**Asked:** build the Expo screen.

**Built:** `apps/mobile` on Expo SDK 57. Home, walk and satellite-confirmation screens, Punjabi/Hindi/English, offline capture.

**Decisions:**
- **Refuses to start on a red GPS signal.** A walk begun on weak GPS produces a number nobody should bill against, and the farmer would not know.
- **Vibrates when he returns to the starting corner.** The phone is meant to be in his pocket; vibration is the only channel that reaches him there.
- **Every GPS point is checkpointed to storage.** Losing twenty minutes of walking would only ever happen to the farmer least able to tolerate it.
- **No geometry in the app** — it all comes from `@zamindara/geo`. The app owns the device: permissions, the location stream, persistence, screens.
- Metro configured to consume workspace packages as TypeScript source, rewriting their ESM `.js` import specifiers.

**Verified:** typecheck clean, bundles for Android, and confirmed the workspace packages genuinely made it into the bundle — including the Gurmukhi strings, which Hermes stores as UTF-16 (a first check using UTF-8 grep wrongly reported them missing).

**Commit:** `391d203`

---

## 7 · Units and geometry packages

**Asked:** start with the units package, then the boundary walk prototype.

**Built:**
- `packages/units` — killa/kanal/bigha/marla, compound display, Gurmukhi and Devanagari parsing. **41 tests.**
- `packages/geo` — filter → smooth → simplify → rectangle fit, plus a walk simulator. **24 tests**, including a statistical accuracy suite.
- Git initialised.

**Decisions:**
- Every unit is a whole number of marlas, so decomposition is integer arithmetic. This removes floating-point carry bugs from the most price-sensitive code in the project — 19.6 marla must render as "4 kanal", never "3 kanal 20 marla".
- Area is stored as square metres only, never as killa or bigha. *Bigha* means four different sizes in four states.
- Own geometry rather than turf.js: it sets prices, so it needed to be understood line by line and tested against known ground truth.

**Three findings that overturned the design** — reversals #1, #5, #6 above. All three surfaced only because the accuracy suite measures rather than assumes.

**The finding that changed the product:** accuracy is a property of the *plot*, not the app. Half a killa → 3.16% error; five killa → 0.54%. The 2% bar is unreachable on small plots from a single measurement. Cheapest fix, needing no new technology: **measure twice and average** — 3.16% → 2.31%.

**Also corrected:** the worked example across all docs. 9,714 m² is *2 killa 3 kanal 4 marla*, not 8 marla.

**Commit:** `e77a3a7`

---

## 6 · Documents, and clearing the decks

**Asked:** Fazilka as the beachhead; then "delete everything and continue with new file".

**Built:** ten product documents plus a README index.

**Removed:** `uber/` — an 80 MB MERN Uber-clone tutorial project. **Rescued `zamidara.jpg` first**, since the logo was the founder's own asset rather than tutorial code. Left `temp/` (a 702 MB tutorial video) untouched, since "delete the files" was about the codebase and re-downloading 700 MB on a guess would be careless.

**Decision:** Supabase over the existing Express/MongoDB scaffolding. The tutorial code was not an asset — it was followed, not written — and the frontend was a *web* app, which cannot do background GPS or lock-screen push regardless.

**Why Fazilka works:** it sits on the Rajasthan border next to Sri Ganganagar, so it is the gate migrant combines drive through heading north. Cotton–wheat belt, heavily mechanised, and the Abohar kinnow orchards give a second demand season in winter when everyone else is idle.

---

## 5 · The launch belt

**Asked:** Punjab, Haryana, Rajasthan.

**Flagged:** the unit set breaks in most of Rajasthan, which uses **bigha and biswa**, not kanal and marla — and its bigha has pucca (~2,529 m²) and kaccha (~1,618 m²) variants that differ **by district**. Assuming the wrong one overbills a farmer by a third, silently.

**Decided:** design tri-state, launch on the belt where the units already work — Punjab, Haryana, and **north Rajasthan** (Ganganagar, Hanumangarh), which were settled under the same canal-colony system and use killa/kanal/marla. Southern Rajasthan becomes a separate region row later, no schema change.

**Also noted:** the tri-state choice is strategically right, because the wheat harvest moves as a northbound wave — MP/Gujarat in March, Rajasthan late March, Haryana early April, Punjab mid-April. That is not three markets; it is one migration route.

---

## 4 · Unit set locked

**Asked:** drop murabba and sarsahi, keep kanal and marla.

**Locked:** marla (25.293 m²), kanal (20 marla), bigha (5 kanal), killa (8 kanal = 1 acre).

**Note:** dropping sarsahi was right for a reason beyond simplicity — at 2.8 m² it is *smaller than GPS error*, so displaying it would be false precision. Marla is the correct floor.

**Also:** bigha and killa are both top-level units and never stack, so there are two display chains and the farmer picks one.

---

## 3 · Local units

**Asked:** killa is 8 kanal, bigha is 5 kanal.

**Confirmed** against Punjab revenue standards — the bigha at 5 kanal is the *pucca* bigha, exactly 5/8 of a killa.

**Decision that came out of it — never show a decimal.** A jamabandi does not say "2.4 killa"; it says **2 killa 3 kanal 8 marla**. Showing a decimal shows a farmer a number he has never seen on a document. This became the core rule of `packages/units`.

---

## 2 · Founding decisions and the stack

**Asked:** captain first, GPS boundary, free at launch, cash and digital, surcharge beyond 5 km, solo founder — and which tech stack.

**Recommended:** TypeScript everywhere — Expo/React Native, Supabase (Postgres + PostGIS), Next.js admin. Android only.

**Reasoning:** the app is a geospatial app with a marketplace on top, and PostGIS answers every core question in one line. One language across mobile, backend, admin and database types is the highest-leverage choice available to one person.

**Also advised cutting from v1:** iOS, payments (nothing to collect while free), and a full offline sync engine.

**Flagged:** GPS is accurate to 3–8 m, which is 5–10% of a one-killa plot. This was the first statement of the risk that later drove all of `packages/geo`.

---

## 1 · The idea

**Asked:** understand the concept before building.

**Played back:** Uber, where the ride is farm work and the car is a machine. Farmer selects his field first, the app computes the area, he picks the job, nearby captains get the request. Captains declare machinery they **own or can arrange**. Farmers with idle machines are suppliers too. Migrant combines following the harvest north can go live in a new district.

**Identified where it is not Uber:** fare is per acre not per km; a job lasts hours or days; a combine serves eight fields back to back, so captains have a **queue**; booking is mostly scheduled; demand is brutally seasonal; trust is local and offline; connectivity is bad; money is cash.
