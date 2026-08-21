# Zamindara — mobile

Android app. Currently the **field measurement prototype**: draw or walk a field boundary, check it, save it.

That is deliberately the whole scope. [BUILD_PLAN.md](../../docs/BUILD_PLAN.md) says nothing else gets built until a walked boundary is proven against a measuring tape in a real field, and this is the app that answers that.

## Getting it onto a phone

### 1. The Google Maps key — do this first

Both map screens are dead without it. In [app.json](app.json), replace:

```
"apiKey": "REPLACE_WITH_YOUR_GOOGLE_MAPS_ANDROID_API_KEY"
```

Get one from the Google Cloud console with **Maps SDK for Android** enabled. It sits inside the free monthly credit at this volume.

If you skip it, the app now *tells* you rather than showing a blank grey rectangle — but you still cannot draw a field.

### 2. Build the APK

```bash
cd apps/mobile && npx expo prebuild --platform android --clean
```

Then **build release, not debug**:

```bash
cd apps/mobile/android && ./gradlew assembleRelease
```

The APK lands at `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.

> ⚠️ **Do not take a debug APK into a field.** `assembleDebug` does not embed the
> JavaScript bundle — it expects Metro running on your laptop, and shows an error
> screen without it. That is exactly the failure you would discover after driving
> to a plot. `assembleRelease` bundles the JS and runs standalone.

The release build is signed with the **debug keystore**, which is fine for
sideloading and the field test. Generate a real keystore before the Play Store —
an app signed with the debug key cannot be published or updated.

`android/` is generated and gitignored — regenerate it any time with `expo
prebuild`. Never edit it by hand; the next prebuild throws the edits away.

### 3. Install it

With the phone plugged in and USB debugging on:

```bash
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Or copy the APK to the phone and tap it — Android will ask permission to install from unknown sources.

### Day-to-day development

For coding at a desk, a debug build plus Metro gives live reload:

```bash
cd apps/mobile/android && ./gradlew assembleDebug
```

```bash
cd apps/mobile && npx expo start --dev-client
```

Rebuild natively only when a native dependency or `app.json` changes. Rebuild
**release** whenever you are about to go out and measure something.

## The flow

```
Home ─→ Choose ─┬─→ Draw ─────────────────→ Saved
                └─→ Walk ─→ Confirm ──────→ Saved
```

**Draw** — [`DrawScreen.tsx`](src/DrawScreen.tsx). **The default.** Satellite map, centred by GPS on where he is standing, and he taps the corners of his field. Numbered handles, draggable, live area from the third corner. A Labels toggle brings in roads and village names for orientation.

No confirmation step afterwards: he traced it on the imagery and watched the area the whole time.

**Walk** — [`WalkScreen.tsx`](src/WalkScreen.tsx). Green/amber/red signal dot, live area, distance walked. Refuses to start on a red signal. Vibrates when he returns to the starting corner, because the phone is in his pocket and vibration is the only channel that reaches him there.

**Confirm** — [`ConfirmScreen.tsx`](src/ConfirmScreen.tsx). Required after a walk, and not after a draw. The field on satellite imagery with draggable corners; area updates live. Warns on plots under one killa, where GPS alone cannot reach 2%.

### Why drawing is the default

A georeferencing offset shifts the traced outline without changing its **area** — so error comes only from how precisely he taps four visible corners, not from two hundred noisy GPS fixes. And he can *see* whether it is right, which a walked track never lets him do.

That is reasoning, not measurement. [Phase 1](../../docs/BUILD_PLAN.md#phase-1--prove-the-measurement-) settles it by testing both methods against a tape on the same plots.

## Field test recorder

Reached from a small **Field test** link at the bottom of the home screen. Deliberately English, dense, and out of the way — it is the founder's tool, not the farmer's, and it comes out once [Phase 1](../../docs/BUILD_PLAN.md#phase-1--prove-the-measurement-) clears.

**Per plot:** tape reading (two sides, in m / ft / karam), jamabandi typed the way it reads on the paper — *"4 killa 2 kanal"* — and any number of measurements by either method.

**Per measurement, captured automatically:** area, signed error against the tape, mean GPS accuracy, walk duration, fixes accepted vs rejected, which pipeline path ran, and **whether the corners had to be dragged**. That last one matters: it separates accuracy coming from the algorithm from accuracy coming from the farmer's own eyes.

**The summary answers the gate directly** — accuracy by method, accuracy by plot size against a size-dependent bar, repeatability across repeat walks, and the median gap versus the jamabandi. The gate card says pass or fail and lists exactly what is still missing.

**Export** writes a wide, flat CSV and opens the Android share sheet. One row per measurement, plots with no measurements included, so an untested plot is visible as a gap in the sample.

The recorder drives the **same capture screens the app ships**, not a copy — a test that exercises different code would prove nothing.

`stats.ts` and `csvBuilder.ts` are pure and carry **17 tests**. They decide whether the project proceeds, so they are tested before they are trusted.

## How it is put together

| File | Does |
|---|---|
| [`DrawScreen.tsx`](src/DrawScreen.tsx) | Tap-to-trace on satellite, numbered draggable corners |
| [`useBoundaryWalk.ts`](src/useBoundaryWalk.ts) | GPS subscription, walk state machine, crash recovery |
| [`storage.ts`](src/storage.ts) | Offline persistence. The walk is checkpointed on every point. |
| [`ConfirmScreen.tsx`](src/ConfirmScreen.tsx) | Satellite map, draggable corners, live area |
| [`i18n.ts`](src/i18n.ts) | Punjabi, Hindi, English |
| [`theme.ts`](src/theme.ts) | Sunlight contrast, 56 px minimum touch targets |
| [`fieldTest/`](src/fieldTest) | Phase 1 recorder — tape reference, stats, gate, CSV export |

**No geometry lives here.** Every decision about filtering, smoothing, area and rectangle fitting comes from [`@zamindara/geo`](../../packages/geo), which is tested against fields of known size. This app owns the device — permissions, the location stream, persistence, and the screens.

## Offline

**Walking works with no signal at all**, which is the normal condition in the middle of a Fazilka field:

- GPS needs no network
- Every point is written to storage as it arrives
- An interrupted walk is recovered on next launch

Losing twenty minutes of walking to a dropped connection would only ever happen to the farmer least able to tolerate it.

**Drawing needs a connection**, because map tiles have to load. This is the one real cost of making it the default, and it is unresolved: either pre-cache tiles around the farmer's village, or fall back to walking when offline. Phase 1 measures how often signal is actually missing in the fields that matter, which decides whether it needs solving.

## Status

Typechecks, 17 tests green, and bundles for Android (694 modules, verified with `expo export`). **It has not been run on a physical device or against real GPS** — that is the next step, and the 20-plot field test is what actually validates any of it.
