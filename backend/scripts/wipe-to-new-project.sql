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
-- Every Auth table, not just users: a new project has no sign-in history
-- either, and the end-to-end test's logins leave audit rows that would
-- otherwise collide with the restored ones.
do $$
declare t text;
begin
  for t in select format('%I.%I', schemaname, tablename) from pg_tables
           where schemaname = 'auth' and tablename <> 'schema_migrations'
  loop
    execute 'truncate ' || t || ' cascade';
  end loop;
end $$;
