# Your pending work

Everything here needs your accounts, your phone, or your legs. I cannot do any of it.

Written 31 October 2026. **Five months to the April harvest. The sowing window is open now and has about three weeks left.**

## What actually costs money — and what only looks like it

| Thing | Cost now | Card needed? |
|---|---|---|
| **Supabase** | ₹0 | **No.** Free tier: 2 projects, 500 MB. |
| **GitHub** (private repo + CI) | ₹0 | No |
| **Expo** (we build locally) | ₹0 | No |
| **Google Maps** | ₹0 of usage | **Yes — a card, even for the free credit.** The only real paywall. |
| Play Store | $25, one-time | Not yet — you sideload the APK |
| SMS for real captains | real money + a company | Not until captains sign in. Phase 6. |
| 50 m tape | ₹500–1,000 | Borrowable — see below |

**So the only thing standing between you and Phase 1 is a measuring tape.**

### Phase 1 runs on zero rupees

I checked the code rather than assuming. **The walk path touches no map at all** — it is pure GPS. And on the confirmation screen the area readout and the Confirm button sit outside the map area, so they still work when the map cannot load.

That means, today, with no keys and no card:

- measure a field by **walking** it ✅
- see the area in killa, kanal, marla ✅
- confirm and save it ✅
- record it in the field-test tool against your tape ✅
- **drawing on satellite** ❌ — this is the only thing the Maps key blocks

**And walking-only is arguably the better experiment.** Phase 1 is asking one question: does the algorithm's area match a tape? Dragging corners on satellite is a *correction* step — useful in the product, but it contaminates a measurement of the algorithm. Testing the walk alone gives you a cleaner answer.

What you defer: the draw-versus-walk comparison that decides the default method. That waits until a Maps key exists. It is a real question, not an urgent one.

### If you cannot get a tape

- Borrow one. Masons and tubewell fitters have 30 m tapes; so do many farmers.
- A 30 m tape measured twice along a 60 m side is fine — note it in the plot notes.
- **Do not** substitute pacing or a rope of guessed length. The whole point is a reference better than what you are testing; a guessed reference proves nothing.

### On the Google card, when you get there

You are right to hesitate. The free credit is real and your volume is tiny — a farmer maps each field once, forever — but a key left unrestricted can be scraped and burn the credit on someone else's traffic. So when you do add it:

1. Restrict the key to `com.zamindara.app` + the SHA-1 below **before** using it anywhere
2. Set a budget alert at ₹500 in Cloud Billing
3. Cap the daily quota on the Maps SDK

Restricted properly, an Android-only key is safe to ship inside an APK — Google designed it for that.

---

Work top to bottom — each step unblocks the next.

---

## 1 · Google Maps key — 15 minutes · ⏸ **defer this if money is tight**

Without this, **drawing a field does not work at all.** Drawing is the primary capture method, so this is not optional.

