# Roadmap

Planned against the **crop calendar**, not calendar quarters. In this business the deadline is set by when the wheat ripens, and it does not move.

**Today: August 2026.** The next wheat harvest in Fazilka is **April 2027**. That is the target, and there are roughly eight months to it.

---

## The fixed points

```
2026        Aug ──── Sep ──── Oct ──── Nov ──── Dec
                                │              │
                          paddy harvest    kinnow
                          wheat sowing     spraying
                          ★ SOFT LAUNCH    begins

2027        Jan ──── Feb ──── Mar ──── Apr ──── May
             │                          │
          kinnow                  ★★ WHEAT HARVEST
          season                   migrant combines
                                   THE SEASON
```

Two shots before the harvest that matters: the **October–November sowing window** as a live rehearsal, and the **December–February kinnow season** to keep captains engaged. Then April, where the product either works or doesn't.

---

## Phase 0 — Build (Aug – Oct 2026)

**Goal: a working app before the sowing window.**

*Month 1 — foundation*
- Supabase project, PostGIS, schema, RLS
- `packages/units` with full test coverage — **this comes before any UI**
- Phone OTP auth, profiles, Punjabi/Hindi/English strings
- Seed data: machine types, services, Fazilka villages

*Month 2 — the two hard things*
- Captain onboarding and machine registry
- GPS boundary walk: capture, filtering, smoothing, simplification, rectangle fit
- Satellite correction screen
- **Field-test the walk on 20 real plots, measured against a 50 m tape.** Include several plots under one killa and several above two — simulation says the error depends far more on plot size than on anything in the code. Record the jamabandi separately: it is not ground truth, but the gap between paper and ground is its own finding. See [Build Plan, Phase 1](BUILD_PLAN.md#ground-truth-is-a-measuring-tape-not-the-jamabandi).

  Pass bar, revised from simulation: **within 2% on plots of two killa and above**, within 4% below that. If it misses, stop and fix before building anything else. Also settle two open questions here: whether real canal-colony plots sit close enough to the surveyed grid for karam snapping to pay off (simulation says no), and whether real correlated GPS error is worse than the independent noise the simulator assumes (it probably is).

*Month 3 — the loop*
- Job posting, dispatch engine, push notifications
- Captain queue, job lifecycle, ratings
- Admin console
- Internal testing on real low-end devices

**Milestone:** the founder books a real job on his own field and a real captain shows up.

---

## Phase 1 — Soft launch (Oct – Nov 2026)

**Goal: 50 captains. This phase is not about the app.**

The work here is a motorcycle, a phone, and doorsteps:

- Personally onboard **50 captains** within 25 km — every combine, every laser leveller
- Photograph every machine yourself; the registry quality is a founder-created asset
- Recruit CHC operators — pre-verified, underutilised supply
- Invite **150 farmers**, walking their first field with each one in person
- Target **40 completed jobs** through the sowing window

Every job in this phase is shadowed personally. Every failure is a design input.

| Milestone | Target |
|---|---|
| Captains | 50 |
| Farmers | 150 |
| Fields mapped | 200 |
| Jobs completed | 40 |
| Area disputes | 0 |

**Kill criterion:** if fewer than 30 captains will register when a real person asks them face to face, the supply assumption is wrong. Stop and re-examine before building further.

---

## Phase 2 — Kinnow season (Dec 2026 – Feb 2027)

**Goal: prove the app works when it isn't peak.**

Abohar's orchards keep captains earning while the rest of the district is quiet — which is what keeps them opening the app in March.

- Orchard services: HTP spraying, pruning support, haulage
- Fix everything the sowing window exposed
- **Build migrant/travelling mode** — this is the pre-harvest priority
- Begin recruiting migrant operators in **Sri Ganganagar, before the season starts**

| Milestone | Target |
|---|---|
| Captains | 90 |
| Farmers | 400 |
| Jobs completed | 120 |
| Repeat booking rate | > 35% |
| Migrant operators pre-registered | 15 |

---

## Phase 3 — Wheat harvest (Mar – Apr 2027) ★★

**The season everything has been built for.**

Late March, the fleet starts moving north out of Rajasthan. Fazilka is the door into Punjab.

- Migrant mode live, forward-route pre-booking open
- Ganganagar operators pre-registered and pre-booked before they cross
- Peak-load readiness: dispatch under concurrency, notification reliability
- Founder on call, every day, personally
- Straw reaper (*toori*) jobs immediately behind every combine

| Milestone | Target |
|---|---|
| Jobs completed in April | 250+ |
| Migrant captains active | 25 |
| Job fill rate | > 80% |
| Cancellation after accept | < 10% |
| Repeat booking rate | > 40% |

**This is the go/no-go.** If April works in Fazilka, the model is proven and the rest is expansion. If it doesn't, the reason will be obvious and specific.

---

## Phase 4 — Consolidate and extend (May – Sep 2027)

- Bare equipment rental with deposits and condition photos
- Optional in-app UPI payment — for the data, still free
- Route optimisation for captain queues
- Referrals
- Extend to adjacent districts sharing the unit system: **Muktsar, Ferozepur, Bathinda, Sri Ganganagar**
- Legal entity and payment infrastructure groundwork

**Do not enter southern or eastern Rajasthan** until the bigha/biswa unit set is built and each district's bigha verified against local revenue records. See [Units](UNITS_AND_MEASUREMENT.md#7-regional-unit-sets).

---

## Phase 5 — Season two (Oct 2027 onward)

- 5–6 districts across the belt
- Commission introduced **only if** repeat rate held above 40%
- iOS, if demand justifies it
- First hires: field ops, not engineers
- Fundraising, if growth warrants it

---

## What could stop this

| Risk | Watch for | Response |
|---|---|---|
| Area accuracy fails | > 2% error above two killa, > 4% below | Halt build. Fix, or lean harder on satellite correction and require a second walk on small plots. |
| Captains won't register | < 30 sign-ups at doorsteps | Re-examine the value proposition before writing more code |
| Captains register but ignore jobs | Acceptance < 40% | The ping or the economics are wrong |
| Farmers book once, never again | Repeat < 25% | Fulfilment is failing, not discovery |
| Founder burnout | Solo, through a harvest season | Scope is the only defence. Cut features, never cut the season. |

---

## The one thing that matters most

Not the app. **Fifty captains who will answer the founder's phone at 6 am in April.**

The software is eight months of work by one person, and it is the easier half. The registry, the relationships, and the trust are the actual company — and they are built on a motorcycle, in October, one doorstep at a time.
