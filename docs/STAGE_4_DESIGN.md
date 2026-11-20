# Stage 4 — design notes

One short note per item. Approved by the founder on 20 Nov 2026 ("yes do it and start building"), to be built in this order: **4.1 + 4.2 together** (4.2 needs 4.1), then 4.4, 4.5, 4.6, 4.3, 4.7, 4.8. Each item lands as its own commit with migrations, pgTAP tests and an end-to-end step, and stops if it turns out bigger than half a day.

Rules that hold for every item: schema changes are additive; nothing a shipped APK reads is renamed or removed; the server decides money, area and eligibility; every founder power is checked in the database, with a test proving a normal account is refused.

---

## 4.1 Farmer profiles that exist before sign-up

**Problem.** A farmer who rings the founder has no account. The founder still needs to book work for him, and when the farmer later installs the app his history should be waiting.

**Brief's suggestion:** decouple `profiles.id` from `auth.users`. **Not done that way.** Every RLS policy and function compares a row's owner with `auth.uid()`. Decoupling means a lookup in all of them, which is about 40 policy and function rewrites and a large security surface.

**Design: a placeholder that is re-keyed on claim.**
- `profiles.placeholder boolean`. The founder creates one with name, phone and village through `founder_create_farmer()`. It gets a fresh id and no sign-in account.
- The foreign key from `profiles.id` to `auth.users` is replaced by a trigger with the same effect: deleting an account deletes its profile. A placeholder has no account, so a hard FK cannot hold.
- Every FK that points at `profiles.id` gains `ON UPDATE CASCADE`.
- **Claim.** On sign-in the app calls `claim_profile()`. If the signed-in account has no profile, and a placeholder has the same phone (the number Auth verified by OTP, read on the server, never sent by the phone), the placeholder's id is updated to the account's id. One statement, and every field, job and rating follows through the cascade. RLS is untouched.
- **Who can:** only staff create placeholders. Only the owner of the matching, OTP-verified phone can claim one.

**Not covered:** two placeholders for one number (phone is unique, so it cannot happen), and claiming after the farmer has already signed up separately (then there are two people, and the founder merges by hand — rare, recorded).

## 4.2 Founder dispatch mode

**Problem.** Automatic dispatch is off. The founder matches by hand, by inserting rows in Studio, which only works for jobs farmers posted themselves.

**Database:** staff-only functions, each refusing a non-staff caller with 42501 (tested):
- `founder_create_job(farmer, service, area, lat, lng, date, window, immediate)`. A phoned-in farmer has no traced field, so this creates a **declared** field: a square of the stated area centred on a pin the founder drops on the map. It is marked `declared`, and the captain re-traces it on arrival (4.3). Then the job is created as `searching`.
- `founder_assign(job, captain)`. Puts the job straight into his queue (`accepted`), priced by the same `quote_job` as a normal accept.
- `founder_advance(job, status, final_amount)`. Moves the job along the same transition rules as everyone else, and records the money.
- Staff can read all jobs, fields, profiles and captains (new `*_read_staff` policies). That is a deliberate widening, to staff only, and tested.

**App:** a "Founder" screen, visible only to staff, like Verify captains.

```
┌──────────────────────────────┐
│ ← Founder                     │
│ [ + New job for a farmer ]    │  56 px, the one main action
│                               │
│ Open jobs                     │
│ ┌──────────────────────────┐  │
│ │ ਕਣਕ ਵਢਾਈ · 2 ਕਿੱਲੇ          │  │
│ │ Arniwala · ਕੱਲ੍ਹ ਸਵੇਰ        │  │
│ │ Gurmeet 98765 43210       │  │
│ │ [Assign]  [Share ↗]       │  │
│ └──────────────────────────┘  │
└──────────────────────────────┘

New job:  phone → name → village → work type (icons)
          → area: [2] killa [3] kanal → when → pin on map → [Create]
Assign:   list of verified captains, nearest first → tap one
Job card after assignment: [On the way] [Started] [Done + amount]
```

**Share:** React Native's built-in share sheet, so no new dependency. The text is Punjabi by default: work type, area in local units, village, time and the farmer's phone. The founder sends it to the captain on WhatsApp.

## 4.3 Captain-created jobs

A captain books a job by phone and logs it himself. It reuses 4.2's declared-field path. On arrival he re-traces the field: the boundary is replaced, the area recomputed by the server, and the method becomes `drawn`. Money is recorded through the normal completion step. Farmer notified: a push if the farmer has an account, otherwise nothing (no SMS provider). Needs `captain_create_job()`, limited to the captain's own services and checked server-side.

## 4.4 Area disputes

`jobs.area_disputed_at timestamptz` and `area_dispute_by`, set by a one-tap "area is wrong" on a job, by either party, once. Also `fields.papers_area_sqm`, an optional "area on my papers". It is stored and never used for pricing. A `metrics.area_disputes` view fills the gap left in 3.3.

## 4.5 Minimum job size per service

`captain_services.min_area_sqm`, nullable. `eligible_captains` skips captains whose minimum is above the job's area. The farmer sees "some captains take only N killa and up" when nobody is eligible for that reason.

## 4.6 Jobs reference a specific machine

`jobs.machine_id`, nullable and additive. It is set on accept (the captain's first active machine of the right type) or by the founder. A captain with two combines has two queues: his queue groups by machine, and dispatch treats each idle machine as capacity.

## 4.7 Route stops instead of `planned_route text[]`

A new `captain_route_stops (captain, region, from_date, to_date)` table. `planned_route` stays and is no longer written, because a shipped APK might read it. Matching for migrant combines uses the stop covering the job date.

## 4.8 Scheduled jobs as open offers

A job for a later date becomes an **open offer**: visible for hours, matched on base location or a route stop covering the date, with **no loud ping**. It is listed for eligible captains, and the first to accept wins as now. The 90-second instant dispatch stays for "now" jobs only. This needs `dispatch_mode` on jobs and a separate listing function. It is the largest item, so it goes last.
