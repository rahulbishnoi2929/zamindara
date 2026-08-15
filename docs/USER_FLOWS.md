# User Flows

Screen-by-screen for every core journey in v1.

---

## Flow 1 — Captain onboarding

The most important flow in the product. This is what the founder walks people through in person during season one, and every second of friction costs a captain.

```
Splash → Language → Phone → OTP → Role → Profile → Machines → Services → Area → Review → Done
```

**1. Language** — Punjabi (ਪੰਜਾਬੀ) / Hindi (हिन्दी) / English. Big buttons, native script only, no flags. Set before anything else.

**2. Phone + OTP** — 10 digits, auto-read the SMS. Phone number is the identity; there is no email, no password, ever.

**3. Role** — two large illustrated cards:
- *I need work done on my field* → farmer
- *I have machinery* → captain

Below them, quiet text: **"I do both."** Many will. Choosing one now does not lock anything.

**4. Profile** — name, village (searchable list of Fazilka villages, not free text), photo. Photo is optional but strongly nudged — it is the single biggest trust signal to a farmer.

**5. Machine registry** — the heart of onboarding.

For each machine:
- Pick type from an **illustrated grid** — pictures of a combine, a rotavator, a laser leveller. Never a dropdown of English words.
- **Owned** or **can arrange**
- If arrangeable: how much notice? (same day / 1 day / 2–3 days)
- Make, model, year, size/HP — all optional
- **Photo of the actual machine** — heavily nudged. A farmer choosing between two captains chooses the one whose machine he can see.

Repeat for as many machines as he has.

**6. Services and rates** — derived from his machines. If he registered a combine, he is offered "wheat harvesting" and "paddy harvesting." For each, he sets a rate and its unit (per killa / per hour / per day). He may leave it blank and negotiate per job.

**7. Working area** — his base location (GPS, one tap) and a service radius slider, default 15 km. Live map preview showing what that covers.

**8. Availability** — normal working hours, and a master **Online / Offline** toggle.

**9. Review and finish** — everything on one screen, editable. Then a "verification pending" state; in season one the founder verifies personally within a day.

---

## Flow 2 — Farmer maps a field ★

The signature interaction. Detail in [Units & Measurement](UNITS_AND_MEASUREMENT.md).

```
My Fields → Add Field → Choose method → Walk → Correct → Name → Saved
```

**1. Choose method** — three cards:
- 🚶 **Walk the boundary** — most accurate *(recommended)*
- ✏️ **Draw on map** — for standing crop or inaccessible plots
- ⌨️ **Just type the size** — least accurate, gets flagged

**2. Walking** — full-screen, minimal, glanceable at arm's length in sunlight:

```
        ┌─────────────────────┐
        │   🟢  GPS Good      │
        │                     │
        │   [ live outline ]  │
        │                     │
        │     420 m walked    │
        │                     │
        │  ⏸ Pause   ✓ Finish │
        └─────────────────────┘
```

- Big green/amber/red accuracy dot. **Cannot start on red.**
- Voice cue on start and finish so he can pocket the phone
- Works entirely offline
- If he stops moving for 3 minutes, ask whether to pause
- Auto-suggest closing the loop when he returns near the start

**3. Correction** — the captured shape drawn over satellite imagery, reduced to a clean four-corner rectangle where the plot is one. Draggable corner handles. Area updates live in compound units as he adjusts.

