# MVP Scope

One person is building this before a harvest season. Scope discipline is the only real defence.

**Definition of v1:** a farmer in Fazilka can map his field, book a machine, and have it arrive.

Everything that does not serve that sentence is deferred.

---

## In scope for v1

### Accounts
- Phone + OTP login. No email, no password, ever.
- Language selection: Punjabi, Hindi, English
- Farmer / captain / both — switchable at any time
- Profile: name, village, photo

### Field mapping ★
- GPS boundary walk with live accuracy indicator
- Offline capture, sync on reconnect
- Track smoothing, simplification and rectangle fitting
- Satellite correction screen with draggable corners
- Compound area display — *2 killa 3 kanal 8 marla*
- Saved, named fields, reusable forever
- Fallbacks: draw on map, or declare (flagged as unverified)

### Captains and machinery
- Machine registry with **owned / arrangeable** distinction and lead time
- Illustrated machine picker — never an English dropdown
- Machine photos
- Services and rates per machine
- Base location + service radius
- Online / offline toggle

### Jobs
- Post a job: field → service → timing
- Rate guidance before confirming, clearly marked approximate
- Dispatch to top 5 nearby captains, first to accept wins
- Full-screen job ping with accept / decline
- Job lifecycle: accepted → en route → in progress → completed
- Captain's queue with position and ETA visible to the farmer
- Live captain location during an active job
- Photos at start and completion
- Call button on every job screen
- Amount and payment mode recorded — settled off-app
- Two-way ratings

### Migrant mode
- Travelling toggle: current location, days staying, forward route
- "Combine available now" banner for farmers in radius
- Pre-booking on a declared forward route
- Portable ratings across districts

### Admin
- Verify or reject captains
- View and intervene in live jobs
- Basic metrics
- Manual dispute resolution

---

## Explicitly deferred

Each of these is defensible. Each would also sink a solo founder before April.

| Deferred | Until | Why |
|---|---|---|
| **In-app payments** | v2 | Launch is free, so there's no commission to collect. Razorpay needs an entity, KYC, and weeks of paperwork. v1 records the amount; the two parties settle it themselves. |
| **Bare equipment rental** | v1.5 | Needs deposits, condition photos at handover and return, and a damage dispute process. Balwinder won't lend without himself anyway. |
| **iOS** | v2+ | Farmers and captains here are on Android. Saves ~40% of build effort. |
| **Commission engine** | v2 | Nothing to compute while the platform is free. |
| **Chat** | v2 | They will call. The phone works. |
| **Advance scheduling > 7 days** | v1.5 | Nobody books a combine three weeks out. |
| **Multi-field / bulk booking** | v1.5 | Wait for the request to appear. |
| **Crop advisory, weather, mandi prices** | — | Different product. |
| **Aadhaar / DigiLocker verification** | v2 | At 50 captains the founder verifies personally, which is stronger anyway. |
| **Referral programme** | v1.5 | Needs users before it needs mechanics. |
| **Route optimisation for queues** | v1.5 | Sort by distance in v1. Good enough. |
| **Insurance, credit, warranty** | — | Regulated. Not now. |

---

## The three hardest parts

Where the real risk sits, in order:

**1. GPS accuracy → billing trust.** If the app says 4 killa and the farmer's papers say 3½, the app is finished in that village — and village opinion travels fast. Measurement puts a one-killa plot at ~2% and a half-killa plot at ~3%, so **mandatory farmer confirmation on satellite is the load-bearing mitigation**, not the algorithm. See [Units](UNITS_AND_MEASUREMENT.md).

**2. Cold-start liquidity.** An empty marketplace is worthless to both sides. Mitigation is not technical: the founder personally onboards 40–50 captains before a single farmer is invited.

**3. Captain smartphone comfort.** A 48-year-old combine operator will abandon a confusing app in seconds during peak week. Mitigation: icon-first UI, Punjabi default, one-tap accept, and the founder's own phone number as the fallback in season one.

---

## Definition of done

v1 ships when **all** of these are true:

- [ ] A farmer walks a two-killa field and the area matches his jamabandi within 2%
- [ ] A half-killa plot is within 4%, and the UI tells him the number is less certain
- [ ] The same field books a second job in under 30 seconds
- [ ] A captain accepts a job from the lock screen without opening the app
- [ ] The boundary walk survives airplane mode and syncs afterwards
- [ ] Every screen is complete in Gurmukhi
- [ ] A migrant captain goes live and appears to nearby farmers within a minute
- [ ] The app runs acceptably on a 2 GB RAM Android device
- [ ] 20 real jobs have completed end to end with real money changing hands offline
