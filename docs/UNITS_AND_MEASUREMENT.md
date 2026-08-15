# Units & Measurement

This is the trust core of Zamindara. If the area is wrong, the price is wrong, and the app is finished. Everything here is a hard requirement.

---

## 1. The unit ladder

Punjab / Haryana / North Rajasthan revenue system.

| Unit | Equals | Square metres | In killa |
|---|---|---|---|
| **Marla** | — | 25.29285 | 1/160 |
| **Kanal** | 20 marla | 505.857 | 1/8 |
| **Bigha** (pucca) | 5 kanal | 2,529.285 | 5/8 |
| **Killa** | 8 kanal | 4,046.856 | 1 |

One killa is exactly one acre. *Ghumaon* is a local synonym for killa and should be accepted as an alias.

**Excluded by decision:** murabba (too large to be useful at field level) and sarsahi (2.8 m² — smaller than GPS error, so displaying it would be false precision).

## 2. The storage rule

> **Store square metres. Only ever square metres.**

The database has exactly one area column, `area_sqm`, a `double precision` derived from PostGIS geometry. No table anywhere stores a value in killa, kanal, marla or bigha.

This is not fussiness. *Bigha* means four different sizes in four states — 2,529 m² in Punjab, ~1,618 m² for a Rajasthan kaccha bigha, ~1,200 m² in Madhya Pradesh, ~1,337 m² in Bengal. An app that stored `area_bigha = 3.5` would silently corrupt every record the day it crossed a state line, and nobody would notice until a farmer was overbilled by a third in the middle of harvest.

Square metres in the database, local units at the display layer, unit set attached to the region. Expansion becomes a row in a table, not a migration.

## 3. The display rule

> **Never show a decimal. Show compound remainders.**

A farmer's jamabandi does not say "2.4 killa." It says **2 killa 3 kanal 8 marla**. If the app shows a decimal, it is showing him a number he has never seen on a document, and he will not trust it.

```
9,814 m²  →  "2 killa 3 kanal 8 marla"     ✅
9,814 m²  →  "2.4 killa"                    ❌
```

### Two display chains

Bigha and killa are both top-level units and never stack together. The farmer picks his preference on his profile; kanal and marla are shared by both chains.

| Preference | Renders as |
|---|---|
| `killa` (default in Fazilka) | 2 killa 3 kanal 8 marla |
| `bigha` | 3 bigha 4 kanal 8 marla |

### Formatting rules

- Drop zero components: `2 killa 8 marla`, never `2 killa 0 kanal 8 marla`
- Round to the nearest whole marla — never show fractions of a marla
- If total is under one kanal, show marla alone
- Always render the unit name in the user's chosen language

```ts
export const SQM = {
  marla: 25.29285,
  kanal: 505.857,
  bigha: 2529.285,
  killa: 4046.856,
} as const;

export type DisplayChain = 'killa' | 'bigha';

/** 9813.6 → "2 killa 3 kanal 8 marla" */
export function formatArea(
  sqm: number,
  chain: DisplayChain = 'killa',
  locale: 'pa' | 'hi' | 'en' = 'pa',
): string {
  const ladder = chain === 'killa'
    ? (['killa', 'kanal', 'marla'] as const)
    : (['bigha', 'kanal', 'marla'] as const);

  let remaining = sqm;
  const parts: string[] = [];

  for (const unit of ladder) {
    const size = SQM[unit];
    const count = unit === 'marla'
      ? Math.round(remaining / size)
      : Math.floor(remaining / size);
    if (count > 0) {
      parts.push(`${count} ${unitName(unit, locale)}`);
      remaining -= count * size;
    }
  }
  return parts.length ? parts.join(' ') : `0 ${unitName('marla', locale)}`;
}
```

## 4. Capturing the boundary

The farmer walks the perimeter of his field with the phone in his pocket. The app records the GPS track and closes it into a polygon.

