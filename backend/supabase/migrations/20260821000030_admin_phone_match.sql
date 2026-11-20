-- Staff are found by phone number, and the two sides wrote it differently.
--
-- profiles.phone is stamped from the Auth session, which carries the
-- country code (919876543210). SETUP.md and ONBOARDING_A_CAPTAIN.md both
-- tell the founder to insert his number into admins as ten digits. They
-- never matched, so the founder was never staff — and with no staff, no
-- captain can be verified, and an unverified captain is never offered work.
--
-- Compared on the last ten digits: an Indian mobile number is ten digits,
-- and either way of writing it now works. Same body otherwise.
--
-- ponytail: last-ten-digits is an India-only rule. A second country means
-- storing E.164 everywhere instead.
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
    join public.profiles p on right(p.phone, 10) = right(a.phone, 10)
    where p.id = auth.uid()
  );
$fn$;
