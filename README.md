# Zamindara

**Uber for farm machinery.** A farmer walks his field boundary with his phone, the app tells him exactly how big it is, he picks the work he needs done, and nearby machine owners get the request.

Launching in **Fazilka district, Punjab**.

---

## Document set

| Document | What it covers |
|---|---|
| [PRD](docs/PRD.md) | The anchor document. Problem, vision, users, scope, metrics, risks. |
| [MVP Scope](docs/MVP_SCOPE.md) | What ships in v1 and — more importantly — what does not. |
| [Personas](docs/PERSONAS.md) | The four people in the system, written as real people. |
| [User Flows](docs/USER_FLOWS.md) | Screen-by-screen walkthroughs of every core journey. |
| [Units & Measurement](docs/UNITS_AND_MEASUREMENT.md) | Killa/kanal/marla, GPS capture, grid snapping. The trust core of the app. |
| [Data Model](docs/DATA_MODEL.md) | Postgres + PostGIS schema. |
| [Tech Architecture](docs/TECH_ARCHITECTURE.md) | Stack, dispatch engine, offline strategy, notifications. |
| [Pricing](docs/PRICING.md) | Rate model, distance surcharge, and the path to revenue. |
| [Competitive Analysis](docs/COMPETITIVE_ANALYSIS.md) | CHC/FARMS, private players, and the informal market. |
| [Roadmap](docs/ROADMAP.md) | Season-by-season plan. |

## Code

```
packages/units    area conversion + compound display (killa/kanal/marla)   41 tests
packages/geo      boundary-walk geometry pipeline                          24 tests
apps/mobile       Android app — the boundary walk prototype
```

```bash
npm install && npm test
```

```bash
npm run android --workspace @zamindara/mobile
```

See [apps/mobile/README.md](apps/mobile/README.md) — the satellite map needs a Google Maps key before the confirmation screen will render.

`packages/units` is the most safety-critical code here — a bug in it overbills a farmer — so it was built and tested before any UI existed.

`packages/geo` turns a walked GPS track into a field polygon and an area. Its accuracy suite simulates hundreds of walks over fields of known size, so every design choice in it is backed by a measurement rather than an opinion. Two of those measurements overturned the original design; both are written up in [Units & Measurement](docs/UNITS_AND_MEASUREMENT.md).

## Founding decisions already locked

| Decision | Choice |
|---|---|
| Seed which side first | **Captains** (supply) |
| Field measurement | **GPS boundary walk**, grid-snapped |
| Launch pricing | **Free** — no commission in v1 |
| Payment | Cash **and** digital, but settled off-app in v1 |
| Distance | Surcharge applies beyond **5 km** |
| Platform | **Android only** at launch |
| Region design | Punjab, Haryana, North Rajasthan share one unit system |
| Team | Solo founder |

## Open items

- Legal entity and GST registration status
- Whether to register as a CHC under state agriculture department schemes
- Play Store developer account
