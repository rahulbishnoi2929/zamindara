-- The app pushes a field with an upsert (INSERT ... ON CONFLICT DO UPDATE),
-- so a push interrupted after the server saved it replays harmlessly. For
-- an upsert, Postgres checks the *proposed* row against the read policy
-- too — and fields_read asks can_see_field(id), which looks the field up by
-- id in the table, where a row not yet inserted is not. So every field push
-- from every phone was refused. Found by the end-to-end test, 20 Nov 2026.
--
-- This grants nothing new: an owner could already read his own fields
-- through can_see_field. It states the same thing in a form that can be
-- checked against a row before it exists. Permissive policies combine with
-- OR, so captains' access through can_see_field is unchanged.

create policy fields_read_own on public.fields
  for select to authenticated
  using (owner_id = auth.uid());
