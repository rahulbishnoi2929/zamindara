# Technical Architecture

Chosen under one dominant constraint: **a solo, non-specialist founder must be able to build and maintain all of it.**

---

## The stack

| Layer | Choice | Why |
|---|---|---|
| Mobile | **React Native + Expo** (Android only) | One codebase, managed builds, OTA updates, no Android Studio |
| Backend + DB | **Supabase** — Postgres 15 + **PostGIS 3** | Geospatial is the product. See below. |
| Auth | Supabase Auth, **phone OTP** | Farmers have no email. Phone number *is* identity. |
| SMS | MSG91 or Twilio | MSG91 is cheaper and DLT-compliant for India |
| Maps | Google Maps via `react-native-maps` | Best satellite imagery over rural Punjab |
| Push | Expo Notifications → FCM | The captain's job ping |
| Realtime | Supabase Realtime | Job status, live captain position |
| Admin | **Next.js on Vercel** | Founder's ops console |
| i18n | `i18next` | Punjabi (Gurmukhi), Hindi, English |
| Language | **TypeScript everywhere** | App, admin, edge functions, DB types |

### Why PostGIS and not Firebase

Zamindara is a geospatial app with a marketplace on top. Every core question is a geometry question, and PostGIS answers each in one line:

| Question | PostGIS |
|---|---|
| How big is this field? | `ST_Area(boundary)` |
| Which captains are within range? | `ST_DWithin(...)` |
| How far, for the travel charge? | `ST_Distance(...)` |
| Is this walked track a valid polygon? | `ST_IsValid(...)` |

**Firestore cannot store a polygon at all.** Field boundaries would become plain coordinate arrays, and all of the above would be reimplemented by hand in the client — including area, the number that sets the price and that a farmer must not be able to tamper with.

Firebase wins on offline, which works out of the box. That is one problem, and it is easier to solve manually than to reimplement computational geometry.

### Why TypeScript everywhere

One person. Mobile app, admin dashboard, server functions and database types are the same language, and Supabase generates TS types directly from the schema — so a column rename becomes a compile error rather than a production bug. A Flutter + Python + React stack would be a better team choice and a much worse solo one.

---

## Shape of the system

```
┌──────────────────┐     ┌──────────────────┐
│  Farmer app      │     │  Captain app     │
│  (Expo / RN)     │     │  (Expo / RN)     │
└────────┬─────────┘     └────────┬─────────┘
         │        same binary,    │
         │        role-switched   │
         └───────────┬────────────┘
                     │  HTTPS + WebSocket
         ┌───────────▼────────────┐
         │       Supabase         │
         │  Postgres + PostGIS    │
         │  Auth · Realtime       │
         │  Storage · Edge Fns    │
         └───────────┬────────────┘
                     │
      ┌──────────────┼───────────────┐
      │              │               │
  ┌───▼───┐    ┌─────▼─────┐   ┌─────▼─────┐
  │  FCM  │    │ Google    │   │  MSG91    │
  │ push  │    │ Maps      │   │  SMS OTP  │
  └───────┘    └───────────┘   └───────────┘

         ┌────────────────────────┐
         │  Admin console         │
         │  Next.js on Vercel     │
         └────────────────────────┘
```

**One app binary, two experiences.** Not two apps. A user with `role = 'both'` toggles between them, which is essential — a farmer with an idle tractor is a supplier too.

---

## The dispatch engine

A Supabase Edge Function, triggered when a job moves to `searching`.

