-- When the work happened is the server's answer, not the phone's.
--
-- `accepted_at` was already server-set, inside accept_job. `started_at` and
-- `completed_at` were not: they travelled up from the handset in
-- jobEditsToWire, stamped with `Date.now()`.
--
-- A phone's clock is whatever it is. It drifts, it is wrong after a battery
-- pull, and it is settable by the person holding it. These two columns say
-- when a machine entered a field and when it left, which is what a farmer
-- and a captain argue about when they disagree about a day's work — so the
-- one thing they must not be is the word of one of the two parties.
--
-- The rule is the same for all three columns: each is written only by the
-- transition that earns it, and is frozen at every other moment. Freezing is
-- the half that matters. Without it, a job syncing hours later still carries
-- the handset's `started_at` up with it on the *completion* write, and the
-- server dutifully stores it.
--
-- ⚠️ One consequence that is yours to accept or reject. A captain who
-- finishes at 14:00 in a field with no signal, and whose phone syncs at
-- 19:00, now has completed_at = 19:00. The server records when it was told,
-- not when it happened. The alternative is to trust the handset's clock for
-- that gap, which is exactly what this removes. Keeping both — a claimed
-- time and a recorded time — is the real answer if offline gaps turn out to
-- be long and common; that is a column, a screen and a dispute rule, so I
-- have not guessed at it.

create or replace function public.stamp_job_times()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.status is distinct from old.status then
    -- Entering the field. Only on the way in: a captain who taps twice, or
    -- a status that is re-set, must not restart the clock on his own work.
    new.started_at := case
      when new.status = 'in_progress' and old.status <> 'in_progress' then now()
      else old.started_at
    end;

    new.completed_at := case
      when new.status = 'completed' and old.status <> 'completed' then now()
      else old.completed_at
    end;

    -- accepted_at belongs to accept_job (now()) and release_job (null).
    -- Those two write it in the same statement that moves the status, so
    -- their value is kept; every other transition leaves it where it was.
    new.accepted_at := case
      when old.status = 'searching' and new.status = 'accepted' then new.accepted_at
      when new.status = 'searching' then new.accepted_at
      else old.accepted_at
    end;

    return new;
  end if;

  -- No status change, so none of them may move. This is what stops a later
  -- edit — an offline job syncing hours afterwards, or a handset simply
  -- asserting a time — from rewriting when the work happened.
  new.accepted_at  := old.accepted_at;
  new.started_at   := old.started_at;
  new.completed_at := old.completed_at;

  return new;
end;
$fn$;

comment on function public.stamp_job_times is
  'Server clock for when work was accepted, started and finished. A phone''s clock is one party''s word, and these columns are what a dispute turns on.';

-- Trigger order does not matter here. Postgres fires BEFORE row triggers in
-- name order, so this runs before jobs_transition_guard — and the guard
-- raises on an illegal move, which aborts the whole statement, so nothing
-- this trigger did can survive a transition the guard rejects.
create trigger jobs_stamp_times
  before update on public.jobs
  for each row execute function public.stamp_job_times();
