# Zamindara — Product Requirements Document

**Version** 1.0 · **Status** Draft · **Owner** Founder/CEO (solo)
**Launch market** Fazilka district, Punjab

---

## 1. The problem

A farmer in Fazilka who needs his wheat harvested has no reliable way to find a machine.

He calls three or four numbers he knows. One combine owner is busy, one is two villages away and won't come for a small plot, one quotes a price that changes when he arrives. In peak harvest week, when the crop must come off the field within days or it shatters and drops yield, he may wait five days for a machine that was sitting idle 8 km away the whole time.

Meanwhile the machine owner has the opposite problem. His combine cost ₹25–35 lakh. It earns money for roughly six weeks a year. He depends on word of mouth, middlemen who take a cut, and standing at the roadside hoping to be flagged down. In an unfamiliar district he may lose two full days finding work.

**Both sides are desperate for each other and cannot find each other.** The entire matching layer is phone calls, relatives, and luck.

Three specific failures make it worse:

**Nobody agrees on how big the field is.** Price is quoted per killa. The farmer says four killa, the operator's own estimate says four and a half. There is no neutral number, so every job starts with an argument.

**Idle machinery is invisible.** A farmer's tractor and rotavator sit unused 300 days a year while his neighbour rents the same implement from a dealer 20 km away. There is no way to see what is available in your own village.

**The migrant combine fleet flies blind.** Every rabi season, combine operators follow the ripening wave north — Madhya Pradesh in March, Rajasthan late March, Haryana early April, Punjab mid-April. They arrive in a district where they know nobody, and burn days finding work through commission agents. Farmers in that same district are simultaneously desperate for a machine. Neither can see the other.

## 2. Vision

> **Any farmer, anywhere in the belt, can get any farm job done by tapping his phone — at a price both sides agreed on before the machine started moving.**

Zamindara is Uber, with three substitutions:

| Uber | Zamindara |
|---|---|
| Rider | Farmer |
| Driver | Captain (machine owner/operator) |
| Car | Tractor, combine, rotavator, laser leveller… |
| Trip measured in **km** | Job measured in **killa** |

## 3. Who this is for

Four roles, covered in detail in [Personas](PERSONAS.md).

| Role | Description |
|---|---|
| **Farmer** | Has land, needs work done. |
| **Captain** | Owns or operates machinery. Accepts jobs. The professional supply. |
| **Farmer-lender** | A farmer whose own machine sits idle. Casual supply. |
| **Migrant captain** | Travels seasonally. Goes online in a district where he knows nobody. |

A single person is often two of these at once. A farmer with a tractor is a customer in April and a supplier in June. **The app must never force someone to choose a side permanently.** One account, both capabilities.

## 4. What we're building

### 4.1 Field-first, not job-first

The defining interaction. The farmer selects his field **before** he selects the work.

He walks the boundary of his plot once, with his phone in his pocket. The app records the track, closes the polygon, snaps it to the canal-colony grid, and tells him: **2 killa 3 kanal 8 marla.** That field is now saved permanently.

Every future booking on that field takes two taps. The area is never re-measured, never re-argued. It becomes the neutral number both sides price against.

This is the product's foundation. Full detail in [Units & Measurement](UNITS_AND_MEASUREMENT.md).

### 4.2 The machine registry

At onboarding, a captain declares his machinery — and critically, in **two tiers**:

- **Owned** — it's in his shed, he controls it.
- **Arrangeable** — he can get it. From a brother, a neighbour, a nearby custom hiring centre. He needs a few hours' notice.

This second tier is deliberate. In rural Punjab, machinery access runs through relationships, not ownership. A captain who owns a tractor but can borrow a rotavator from his cousin is a perfectly good captain for a rotavator job — he just needs lead time. A registry that only records ownership would throw away most of the district's real capacity.

Owned machines can take instant jobs. Arrangeable machines only appear for scheduled jobs, with the lead time the captain specified.

### 4.3 Dispatch

Farmer posts a job → the system finds captains who can do that work, within range, available in that window → sends them the request → first to accept gets it.

Unlike Uber, this is mostly **scheduled**, not instant. In peak week "now" matters; the rest of the year it's "Tuesday morning." Both are first-class.

Also unlike Uber, a combine serves eight fields in a day, back to back. So a captain has a **queue**, not one job at a time — and the farmer needs to see *"you're 4th today, he reaches you around 3 pm."* Position in queue is a real screen.

### 4.4 Peer-to-peer equipment lending

A farmer lists his idle rotavator. A neighbour books it. Two modes:

- **With operator** — the owner comes and does the work. This is a normal job.
- **Bare rental** — the implement goes to the borrower's field, he uses it himself.

Bare rental needs a deposit concept and condition photos at handover and return. It is deliberately deprioritised to v1.5 — see [MVP Scope](MVP_SCOPE.md).

