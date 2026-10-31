-- Push tokens.
--
-- Until now the job ping was local: a captain on a second phone learned about
-- work only by opening the app. That is the opposite of the promise — the
-- ping is supposed to behave like an incoming call, reaching him on a machine
-- in the noise without him looking for it.
--
-- The token itself is the primary key, not the profile. A device token is
-- globally unique, and when a phone changes hands the row should follow the
-- device to its new owner rather than leaving a stale duplicate behind — an
-- upsert on the token does that for free. One person may hold several
-- (a second phone, a reinstall), and all of them get the ping.

create table public.push_tokens (
  token      text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  platform   text not null default 'android',
  updated_at timestamptz not null default now(),

  -- Expo's format. Rejecting anything else here stops a malformed token
  -- becoming a silent delivery failure discovered during harvest week.
  constraint push_tokens_expo_format
    check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$'),
  constraint push_tokens_platform check (platform in ('android', 'ios'))
);

create index push_tokens_profile_idx on public.push_tokens (profile_id);

alter table public.push_tokens enable row level security;

-- A device registers and re-registers its own token, and nothing else.
-- Tokens are never readable by another user: they are the address a push is
-- delivered to, and a leaked set of them is a spam channel aimed at captains.
create policy push_tokens_own on public.push_tokens
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create trigger push_tokens_touch
  before update on public.push_tokens
  for each row execute function public.touch_updated_at();

comment on table public.push_tokens is
  'Expo push tokens. Readable only by their owner; the notify-dispatch edge function reads them with the service role.';
