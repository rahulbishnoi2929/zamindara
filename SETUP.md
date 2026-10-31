# Your work

Everything here needs your accounts, your phone, or your legs. I cannot do any of it.

**31 October 2026. Five months to the April harvest.**

---

## The checklist

| # | Do | Cost | Blocks |
|---|---|---|---|
| **0** | **Start DLT registration with TRAI** | paperwork | Real captains signing in. Longest lead time in the plan — start today and forget it. |
| **1** | Get a reference — marked field, Google Earth, or a tape | **₹0 possible** | The gate |
| **2** | Put the app on a phone | ₹0 | The gate |
| **3** | **Field test — 3 plots, then 20** | ₹0 | 🚦 **Everything.** |
| **4** | Create a Supabase project | ₹0, no card | Two phones seeing each other |
| **5** | Add your phone to `admins` — one SQL row | ₹0 | **Any captain ever getting work** |
| **6** | `eas init` + deploy the push function | ₹0 | A captain hearing about work without opening the app |
| **7** | Google Maps key | needs a card | Drawing a field. Walking works without it. |
| **8** | Onboard 10–15 captains | your legs | November |

**1–3 cost nothing and are the only things that matter this week.** Everything from 4 onward is for when captains exist.

---

## 0 · DLT registration — start today, then forget it

Indian law routes transactional SMS through DLT registration with TRAI. Until it is done, **no real captain can receive a login code.** It takes weeks and nothing else depends on you finishing it, so it should run in the background while you do everything else.

It needs a registered business entity, which is itself on your open-items list.

You do not need it for the field test — step 4 sets up a fixed test code for your own number.

---

## 1 · A reference you trust — ₹0 is possible

You need something to check the app against that is clearly better than the
2% you are testing. A tape is the best of these, but it is not the only one.

| Reference | Cost | Accuracy | Catch |
|---|---|---|---|
| **50 m fibreglass tape** | ₹500–1,000, or borrowed | ~0.2% | The only one that can settle a 2% question |
| **A marked sports field** | ₹0 | exact, *if* regulation | Flat, open sky — kinder to GPS than a real field |
| **Google Earth Pro** | ₹0, no card | a few percent | Shares a source with the app's own draw method |
| Pacing, or a guessed rope | ₹0 | worse than what you are testing | Proves nothing |

### The free first test: walk a marked field

A **regulation hockey pitch is 91.4 × 55 m = 5,027 m²** — about 1.24 killa.
A **400 m running track**, a marked football pitch, a school ground: all
known sizes, all free, and you can do it today without leaving town.

Walk the perimeter with the app. If it reads 1.24 killa, the algorithm is
sound. If it reads 1.4, you have found a serious problem in an afternoon
without troubling a single farmer.

**The honest limit:** a sports field is flat with clear sky. A real field has
a tree line, a tubewell shed, and a bund you walk crooked. A pass there
proves the **algorithm**, not the **conditions**. So it is the first test, not
the last one.

### Free area check from your laptop: Google Earth Pro

Free, no card, no API key. Trace a field's outline, read the area off the
measure tool, and compare it to what the app says. Works from home, on any
field, for as many as you like.

**Its limit:** it is satellite-derived, same as the app's draw method. So it
can check **walking**, but it cannot referee walking against drawing.

### Borrow a tape once, keep the reference forever

Borrow a 30 m tape for an hour — masons and tubewell fitters have them, so do
many farmers — and mark a steel wire or chain at exactly 20 m. Rope stretches,
which is the whole reason fibreglass tapes exist; wire does not. You now have
a permanent reference for nothing.

### Enter whichever you used

The field test tool takes all of them: *Field test → Add plot →* pick where
the reference came from. A tape gives two sides; everything else takes the
area directly in square metres. The CSV records which, and the gate card
**says so** when a reference is not a tape — because a result measured against
Google Earth cannot honestly claim 2%.

**Do not** substitute pacing or a rope of unknown length. A reference worse
than the thing being tested proves nothing, and you will have spent the days
for no answer.

