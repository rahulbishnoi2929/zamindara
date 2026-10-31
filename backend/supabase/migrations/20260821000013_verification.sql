-- Verifying captains.
--
-- Without this there is no path to 'verified' at all: the column defaults to
-- 'pending', every dispatch query requires 'verified', and the RLS policy
-- correctly stops a captain promoting himself. Nothing else could promote him
-- either, so every captain onboarded would have been invisible to farmers and
-- never offered a single job.
--
-- In season one the founder verifies personally — he is standing in the yard,
-- looking at the machine. That is stronger evidence than any document check,
-- and it is why this is a one-tap action in the app rather than a console.

-- ---------------------------------------------------------------------------
-- Who may verify.
--
-- A table rather than a JWT claim or an env var: one obvious place to look,
-- and no chance of the app and the database disagreeing about who is staff.
-- Deny-all under RLS; only SECURITY DEFINER functions read it.
-- ---------------------------------------------------------------------------
create table public.admins (
  phone      text primary key,
  note       text,
  created_at timestamptz not null default now(),

  constraint admins_phone_format check (phone ~ '^[0-9]{10,15}$')
);

alter table public.admins enable row level security;
-- No policies on purpose. Nothing reaches this table except definer functions
-- and the service role.

comment on table public.admins is
  'Staff phone numbers. Seeded manually; see SETUP.md. No RLS policies by design.';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
    from public.admins a
    join public.profiles p on p.phone = a.phone
    where p.id = auth.uid()
  );
$fn$;

-- ---------------------------------------------------------------------------
-- The captains waiting to be let in.
--
-- Returns enough to recognise a man and his machine in a yard, and nothing
-- more. Admin-only: a pending captain is not public, and a farmer has no
-- business browsing unverified supply.
-- ---------------------------------------------------------------------------
create or replace function public.pending_captains()
returns table (
  captain_id    uuid,
  full_name     text,
  phone         text,
  village       text,
  machine_count integer,
  created_at    timestamptz
)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    c.profile_id,
    p.full_name,
    p.phone,
    p.village,
    (select count(*)::integer from public.captain_machines m
      where m.captain_id = c.profile_id and m.is_active),
    c.created_at
  from public.captains c
  join public.profiles p on p.id = c.profile_id
  where c.verification = 'pending'
    and public.is_admin()
  order by c.created_at;
$fn$;

-- ---------------------------------------------------------------------------
-- Let a captain in, or keep him out.
--
-- Records who decided and when, which the captains_verified_has_actor
-- constraint requires and a dispute later will want.
-- ---------------------------------------------------------------------------
create or replace function public.set_captain_verification(
  p_captain_id uuid,
  p_status     public.verification_status
)
returns public.verification_status
language plpgsql
security definer
set search_path = public
as $fn$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if not public.is_admin() then
    raise exception 'only staff can verify captains' using errcode = '42501';
  end if;

  -- 'pending' is the default and means "not yet looked at". Setting it back
  -- would erase who decided, so the allowed moves are the decisions only.
  if p_status not in ('verified', 'rejected', 'suspended') then
    raise exception 'verification must be verified, rejected or suspended'
      using errcode = '22023';
  end if;

  update public.captains
  set verification = p_status,
      verified_by  = me,
      verified_at  = now()
  where profile_id = p_captain_id;

  if not found then
    raise exception 'no such captain' using errcode = 'P0002';
  end if;

  return p_status;
end;
$fn$;

comment on function public.set_captain_verification is
  'Staff-only. The founder verifies in person in season one, standing next to the machine.';
