# Batch B — dispatch rounds and ringing again: design note

20 Nov 2026. Closes the BUILD_PLAN items "timeout escalates to the next five", "three rounds", "no eligible captains → farmer is told, offered a wider radius", and "unanswered in 30 s, ring again".

## What was true before

- `dispatch_job` asked the top five eligible captains. Every later call asked the *same* top five again, and `on conflict do nothing` turned that into nothing.
- Nobody else was ever asked, the offer never expired, and the 90 seconds existed only on the captain's phone.
- Sync runs when the app opens or someone acts, never on a timer, so nothing would have moved a round on anyway.

## Rules (all in the database)

For a **"now" job** (open offers for later days are unchanged: they stand until taken or lapsed):

1. **A round lasts 90 seconds.**
   - When `dispatch_job` is next called, offers older than that are closed as `timed_out` and the next five *not yet asked* are offered.
   - While a round is still open, it does nothing.
   - A captain whose offer timed out can still accept while the job is searching. A late yes still helps the farmer, and first accept still wins.
2. **Three rounds, then stop.**
   - The search is *exhausted* after the third round closes, or sooner if every eligible captain has been asked. `jobs.search_exhausted_at` is set and the farmer is told.
3. **"Ask captains farther away."**
   - The farmer can widen the search by 10 km at a time, up to +30 km beyond each captain's own radius.
   - Each widening allows three more rounds.
   - New farmer-only function: `widen_search(job)`.
4. **Ring again after 30 seconds.**
   - New farmer-only function: `repeat_ping_due(job)`. It marks the current round's unanswered offers as re-pinged, once, when they're 30 seconds old, and returns how many.
   - The app then calls `notify-dispatch`, which rings every pending offer again.
   - The ring is still on the loud or quiet channel the founder's switch sets.

The `auto_dispatch` switch still gates everything. While the founder matches by hand, nothing runs rounds or rings again.

## What moves the clock

**The farmer's app.** While it's open and he has a "now" job still searching, it runs a sync pass every 30 seconds. That is the only new timer, and it stops when the app goes to the background or nothing is searching.

`ponytail:` a farmer who closes the app pauses his own search until he reopens it. The fix is a server timer (`pg_cron` plus `pg_net` calling the push function). It is free on Supabase, but it's a dashboard step for the founder, so it's left for when it's needed.

## Screen change (farmer's job card only)

```
┌───────────────────────────────────┐
│ Wheat harvest        Finding…     │
│ Nehar wala khet · 2.1 killa       │
│ Nobody accepted yet.              │
│ [ Ask captains farther away ]     │   ← after the search is exhausted
└───────────────────────────────────┘
```

## Database

Migration 0038:
- `jobs.search_extra_km` (0–30), `jobs.search_exhausted_at`, `job_dispatch.repinged_at`.
- `eligible_captains` gains `p_extra_km default 0`. Existing callers are unchanged.
- `dispatch_job_offer` is re-declared with the rounds.
- New functions: `widen_search`, `repeat_ping_due`.
- pgTAP test 24.
