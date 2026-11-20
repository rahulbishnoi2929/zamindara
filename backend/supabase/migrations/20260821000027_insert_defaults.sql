-- Who owns a new row, and which region it belongs to, decided by the server.
--
-- The app never sent owner_id on a field or farmer_id on a job, and the
-- insert policies require both to equal auth.uid(). Every insert from a
-- phone was therefore refused by RLS. pgTAP never saw it — the tests insert
-- with explicit ids — and the end-to-end test against a real database did,
-- on 20 Nov 2026. Defaulting them here, rather than adding them in the app,
-- means the server decides who owns what (a client cannot name someone
-- else: the policy still checks), and every APK already built is fixed.

alter table public.fields alter column owner_id  set default auth.uid();
alter table public.jobs   alter column farmer_id set default auth.uid();

-- Region. Nothing set it either, so every profile and field had none and
-- every per-region number (metrics, guidance, travel rates) was empty.
--
-- A new profile takes the live region when there is exactly one, which is
-- the truth until a second district opens. A field takes its owner's.
--
-- ponytail: "the one live region" stops being an answer at the second
-- district; then a profile's region must come from where he is, chosen at
-- onboarding.
create function public.default_region()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.region_id is null then
    if tg_table_name = 'fields' then
      select p.region_id into new.region_id from public.profiles p where p.id = new.owner_id;
    end if;
    if new.region_id is null and (select count(*) from public.regions where is_live) = 1 then
      select id into new.region_id from public.regions where is_live;
    end if;
  end if;
  return new;
end;
$fn$;

revoke execute on function public.default_region() from public, anon, authenticated;

create trigger profiles_default_region before insert on public.profiles
  for each row execute function public.default_region();
create trigger fields_default_region before insert on public.fields
  for each row execute function public.default_region();