### The accuracy problem

Consumer phone GPS is accurate to **3–8 metres**. On a one-killa plot that is a **5–10% error on area** — and area sets the price. Raw GPS is not good enough to bill on.

Everything below has been **measured, not assumed**. `packages/geo` simulates walking a field of known size with realistic GPS error, so recovered-versus-truth is a number rather than an opinion. The sweeps live in `packages/geo/test/accuracy.test.ts` and run on every commit.

> ⚠️ The simulator uses independent Gaussian error. Real GPS error is **correlated over time** — a tree line or a bad ionosphere skews a whole edge one way — so these figures are a *floor* on the error, not a prediction. The 20-plot field test against jamabandi records is the real measurement.

### Defence 1 — Filter while walking

- Reject any fix reporting `accuracy > 10 m`
- Reject movement that cannot be explained by noise (see below)
- Discard fixes less than 1 m from the previous kept one
- Show a live accuracy indicator: **green / amber / red**. Never let him start on red.

**The speed filter needs care.** The obvious rule — reject anything faster than walking pace — destroys the data. Two fixes one second apart, each accurate to 5 m, can sit 10 m apart while the walker has moved barely a metre. An early version of this filter threw away **150 of 196 honest fixes** for "speeding". The rule that works subtracts the error budget both fixes admit to and tests only what is left over.

### Defence 2 — Smooth ★

**The stage that matters most, and it was missing from the original design.**

Filtering removes fixes we should not trust; it does nothing about the error in the ones we keep. A circular moving average over 5 neighbouring points cuts independent noise by roughly √5.

| Smoothing window | Mean error on 1 killa |
|---|---|
| none | 3.22% |
| 3 | 1.83% |
| **5** ✅ | **1.71%** |
| 9 | 1.87% |
| 21 | 5.25% |

The window must stay small. Over-smoothing rounds the corners off the field, and the bias is always **negative** — it quietly shaves off land the farmer actually owns.

### Defence 3 — Simplify

Ramer–Douglas–Peucker at **1 m** tolerance. 2 m measured slightly worse, 4 m noticeably worse. Above ~2 m it starts cutting corners rather than jitter, and like over-smoothing it only ever loses area.

### Defence 4 — Fit a rectangle

Canal-colony land is laid out on the murabba grid, where a killa is a standard rectangle:

```
36 karam × 40 karam  =  198 ft × 220 ft  =  43,560 ft²  =  exactly 1 acre
```

Two things this does **not** work by:

- **A minimum bounding rectangle is badly wrong.** It must enclose every point, so it latches onto the outermost noise excursion on each side — measured at **+22%** on a one-killa plot. Using it would make the correction far worse than the raw measurement.
- Instead, each edge is fitted to the **median** of the points walked along it. Every point on one edge shares the same true coordinate, differing only by noise, so the median is an unbiased estimate and ignores wild fixes. Measured at **+1.3%** on the same walk.

A plot is only treated as a rectangle when every departure from one is **explainable by the GPS error we already know we had**. Irregular plots — canal-side, river-side, orchard corners — keep their true polygon.

**Honest note on why this stage exists.** On *area* it is a wash: 1.89% fitted versus 1.87% for the plain smoothed polygon. It earns its place at the next step, because a farmer can drag four corners on a phone in a field and cannot drag twenty-odd polygon vertices.

### ❌ What did not work: snapping to whole karam

The original premise of this document was that Fazilka's canal grid would let us quantise field edges to whole karam and collapse the error. **The measurement says otherwise, and it ships switched off.**

One karam is 1.68 m — about **2.8% of a 36-karam side**. Quantising an estimate that is already inside 2% mostly rounds it *away* from the truth:

| Strategy | Within 2% of truth |
|---|---|
| Smoothed polygon | 62% |
| Rectangle fit | 60% |
| + karam snap | **53%** ❌ |

