-- The one row the app asks about itself.
--
-- There is no Play Store. An APK is installed by hand on a captain's phone
-- and stays there until someone installs another one, so old versions live
-- on handsets for weeks. Two consequences the app has to handle:
--
--   * it must be able to say "there is a newer one, here it is";
--   * and the server must be able to refuse a version too old to be safe,
--     without waiting for anybody to notice.
--
-- Over-the-air updates (entry 37) cover JavaScript changes. This row covers
-- the other kind — a new native build — which OTA deliberately cannot reach.
--
-- One row, global, read by everyone. It is not regional: a version is a
-- version everywhere. The switches in Stage 3 belong here too when they
-- arrive, which is why the table is named for configuration rather than for
-- versions.

create table public.app_config (
  -- Single-row table. The constraint is the point: there is one
  -- configuration, and a second row would mean two answers to the same
  -- question with nothing to choose between them.
  id                         boolean primary key default true,

  -- What a phone should be running, and where to get it. The URL is
  -- nullable because the row is useful before there is anywhere to host an
  -- APK — the app then says a version exists without offering a download.
  latest_version             text not null,
  latest_apk_url             text,

  -- Below this, the app stops and asks to be updated. Separate from
  -- latest_version on purpose: most new versions are a suggestion, and
  -- only a few are a requirement.
  minimum_supported_version  text not null,

  -- Shown to the captain so an update is a sentence, not a number. Three
  -- languages, like every other string a user reads.
  update_note_pa             text,
  update_note_hi             text,
  update_note_en             text,

  updated_at                 timestamptz not null default now(),

  constraint app_config_single_row check (id),
  -- Dotted numbers only. A malformed version compares as nothing sensible
  -- and would either nag every phone forever or lock them all out.
  constraint app_config_latest_semver
    check (latest_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  constraint app_config_minimum_semver
    check (minimum_supported_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$')
);

alter table public.app_config enable row level security;

-- Readable by anyone, signed in or not. A phone has to be able to learn it
-- is too old to sign in *before* it signs in, or the lockout is a dead end.
create policy app_config_read on public.app_config
  for select to anon, authenticated
  using (true);

-- No insert, update or delete policy, deliberately. This row is changed
-- from the Supabase dashboard, which runs as the service role and bypasses
-- RLS. Nobody holding an app's anon key can touch it — and the anon key
-- ships inside every APK.

create trigger app_config_touch
  before update on public.app_config
  for each row execute function public.touch_updated_at();

comment on table public.app_config is
  'Single row. What version phones should run, and the floor below which they must stop. Changed from the dashboard; no client can write it.';

-- Seeded with the version in app.json at the time of writing, and a floor
-- of 0.0.0 so no existing install is locked out by the act of adding this.
insert into public.app_config (
  latest_version, minimum_supported_version, update_note_en
) values (
  '0.1.0', '0.0.0', 'First build.'
);
