# Zamindara — mobile

Android app. Currently the **boundary walk prototype**: measure a field, check it against satellite, save it.

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

> ⚠️ Expo Go cannot show Google Maps on Android. For the confirmation screen you need a development build:
> ```bash
> npx expo run:android
> ```

## The flow

```
Home  →  Walk  →  Confirm  →  Saved
```

**Walk** — [`WalkScreen.tsx`](src/WalkScreen.tsx). Green/amber/red signal dot, live area, distance walked. Refuses to start on a red signal. Vibrates when he returns to the starting corner, because the phone is in his pocket and vibration is the only channel that reaches him there.

**Confirm** — [`ConfirmScreen.tsx`](src/ConfirmScreen.tsx). The field on satellite imagery with draggable corners; area updates live as he drags. Warns on plots under one killa, where GPS alone cannot reach 2%.

On the evidence this second screen matters more than the first. See [Units & Measurement](../../docs/UNITS_AND_MEASUREMENT.md).

## How it is put together

| File | Does |
|---|---|
| [`useBoundaryWalk.ts`](src/useBoundaryWalk.ts) | GPS subscription, walk state machine, crash recovery |
| [`storage.ts`](src/storage.ts) | Offline persistence. The walk is checkpointed on every point. |
| [`ConfirmScreen.tsx`](src/ConfirmScreen.tsx) | Satellite map, draggable corners, live area |
| [`i18n.ts`](src/i18n.ts) | Punjabi, Hindi, English |
| [`theme.ts`](src/theme.ts) | Sunlight contrast, 56 px minimum touch targets |

**No geometry lives here.** Every decision about filtering, smoothing, area and rectangle fitting comes from [`@zamindara/geo`](../../packages/geo), which is tested against fields of known size. This app owns the device — permissions, the location stream, persistence, and the screens.

## Offline

The walk works with no signal at all, which is the normal condition in the middle of a Fazilka field:

- GPS needs no network
- Every point is written to storage as it arrives
- An interrupted walk is recovered on next launch

Losing twenty minutes of walking to a dropped connection would only ever happen to the farmer least able to tolerate it.

## Status

Typechecks, and bundles for Android (663 modules, verified with `expo export`). **It has not been run on a physical device or against real GPS** — that is the next step, and the 20-plot field test is what actually validates any of it.