This step carries more weight than it looks. Measurement says the algorithm alone gets a one-killa plot to about 2%, and a half-killa plot nowhere near it — so on small fields the drag is not a formality, and the UI should say so. See [Units](UNITS_AND_MEASUREMENT.md#️-field-size-dominates-everything).

```
        2 killa 3 kanal 8 marla
      [ satellite + draggable outline ]
        Looks wrong? Drag the corners.
              [ Confirm ]
```

**4. Name it** — suggestions in his language: *Nehar wala khet*, *Ghar ke peeche*, *Vadda khet*. Plus crop currently sown.

**5. Saved.** Never measured again.

---

## Flow 3 — Farmer books a job

```
Home → Pick field → Pick work → When → Rate → Confirm → Matching → Accepted → Track → Complete → Rate
```

**1. Pick field** — cards showing a satellite thumbnail, the name, and the area. Two taps from here on for any repeat booking.

**2. Pick work** — illustrated grid, seasonally reordered. In April, harvesting is first. In November, sowing and stubble management. In January, orchard spraying.

**3. When** — **Now** / **Today** / **Tomorrow** / **Pick a date**. Then a rough window: morning, afternoon, evening.

**4. Rate** — shows the going rate nearby:

```
  Wheat harvesting · 2 killa 3 kanal
  Typical rate near you   ₹1,100 – ₹1,300 / killa

  Estimated total         ₹2,668
  Travel (beyond 5 km)    ₹200
  ─────────────────────────────
  Approximate             ₹2,868

  Final amount agreed with the captain.
```

The word **approximate** must be visible. Over-promising a price is how trust dies.

**5. Confirm** → request goes out.

**6. Matching** — live, honest, never a spinner alone:

```
  Sent to 6 captains nearby
  ● Jaspal S. — 3 km — waiting
  ● Ramesh K. — 7 km — waiting
  ○ Sukhdev — 11 km — no reply
```

**7. Accepted** — captain's name, photo, machine photo, rating, distance, **and a call button.** He will call. That is fine and expected.

**8. Track** — captain's live position, queue position, and revised ETA. *"You are 3rd today. Expected around 2 pm."*

**9. Complete** — captain marks done with photos. Farmer confirms the amount and payment mode (cash / UPI / pending). Both rate each other.

---

## Flow 4 — Captain receives a job

Must be answerable in under 10 seconds, one-handed, possibly from a tractor seat.

**The ping** — loud custom sound, full-screen, wakes the device, persists like an incoming call.

```
        ┌──────────────────────────┐
        │   NEW WORK  ·  0:42      │
        │                          │
        │   Wheat harvesting       │
        │   2 killa 3 kanal        │
        │   Village Roshan Wala    │
        │   6 km away              │
        │                          │
        │   Approx  ₹2,868         │
        │                          │
        │   ✗ Decline   ✓ ACCEPT   │
        └──────────────────────────┘
```

Everything he needs to decide: what, how big, where, how far, how much. Nothing else. A visible countdown, then it moves to the next captain.

**After accepting** — the job enters his queue. He can reorder it, and the app suggests a geographically sensible order. Navigate, call the farmer, start, and complete — each one tap.

---

## Flow 5 — Migrant captain arrives

```
Toggle Travelling Mode → Set location + dates → Set rate → Go live → Bookings arrive
```

**Travelling mode** asks three things:

```
  Where are you now?          [ 📍 Use my location ]
  How long are you staying?   [ 5 days ]
  Where next?  (optional)     [ Fazilka → Muktsar → Moga ]
```

The moment he goes live, every farmer within his radius sees a **"Combine available now"** banner on their home screen. If he declared a forward route, farmers in those districts can pre-book before he arrives.

His ratings from every previous district travel with him — he has no local reputation, so portable reputation is what makes him bookable on day one.

---

## Flow 6 — Farmer lends his own machine

Reached from *My Machines* on a farmer account. Same registry as captain onboarding, but the default is **"with operator only"** — Balwinder lends himself along with the machine.

Bare rental (implement leaves without him) is **v1.5**: it needs deposits, condition photos at handover and return, and a dispute process that doesn't exist yet.

---

## Cross-cutting rules

| Rule | Why |
|---|---|
| Call button on every job screen | The phone call is not a failure of the app. It's how business is done here. |
| Every destructive action confirms twice | Cancelling in peak week is expensive for both sides. |
| Every screen works at 2G | Skeletons, cached data, no blocking spinners. |
| Every number in local units | Never a raw decimal, never square metres. |
| Every job action queues offline | He is standing in a field with no signal. It must still work. |