The code and the flag remain (`gridSnap: true`), because real canal-colony plots may sit closer to the surveyed grid than simulated ones do. **That is the first thing the 20-plot field test should re-examine** — but it is a question for real ground truth, not a guess to build on.

### Defence 5 — The farmer confirms

The corrected shape is drawn over **satellite imagery**. He sees his own field, with his own trees and channels, and the outline on top of it. He can drag any corner to line it up.

Nothing is saved until he taps confirm. **The farmer's confirmation, not the GPS, is the source of truth.** This is what makes the number defensible in an argument — and, given everything measured above, it is not a formality. It is the defence that does the most work.

### ⚠️ Field size dominates everything

The most important operational finding, and it changes what we can promise.

GPS error is a fixed number of *metres*. Its effect on *area* therefore shrinks as the field grows — which means accuracy is not a property of the app, it is a property of the plot:

| Plot size | Mean error | Within 2% |
|---|---|---|
| ½ killa | 3.16% | 40% ❌ |
| 1 killa | 1.95% | 58% |
| 2 killa | 1.07% | 89% ✅ |
| 5 killa | 0.54% | 100% ✅ |

**The 2% bar in [ROADMAP.md](ROADMAP.md) is achievable from two killa upward and is not achievable on a half-killa plot from a single walk.** No amount of algorithm work changes this; it is the physics of the sensor.

Three mitigations, in order of cost:

1. **Walk it twice and average.** Cuts random error by ~√2 — measured to take a half-killa plot from 3.16% to 2.31%. Costs the farmer five minutes and needs no new technology.
2. **Lean on the satellite correction.** On a small plot the drag step is not optional; the UI should say so.
3. **Show the uncertainty.** On plots under one killa, display a confidence band rather than a single number, and require the farmer to confirm explicitly.

Small plots should also be flagged to the captain, so an area dispute is anticipated rather than discovered in the field.

### Walk once, forever

The field is saved with a name he chooses — *"Nehar wala khet"*, *"Ghar ke peeche"*. He never measures it again. Every future booking is two taps.

This is both the trust mechanism and the retention hook: after one field is mapped, a competitor has to be dramatically better to be worth re-measuring for.

## 5. Fallbacks

Not every farmer will walk a boundary. Two alternatives:

| Method | When | Confidence |
|---|---|---|
| **Walk** | Default. Most accurate. | High |
| **Draw on satellite** | Standing crop, muddy field, or a plot he can't access | Medium |
| **Declare** | He just types "4 killa" | Low — flag it |

`fields.capture_method` records which was used. A declared field shows a small warning to the captain so he knows the area is unverified and can query it before starting.

## 6. Where area flows

Once confirmed, `area_sqm` drives everything downstream:

- **Price** — `(area_sqm ÷ unit_sqm) × rate`
- **Duration estimate** — service-specific rate per killa (a combine does roughly 1 killa in 20–30 minutes)
- **Diesel estimate** — for the captain's own economics
- **Queue planning** — how many fields fit in a working day

A single wrong area propagates into all four. It is the highest-stakes number in the system.

## 7. Regional unit sets

The `regions` table carries a `unit_set`. Launch belt:

| Region | Unit set | Status |
|---|---|---|
| Punjab | marla, kanal, bigha, killa | v1 |
| Haryana | marla, kanal, bigha, killa | v1 |
| North Rajasthan (Ganganagar, Hanumangarh) | marla, kanal, bigha, killa | v1 |
| Rest of Rajasthan | bigha, biswa — **pucca/kaccha varies by district** | later |
| Uttar Pradesh | bigha, biswa — different sizes again | later |

The launch belt is deliberately chosen so all three states share one unit system. North Rajasthan qualifies because Ganganagar and Hanumangarh were settled under the same canal-colony system as Punjab and use killa/kanal/marla.

**Before adding any district outside this belt, its bigha must be verified against local revenue records.** Assuming is how people get overbilled.