## 2 · The app on a phone — 10 minutes, ₹0

An APK is already built and standalone — no laptop needed once installed:

```
frontend/android/app/build/outputs/apk/release/app-release.apk
```

To rebuild after any change:

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

Or copy it to the phone and tap it — Android will ask about unknown sources.

> **Use a cheap phone if you have one.** The app is built for 2 GB RAM and for sunlight. Testing on a good phone tells you nothing about what a captain will see.

**Done when:** the app opens and you can start a boundary walk. No keys needed for that.

---

## 3 · The field test 🚦 — the only thing that matters this week

**This is the gate.** The whole app has been built past an unproven measurement. If the area is wrong, none of the rest was worth building — and you need to know that now, not in April.

### It costs nothing

The walk path touches **no map at all** — pure GPS. The area readout and Confirm button sit outside the map area, so they work even when tiles cannot load. So with no keys and no card you can already walk a field, see the area in killa/kanal/marla, save it, and record it against your tape.

Only **drawing on satellite** needs the Maps key. Skip it for now.

### Start with 3 plots, not 20

Three plots catch a catastrophic error. If the app reads 8% high, one carefully taped plot shows it. **Send me those three numbers before doing the other seventeen** — if something is badly wrong you will have spent an afternoon instead of three days.

Twenty is what characterises the error: how it varies with size, and whether it repeats.

### What to take

- Phone with the app, charged
- The tape, and a second person for the other end
- A notebook as backup on day one

### Per plot

1. **Record the reference.** A tape gives two sides — canal-colony plots are rectangles, so length × width is the whole job. A marked field or a Google Earth trace gives the area directly. Pick the source in the app so the result can be read honestly later.
2. **Measure it by walking.** No map, no key, no money.
3. *(Drawing comes later, once you have a Maps key. Deferred, not lost.)*

The app computes the error against your tape and shows a **gate card** — pass or fail, and exactly what is missing. Export the CSV and send it to me.

### The sample, once you go past three

| Need | Count | Why |
|---|---|---|
| Plots **under 1 killa** | at least 5 | Simulation says small plots are where accuracy fails |
| Plots **over 2 killa** | at least 5 | Where it should comfortably pass |
| Repeats of the same plot | 5 | Repeatability, not just accuracy |
| **Total** | **20** | Fewer and the result is noise |

### The bar

| Check | Pass |
|---|---|
| Plots ≥ 2 killa | within **2%** |
| Plots < 2 killa | within **4%** |
| Two measurements of one plot | agree within **3%** |

### Also note while you are out there

- **How often satellite imagery is unusable** — too old, too cloudy, field not identifiable. Just look; you need no key to judge it. It decides how much drawing would actually buy you.
- **The jamabandi gap.** Pull the records where it is easy. Not as truth — as the number the farmer already believes. If walked areas come in consistently below the paper, every farmer meets your number already convinced it is cheating him, and that needs an answer before launch.
- **Battery** over a 20-minute walk, screen off.
- **Airplane mode** through one whole walk. It must survive and recover.
- **Watch someone who is not you use it. Do not help.** Where they hesitate is the design brief.

---

## 4 · Supabase project — 20 minutes, free, no card

Without this the app is offline-only: measuring and the on-device job loop work, but **two phones cannot see each other.** No marketplace.

