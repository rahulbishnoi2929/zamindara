# Zamindara — mobile

Android app. Currently the **field measurement prototype**: draw or walk a field boundary, check it, save it.

That is deliberately the whole scope. [BUILD_PLAN.md](../../docs/BUILD_PLAN.md) says nothing else gets built until a walked boundary is proven against a measuring tape in a real field, and this is the app that answers that.

## Running it

```bash
npm install
```

```bash
npm run android --workspace @zamindara/mobile
```

Or from this directory, `npx expo start` and scan the QR code with **Expo Go**.

### One thing you must do first

The satellite map needs a Google Maps key. In [app.json](app.json), replace:

```
"apiKey": "REPLACE_WITH_YOUR_GOOGLE_MAPS_ANDROID_API_KEY"
```

Get one from the Google Cloud console — enable **Maps SDK for Android**. It sits inside the free monthly credit at this volume. Without it the walk still works; the confirmation screen shows a blank map.

> ⚠️ Expo Go cannot show Google Maps on Android. Since drawing is now the primary method, **a development build is required to use the app at all**:
> ```bash
> npx expo run:android
> ```
> The walk screen alone still works in Expo Go.

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

## How it is put together

| File | Does |
|---|---|
| [`DrawScreen.tsx`](src/DrawScreen.tsx) | Tap-to-trace on satellite, numbered draggable corners |
| [`useBoundaryWalk.ts`](src/useBoundaryWalk.ts) | GPS subscription, walk state machine, crash recovery |
| [`storage.ts`](src/storage.ts) | Offline persistence. The walk is checkpointed on every point. |
| [`ConfirmScreen.tsx`](src/ConfirmScreen.tsx) | Satellite map, draggable corners, live area |
| [`i18n.ts`](src/i18n.ts) | Punjabi, Hindi, English |
| [`theme.ts`](src/theme.ts) | Sunlight contrast, 56 px minimum touch targets |

**No geometry lives here.** Every decision about filtering, smoothing, area and rectangle fitting comes from [`@zamindara/geo`](../../packages/geo), which is tested against fields of known size. This app owns the device — permissions, the location stream, persistence, and the screens.

## Offline

**Walking works with no signal at all**, which is the normal condition in the middle of a Fazilka field:

- GPS needs no network
- Every point is written to storage as it arrives
- An interrupted walk is recovered on next launch

Losing twenty minutes of walking to a dropped connection would only ever happen to the farmer least able to tolerate it.

**Drawing needs a connection**, because map tiles have to load. This is the one real cost of making it the default, and it is unresolved: either pre-cache tiles around the farmer's village, or fall back to walking when offline. Phase 1 measures how often signal is actually missing in the fields that matter, which decides whether it needs solving.

## Status

Typechecks, and bundles for Android (663 modules, verified with `expo export`). **It has not been run on a physical device or against real GPS** — that is the next step, and the 20-plot field test is what actually validates any of it.
