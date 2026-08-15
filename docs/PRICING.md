# Pricing & Monetisation

---

## Launch position: free

**Zero commission. Zero subscription. Zero listing fee.**

Money changes hands directly between farmer and captain, in cash or by UPI, exactly as it does today. The app records the amount for history and dispute reference. It does not touch the money.

This is a deliberate choice, not a temporary shortcut:

- **It removes the reason to go around the app.** With no cut being taken, a captain has no incentive to hide a booking. Off-app leakage — the thing that kills most Indian marketplaces — simply doesn't apply yet.
- **It makes captain acquisition honest.** The founder is asking for nothing. That is a much easier conversation at 50 doorsteps.
- **It removes weeks of work.** No payment gateway, no KYC, no settlement ledger, no refund flow, no escrow. See [MVP Scope](MVP_SCOPE.md).
- **It buys the data to price correctly later.** After one season of real transactions, actual rates in Fazilka are known — not guessed.

---

## How a job is priced

The captain sets the rate. The platform only computes and displays.

```
subtotal       = (area_sqm ÷ unit_sqm) × rate
travel_charge  = max(0, road_km − 5) × per_km_rate
approximate    = subtotal + travel_charge
```

Worked example — 2 killa 3 kanal of wheat harvesting, captain 9 km away:

```
Area              9,814 m²  =  2.425 killa
                            =  2 killa 3 kanal 8 marla
Rate              ₹1,100 per killa
Subtotal          ₹2,668

Distance          9 km  →  4 km beyond the 5 km threshold
Travel            4 × ₹50  =  ₹200

Approximate       ₹2,868
```

### Rate units

Different work is priced differently, and the app must not force one model:

| Unit | Typical use |
|---|---|
| **Per killa** | Harvesting, ploughing, rotavator, sowing, levelling — most work |
| **Per hour** | JCB, tractor hire, orchard spraying |
| **Per day** | Machine on hire for a full day |
| **Per job** | Small or irregular plots |

Rates are stored as **amount + unit**, never as a bare number. A captain quoting "₹1,100" means ₹1,100 *per killa*, and the unit is part of the data.

### Rate guidance

Farmers see a range, drawn from recent completed jobs for that service within ~20 km:

```
Typical rate near you    ₹1,100 – ₹1,300 per killa
```

A range, never a single number. It anchors the negotiation without the platform pretending to set a price it doesn't control.

**The word "approximate" is on every estimate screen.** The final amount is whatever the two of them agree in the field. Over-promising a price is the fastest way to lose both sides.

---

## The travel charge

Your rule: **beyond 5 km, the fare goes up.**

The reasoning is real — a tractor moving 15 km burns diesel and an hour of daylight, and without a travel charge, distant captains simply decline every distant job, leaving remote farmers unserved.

| Distance | Charge |
|---|---|
| 0–5 km | none |
| beyond 5 km | ₹40–60 per extra km, by machine class |

Heavy self-propelled machines (combines) cost more to reposition than a tractor with an implement, so the per-km rate is set per machine category, configurable per region without a code change.

Distance is straight-line × 1.3, which avoids a paid routing API at launch. See [Tech Architecture](TECH_ARCHITECTURE.md#distance-and-travel-charge).

---

## Seasonality

Demand is brutally uneven. Fazilka's crop mix is the hedge, and the service catalog is built around it:

| Period | Demand | Machines |
|---|---|---|
| **Mid-April** ★ | Extreme | Combines, straw reapers |
| Apr–May | High | Cotton bed prep, ridgers, sowing |
| Sep–Nov | High | Cotton picking support, paddy harvest, stubble management |
| Oct–Nov | High | Happy/super seeder, wheat sowing, laser levelling |
| **Dec–Feb** | Moderate | Kinnow spraying and orchard work — Abohar |
| Jun–Aug | Low | Light tillage, haulage |

The December–February kinnow window matters more than its volume suggests: it's what keeps captains opening the app in the off-season, so they're still active when April arrives.

**No surge pricing.** Captains raise their own rates in peak week if they want to. A platform that visibly inflates prices during a farmer's crisis would not be forgiven, and would be remembered longer than any feature.

---

## The path to revenue

Sequenced so each step is only taken once the previous one has clearly earned trust.

### Phase 1 — Free (season 1)
Prove the product works. Target: 250 completed jobs, >40% repeat rate.

### Phase 2 — Optional digital payment (season 2)
Introduce UPI payment in-app. Still free. The goal is not revenue — it is **payment data**, and getting both sides used to money moving through the app before any of it is retained.

### Phase 3 — Commission (season 3, only if retention holds)
A modest **3–5% platform fee**, and only when there is something real to charge for:

- Guaranteed arrival, with compensation if the captain no-shows
- Dispute resolution with actual recourse
- Verified area as an agreed reference

If retention has not held by then, commission is not the answer and shouldn't be attempted.

### Phase 4 — Adjacent revenue (year 2+)
Ranked by how well they fit what the platform will actually know:

1. **Captain subscription** — priority dispatch, better placement. Captains have cash and a clear ROI.
2. **Machinery dealer listings** — the platform knows exactly who owns what and what's failing.
3. **Migrant fleet services** — route planning and district-level demand forecasts sold to multi-combine operators.
4. **Anonymised demand data** — mechanisation patterns are valuable to manufacturers.

Explicitly rejected: lending, insurance, and input sales. All regulated, all a different company.

---

## Unit economics, later

At 5% on an average ₹2,800 job, the platform earns **₹140 per job**.

| Jobs/month | Monthly revenue |
|---|---|
| 500 | ₹70,000 |
| 2,000 | ₹2,80,000 |
| 10,000 | ₹14,00,000 |

Infrastructure at 10,000 jobs/month is still under ₹15,000. **The economics work — the risk is entirely in liquidity and trust, not in margin.** Which is exactly why season one charges nothing.
