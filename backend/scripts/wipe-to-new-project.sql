-- CI only. Turn the database back into what a brand-new Supabase project
-- looks like before anything is created in it: an empty public schema with
-- Supabase's standard grants, and no users. That is the target restore.sh
-- is documented for.
drop schema public cascade;
create schema public;
alter schema public owner to pg_database_owner;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
truncate auth.users cascade;