### 4.5 Migrant combine mode

The flagship feature and the reason Fazilka is the right launch point — it sits on the Rajasthan border, the gate the northbound fleet drives through.

A combine operator arriving from Ganganagar switches on **"I am here and available."** He sets his location, how many days he's staying, and his rate. Every farmer in that radius sees him immediately.

He also gets a **route plan**: declare the districts he intends to work through, and farmers ahead of him on the route can pre-book before he arrives. He drives into a district with his week already full.

This converts the single most wasteful part of the harvest economy — an idle ₹30 lakh machine parked in an unfamiliar district — into booked work. It is worth real money to the operator on day one, which is exactly what a supply-first launch needs.

## 5. Why we start with captains

Marketplaces die on the supply side. A farmer who opens the app and finds no machines never opens it again; a captain who finds no jobs will still keep the app because his phone is his business line.

So the first 90 days are not an app problem, they are a **field problem**: the founder personally onboards 40–50 captains in Fazilka, sits with them, photographs their machines, and earns the trust to be called at 6 am in harvest week. Only then does farmer acquisition begin.

Target at launch: **every combine and every laser leveller in a 25 km radius of the founder's base town is registered.**

## 6. Success metrics

### The one number that matters

**Repeat booking rate** — the share of farmers who book a second job within 60 days. It's the only metric that can't be faked with marketing, and it's the true signal that the product works.

### Season one targets

| Metric | Target |
|---|---|
| Registered captains, Fazilka | 50 |
| Combines registered | 15 |
| Registered farmers | 400 |
| Fields mapped | 600 |
| Jobs completed | 250 |
| Repeat booking rate | > 40% |
| Job acceptance rate | > 60% |
| Median time to accept | < 10 min |
| Area disputes raised | < 5% of jobs |

### Health indicators

- **Coverage**: % of job requests that reach at least 3 eligible captains
- **Fill rate**: % of requests that get accepted at all
- **Migrant utilisation**: days worked ÷ days present, for migrant captains
- **Cancellation after accept**: the trust killer. Must stay under 10%.

## 7. Non-goals for v1

Explicitly out of scope. Each is a real business, and each would sink a solo founder trying to do it in season one.

- Selling seed, fertiliser, or pesticide
- Crop advisory, weather prediction, disease diagnosis
- Mandi price data or produce sale
- Credit, insurance, or lending
- Drone services
- Labour hiring (as distinct from machinery)
- iOS
- Anything outside the Punjab/Haryana/North-Rajasthan unit belt

## 8. Key risks

| Risk | Severity | Mitigation |
|---|---|---|
| **GPS area is wrong and someone is billed incorrectly** | Critical | Filtering, smoothing, rectangle fitting — then the farmer confirms on satellite view before saving. Measured at ~2% on a killa, worse on small plots, so the confirmation step is the real defence. Never bill on an unconfirmed field. See [Units](UNITS_AND_MEASUREMENT.md). |
| **Captains take the booking then transact off-app** | High | Expected and tolerated in v1 — we take no commission, so there's nothing to leak. The app must be worth keeping for discovery and queue management alone. |
| **Extreme seasonality — 6 weeks of demand, then silence** | High | Multi-season service catalog: kinnow spraying (Dec–Feb), cotton prep (Apr–May), paddy stubble (Oct–Nov). Fazilka's crop mix is the hedge. |
| **Captains can't or won't use a smartphone app** | High | Icon-first UI, Punjabi in Gurmukhi, voice prompts, one-tap accept, and a phone call fallback the founder personally handles in season one. |
| **No network in the field** | Medium | Boundary walk works fully offline and syncs later. Job actions queue and retry. |
| **Farmer and captain dispute the work quality** | Medium | Photos at start and completion, ratings both ways, founder mediates in season one. |
| **Solo founder is the bottleneck** | High | Ruthless MVP scope. No payments, no iOS, no bare rental in v1. |

## 9. Constraints

- **Android only.** Low-end devices, 2 GB RAM, small screens.
- **Languages:** Punjabi (Gurmukhi) primary, Hindi (Devanagari), English. Fazilka is Punjabi-speaking with significant Hindi/Bagri around Abohar.
- **Literacy:** assume the user does not read comfortably. Icons, photos, colour, and voice carry meaning; text supports it.
- **Data:** every screen must work on 2G. Images aggressively compressed.
- **Battery:** background location during an active job must not drain a captain's phone across a 10-hour working day.

## 10. Open questions

1. Legal entity — sole proprietorship or private limited? Affects payments later.
2. Should Zamindara register as a Custom Hiring Centre under the state scheme? Possible subsidy access, definite paperwork.
3. Do we verify captains against Aadhaar/RC documents in v1, or is founder-vouched enough at 50 captains?
4. What happens when a captain damages a crop? Liability position needed before scale.