1. Open [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project. Call it `zamindara`.
3. Left menu → **APIs & Services** → **Library** → search **Maps SDK for Android** → **Enable**
4. Left menu → **APIs & Services** → **Credentials** → **Create credentials** → **API key**
5. Copy the key
6. **Restrict it** — click the key → *Application restrictions* → **Android apps** → Add:
   - Package name: `com.zamindara.app`
   - SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

That is the current debug keystore's fingerprint — I read it off your machine. If a clean prebuild ever regenerates the keystore, read the new one with:

```bash
keytool -list -v -keystore frontend/android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA1
```

You will need a **different** SHA-1 when you create a real release keystore for the Play Store. Add both to the key then.

Then paste the key into `frontend/.env`:

```
GOOGLE_MAPS_API_KEY=AIza...
```

**Billing:** Google asks for a card. At your volume — a farmer maps each field once, forever — you stay inside the free monthly credit. Set a budget alert at ₹500 anyway.

**Done when:** `frontend/.env` has the key and the file is **not** committed (it's gitignored — confirm with `git status`).

---

## 2 · Supabase project — 20 minutes · free, no card

Without this the app runs offline-only: measuring and the on-device job loop work, but **two phones cannot see each other.** No marketplace.

1. [supabase.com](https://supabase.com) → sign in with GitHub → **New project**
2. Name `zamindara`, region **Mumbai (ap-south-1)** — closest to Punjab, and latency matters on a 2G connection in a field
3. Set a database password. **Save it in a password manager.** You need it once, in step 4, and there is no recovery.
4. Wait for provisioning (~2 minutes)

Then point it at the schema CI already verifies:

```bash
cd backend && npx supabase link --project-ref YOUR_PROJECT_REF
```

```bash
cd backend && npx supabase db push
```

```bash
cd backend && npx supabase db execute --file supabase/seed.sql
```

The project ref is in your project URL: `supabase.com/dashboard/project/`**`<ref>`**.

Finally, **Settings → API**, and put these in `frontend/.env`:

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

> The anon key is safe in a client app — row-level security is what protects the data, and CI proves those policies hold on every commit. The **service role** key is the dangerous one. Never put it in the app.

**Done when:** the Supabase dashboard → Table Editor shows `machine_types` with 21 rows and Gurmukhi names.

### Make yourself staff — one row, or no captain can ever work

Until your phone number is in the `admins` table, nothing can verify a
captain. A captain who is not verified is **invisible to farmers and will
never be offered a job** — he defaults to `pending`, every dispatch query
requires `verified`, and he is correctly forbidden from promoting himself.

In the Supabase dashboard → **SQL Editor**, once:

```sql
insert into public.admins (phone, note)
values ('9876543210', 'founder');   -- your 10-digit number, no +91
```

Then sign in on the app. A **Verify captains** link appears at the bottom of
the home screen — visible only to staff, and the real guard is in the
database, not the UI. Tap Verify while you are standing next to his machine.

A captain with **no machine registered** cannot be verified: there is nothing
to match him to, so the button stays disabled until he adds one.

### Push notifications — one free signup, then one deploy

Without this the job ping is local only: a captain on a second phone finds
out about work by **opening the app**, which is the opposite of the promise.

**a. An Expo project id** — free, no card:

```bash
cd frontend && npx eas init
```

Creates a free Expo account if you have none and writes the project id into
`app.json`. Nothing else about EAS is used — builds stay local.

**b. Deploy the function:**

```bash
cd backend && npx supabase functions deploy notify-dispatch
```

It reads the service key from Supabase's own environment; nothing to
configure and no secret to store.

**Done when:** post a job on one phone and a second phone rings without
being opened.

> Until (a) is done the app simply does not register a device and keeps
> working — a setup gap, not an error. Until (b) is deployed no push is sent.

### One thing to check afterwards

Phone sign-in needs real SMS, which India gates behind **DLT registration with TRAI**. That takes weeks.

- For now: Authentication → Providers → Phone → add your own number under **test OTP** with a fixed code, so you can sign in during the field test.
- Start the DLT paperwork this week regardless. It blocks every real captain from logging in, and it is the longest lead time in the whole plan.

---

## 3 · Get the app on your phone — 10 minutes

The APK is already built and standalone — no laptop needed once installed.

```
frontend/android/app/build/outputs/apk/release/app-release.apk
```

72 MB · `com.zamindara.app` · all four CPU types · JS bundled in.

**But it was built before your keys existed**, so rebuild after steps 1 and 2:

```bash
cd frontend && npx expo prebuild --platform android --clean
```

```bash
cd frontend/android && ./gradlew assembleRelease
```

Then, with USB debugging on:

```bash
adb install -r frontend/android/app/build/outputs/apk/release/app-release.apk
```

Or copy the APK to the phone and tap it — Android will ask about unknown sources.

**Done when:** the app opens, you sign in with your test OTP, and the draw screen shows **satellite imagery** rather than the "map cannot load" card.

> Use a **cheap phone** if you have one. The app is built for 2 GB RAM and sunlight. Testing on a good phone tells you nothing about what a captain will see.

---

## 4 · A 50 m fibreglass measuring tape — ₹500–1,000 · ⭐ **do this first**

Any hardware shop. **Fibreglass, not steel** — steel kinks and a kinked tape reads short.

Not a surveyor's wheel. A wheel drifts to about 1%, which is too close to the 2% you are trying to measure to settle any argument. A tape is 0.2%.

**Done when:** it is in your bike.

---

## 5 · Phase 1 — the field test · 2–3 days

**This is the gate.** Nothing else in the plan is worth anything if the area is wrong, and the whole app has been built past this point on an unproven measurement.

### What to take

- Phone with the app, charged
- The tape
- A second person for the tape (two ends)
- A notebook as backup — the app records everything, but belt and braces on day one

### Per plot

1. **Tape two sides.** Canal-colony plots are rectangles, so length × width is the whole job. Enter both in the app: *Field test → Add plot → Side A, Side B*.
2. **Measure it by walking** — pace the boundary. Needs no map, no key, no money.
3. **Measure it by drawing** — only if you have a Maps key. Skip it otherwise; it is deferred, not lost.
4. Each lands under the same plot, and the app computes the error against your tape.

### The sample — this matters

| Need | Count | Why |
|---|---|---|
| Plots **under 1 killa** | at least 5 | Simulation says small plots are where accuracy fails |
| Plots **over 2 killa** | at least 5 | Where it should comfortably pass |
| Repeats (same plot, twice, both ways) | 5 plots | Repeatability, not just accuracy |
| **Total** | **20** | Fewer and the result is noise |

### The bar

| Check | Pass |
|---|---|
| Plots ≥ 2 killa | within **2%** |
| Plots < 2 killa | within **4%** |
| Two measurements of one plot | agree within **3%** |

The app shows a **gate card** — pass or fail, and exactly what is still missing. Export the CSV and send it to me.

### Also note while you are out there

- **How often satellite imagery was unusable** — too old, too cloudy, field not identifiable. Note it even without a key, just by looking: it decides how much drawing would actually buy you.
- **Which method won** — only once a Maps key exists. Drawing is the default on *reasoning alone*, and reasoning has already been wrong twice in this project. Until then the question stays open and that is fine.
- **The jamabandi gap.** Pull the records where it is easy. Not as truth — as the number the farmer already believes. If walked areas come in consistently below the paper, every farmer meets your number already convinced it is cheating him, and that needs an answer before launch.
- **Battery** over a 20-minute walk with the screen off.
- **Airplane mode** through one whole walk. It must survive and recover.
- **Watch someone who is not you use it. Do not help.** Where they hesitate is the design brief.

**Done when:** 20 plots recorded and the gate card is green.

---

## 6 · Then, and only then — captains

The sowing window has about three weeks left. The revised target is **10–15 captains and 5–10 real jobs by end November** — cut down from 50 and 40, because fifty captains in three weeks from a standing start is a wish, not a plan.

- Start with combine and laser-leveller owners within 25 km
- **Photograph every machine yourself.** The registry quality is an asset only you can create.
- CHC operators first — pre-verified, and already frustrated by low utilisation
- **Kill criterion:** if fewer than 30 of the captains you ask face to face will register, the supply assumption is wrong. Stop and tell me before any more code gets written.

---

## What is already done, so you don't redo it

| | |
|---|---|
| Code | Phases 0, 2, 3, 4, 5 — measurement, onboarding, machinery, jobs, dispatch, queue, the ping, sync |
| Tests | 177 unit + 68 database assertions, green in CI on every push |
| Schema | 12 migrations verified by CI, including that a client cannot set its own acreage |
| Repo | Private on GitHub, CI on every push |
| APK | Built and standalone — rebuild after your keys land |

## The honest risk

The code is ahead of schedule. **The field work is two months behind, and it is the half that cannot be compressed.** Software can be written in a week; trust with fifty captains cannot.

Steps 1–4 are a single day of errands. Step 5 is the one that decides whether any of the rest was worth building.