**1. Find eligible captains** — the query in [Data Model](DATA_MODEL.md#core-geospatial-queries). Filters on: online, verified, offers this service, has the machine, and the field is inside his service radius.

Owned machines qualify for immediate jobs. **Arrangeable machines qualify only when the job is scheduled far enough ahead to clear their lead time** — the owned/arrangeable split from the PRD, enforced in the query.

**2. Score and rank**

```
score = (distance × 0.4)
      + (rating × 0.3)
      + (queue load × 0.2)
      + (acceptance history × 0.1)
```

Distance dominates. A tractor moving 15 km burns diesel and an hour, so a nearby captain is genuinely better for everyone.

**3. Broadcast** — v1 sends to the **top 5 simultaneously**, first to accept wins. Sequential offers (Uber-style) are fairer to captains but too slow when a farmer's crop is shattering in the field. Revisit once liquidity exists.

**4. Timeout** — 90 seconds, then the next 5. After three rounds with no acceptance, notify the farmer and offer to widen the radius or reschedule.

**5. On acceptance** — assign, cancel other dispatches, notify everyone, compute queue position and ETA.

---

## Offline strategy

He is standing in a field. There is no signal. It must still work.

**Deliberately not building a sync engine.** Three targeted measures cover almost all real pain:

| What | How |
|---|---|
| **Boundary walk** | Fully offline. GPS needs no network. Track written to `expo-sqlite` as it's recorded, uploaded when connectivity returns. A dropped signal must never lose a farmer's walk. |
| **Job actions** | Accept / start / complete queue in a local outbox with retry and exponential backoff. Idempotency keys so a retry can't double-apply. |
| **Reads** | Cache the captain's queue and the farmer's fields locally. The app always opens to something, never a spinner. |

If sync complexity grows past this, **PowerSync** integrates with Supabase and handles it properly — but it is not a v1 problem.

---

## Notifications

The job ping is the most important notification in the product. It must behave like an incoming call, not a WhatsApp message.

- Dedicated Android channel, **max importance**, custom loud sound
- Full-screen intent so it wakes and covers the lock screen
- Accept and Decline as notification actions — no app launch needed
- Escalate: if unanswered in 30 seconds, ring again
- Respect a captain's declared working hours; nothing at midnight unless he's marked available

Everything else (status changes, ratings, reminders) is ordinary priority.

---

## Location tracking

Only while a captain is online or on an active job. Never otherwise — battery is a real reason people uninstall.

| State | Interval |
|---|---|
| Offline | none |
| Online, idle | 5 minutes |
| Job accepted, en route | 30 seconds |
| Job in progress | 2 minutes |

Uses `expo-location` background tasks, batched uploads, and a distance filter so a stationary machine stops reporting. Foreground service notification is mandatory on modern Android, and the app must explain plainly *why* it tracks — a captain who doesn't understand it will disable it.

---

## Cost projection

| Service | Launch | At ~1,000 users |
|---|---|---|
| Supabase | Free | $25/mo (Pro) |
| Vercel | Free | Free |
| Expo | Free | Free |
| Google Maps | Free credit | ~$0–20/mo |
| SMS OTP | ~₹0.15/SMS | ~₹1,500/mo |
| Play Store | $25 one-time | — |

**Season one runs at roughly ₹0–3,000/month.** Doing the geometry locally and using straight-line distance means no paid routing or geoprocessing API is needed at launch.

---

## Distance and travel charge

Road distance APIs cost money. For a 5 km threshold, precision is unnecessary:

```
road_km ≈ ST_Distance(captain, field) / 1000 × 1.3
```

The 1.3 factor approximates road winding and is accurate enough for a surcharge tier. Calibrate against real trips in season one; upgrade to a routing API only if disputes appear.

---

## Repository layout

```
zamindara/
├── apps/
│   ├── mobile/          # Expo — farmer + captain
│   └── admin/           # Next.js ops console
├── packages/
│   ├── units/           # ⭐ area conversion + compound formatting
│   ├── types/           # generated from Supabase schema
│   └── shared/          # pricing, validation, constants
├── supabase/
│   ├── migrations/
│   ├── functions/       # dispatch, notify, pricing
│   └── seed/            # machine types, services, Fazilka villages
└── docs/
```

`packages/units` is small and is the most safety-critical code in the repository. **It gets full unit test coverage before anything else does** — every conversion, every compound-format edge case, every rounding boundary. A bug there overbills a farmer.

---

## Build order

1. Supabase schema, PostGIS enabled, RLS policies, seed data
2. `packages/units` + its test suite
3. Phone OTP auth and profile
4. **Captain onboarding and machine registry** — supply first
5. Field boundary walk, correction, satellite confirmation
6. Job posting and the dispatch engine
7. Captain queue, push notifications, job lifecycle
8. Ratings
9. Migrant/travelling mode
10. Admin console

Steps 1–4 are the founder's first month. Nothing else matters until captains are on the platform.
