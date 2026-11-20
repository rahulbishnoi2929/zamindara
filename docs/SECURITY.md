# Security: every endpoint, and what guards it

Reviewed 20–21 Nov 2026 (migration 0040). **`backend/supabase/tests/26_lock_down.test.sql` enforces the rules below on every push.** A migration that breaks one fails CI, both before and after a backup-and-restore.

## Standing rules (checked by test 26)

- Every table in `public` has row level security.
- Signed out (`anon`), no function in `public` can be called and no policy allows a write. The app reads only `app_config` before sign-in.
- Every `SECURITY DEFINER` function pins its `search_path`.
- Phone numbers (`profiles.phone`) and captain locations (`captains.current_location`, `base_location`) can't be read directly by any signed-in user.
- A direct write from the app changes only what that person decides:
  - **Farmer:** notes, an area dispute, his fields, his profile.
  - **Captain:** moving his job forward, the amount paid, his machine on a job, declining an offer, his machines, rates, route and location.
  - **Never from the app:** identity, area, price, verification and ratings. Those change only inside server functions.

## Tables

| Table | Read | Write from the app |
|---|---|---|
| `profiles` | own; the other side of a shared job; verified captains; staff. **Never the phone column.** | own row. Phone and placeholder are kept as they were. |
| `captains` | verified captains, own, staff. **Never the location columns.** | own row. Verification, ratings and job count are never his. |
| `captain_machines`, `captain_services` | own; active ones of verified captains | own |
| `captain_route_stops` | own; staff | own |
| `fields` | owner; the captain of a job on it; staff | owner. Area and centroid are derived by trigger. |
| `jobs` | the two parties; staff | Insert: farmer, born `searching`, area taken from the field, no price. Update: guarded column by column (`guard_job_client_write`). |
| `job_dispatch` | the captain offered; the job's farmer; staff | the captain may only decline |
| `job_events` | the two parties | none (trigger) |
| `job_locations` | nobody directly | nobody directly (functions only) |
| `ratings` | everyone signed in | a party to a completed job, once |
| `push_tokens` | own | own |
| `app_config` | everyone, signed out too | none |
| `admins` | nobody directly | none |
| `regions`, `machine_types`, `services` | everyone signed in | none |

`metrics.*` views are not exposed by the API and are not granted to phones.

## Functions a phone can call

| Function | Who | Check |
|---|---|---|
| `accept_job` | a captain | offered the job; first wins |
| `cancel_job`, `release_job` | the farmer / the captain | their own job, legal state |
| `dispatch_job`, `widen_search`, `repeat_ping_due` | the job's farmer | own job; `auto_dispatch` switch |
| `claim_open_offers` | a captain | lists only to himself, only work he is eligible for |
| `expire_stale_jobs` | anyone signed in | time-based; no caller choice |
| `job_size_floor`, `rate_guidance` | signed in | own job / aggregates only |
| `available_nearby` | the field's owner | counts only |
| `report_job_location` | the job's captain | while en route or working |
| `job_captain_location` | the job's farmer | while live, under 30 min old |
| `my_job_contacts` | either party | the other side's number, live jobs only |
| `captain_create_job`, `captain_retrace_field` | a verified captain | services he offers; his own job |
| `claim_profile` | signed in | matches the number Auth verified |
| `is_admin` | signed in | about himself |
| `founder_*`, `pending_captains`, `set_captain_verification`, `staff_job_phones` | staff | `require_staff` / `is_admin` |

**Server-only, not callable from a phone:** `eligible_captains`, `quote_job` and `road_km` (each would give away a captain's distance), `dispatch_job_offer`, `accept_job_claim`, `pick_machine`, `assign_job`, `create_declared_job`, `farmer_by_phone`, and all trigger functions.

## Edge function `notify-dispatch`

- The caller must be signed in, and the job is read with the caller's own rights.
- Captain pings: only the job's farmer can trigger them, and only for offers the server made or marked to ring again in the last 2 minutes, so calling it in a loop rings nobody again.
- "Your job is booked": only the job's captain can trigger it, and only within 10 minutes of acceptance.
- Push tokens are read with the service key inside the function and never leave it.

## Known, accepted

- Ratings are readable by every signed-in user, as public reputation.
- A verified captain's name and village are readable by every signed-in user, as a business listing.
- `profiles` and `captains` use column grants: **a new column on either table is unreadable to phones until it is added to the grant in a migration.** That is the safe default, and test 26 will not notice a missed grant; the app will.