1. [supabase.com](https://supabase.com) → sign in with GitHub → **New project**
2. Name it `zamindara`, region **Mumbai (ap-south-1)** — closest to Punjab, and latency matters on a 2G connection in a field
3. Set a database password and **save it in a password manager.** You need it once, next step, and there is no recovery.

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

The project ref is in your dashboard URL: `supabase.com/dashboard/project/`**`<ref>`**.

Finally, **Settings → API**, into `frontend/.env`:

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

> The anon key is safe in a client app — row-level security protects the data, and CI proves those policies hold on every commit. The **service role** key is the dangerous one. Never put it in the app.

### Give yourself a login code

Real SMS waits on step 0. For now: **Authentication → Providers → Phone** → add your own number under **test OTP** with a fixed code. Enough to sign in and run everything.

**Done when:** Table Editor shows `machine_types` with 21 rows in Gurmukhi.

---

## 5 · Make yourself staff — one row, or no captain can ever work

Until your phone number is in `admins`, **nothing can verify a captain** — and an unverified captain is invisible to farmers and will never be offered a single job. He defaults to `pending`, every dispatch query requires `verified`, and he is correctly forbidden from promoting himself.

Supabase dashboard → **SQL Editor**, once:

```sql
insert into public.admins (phone, note)
values ('9876543210', 'founder');   -- your 10-digit number, no +91
```

Then sign in on the app. A **Verify captains** link appears at the bottom of the home screen — visible only to staff, with the real guard in the database. Tap Verify while standing next to his machine.

A captain with **no machine registered** cannot be verified: there is nothing to match him to, so the button stays disabled until he adds one.

---

## 6 · Push notifications — one free signup, one deploy

Without this the ping is local: a captain on a second phone finds out about work by **opening the app**, which is the opposite of the promise.

```bash
cd frontend && npx eas init
```

Free, no card. Creates an Expo account if you have none and writes a project id into `app.json`. Nothing else about EAS is used — builds stay local.

```bash
cd backend && npx supabase functions deploy notify-dispatch
```

Reads the service key from Supabase's own environment. Nothing to configure, no secret to store.

**Done when:** you post a job on one phone and a second phone rings without being opened.

> Until `eas init`, the app simply does not register a device and keeps working — a setup gap, not an error. Until the deploy, no push is sent.

---

## 7 · Google Maps key — when you can put a card down

**The only real paywall in the project.** Usage is ₹0 at your volume — a farmer maps each field once, forever — but Google requires a card on file even for the free credit.

Defer it. Walking works without it, and the field test is cleaner without it anyway.

When you do:

1. [console.cloud.google.com](https://console.cloud.google.com) → new project `zamindara`
2. **APIs & Services → Library** → **Maps SDK for Android** → Enable
3. **Credentials → Create credentials → API key**
4. **Restrict it before using it anywhere** — *Application restrictions → Android apps*:
   - Package: `com.zamindara.app`
   - SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
5. Budget alert at ₹500, and cap the daily Maps SDK quota
6. Into `frontend/.env`:

```
GOOGLE_MAPS_API_KEY=AIza...
```

An unrestricted key can be scraped and burn the credit on someone else's traffic. Restricted properly, an Android-only key is safe inside an APK — Google designed it for that.

If a clean prebuild ever regenerates the debug keystore, read the new fingerprint with:

```bash
keytool -list -v -keystore frontend/android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA1
```

A real release keystore for the Play Store will have a **different** SHA-1. Add both to the key then.

---

## 8 · Captains — November

Target: **10–15 captains and 5–10 real jobs by end November.** Cut from 50 and 40, because fifty captains in three weeks from a standing start is a wish, not a plan.

- Combine and laser-leveller owners within 25 km first
- **Photograph every machine yourself.** The registry quality is an asset only you can create.
- CHC operators first — pre-verified, and already frustrated by low utilisation
- **Kill criterion:** if fewer than 30 of the captains you ask face to face will register, the supply assumption is wrong. Stop and tell me before any more code gets written.

---

## Already done, so you don't redo it

| | |
|---|---|
| Code | Measurement, onboarding, machinery, jobs, dispatch, queue, the ping, sync, captain verification, remote push |
| Tests | 177 unit + 93 database assertions, green in CI on every push |
| Schema | 14 migrations CI-verified — including that a client cannot set its own acreage |
| Secrets | Env-only. Nothing sensitive is tracked. |
| APK | Built and standalone — rebuild after your keys land |

## The honest risk

The code is ahead of schedule. **The field work is two months behind, and it is the half that cannot be compressed.** Software can be written in a week; trust with fifty captains cannot.

Steps 1–3 cost nothing and need two days. They are the ones that decide whether the rest was worth building.
