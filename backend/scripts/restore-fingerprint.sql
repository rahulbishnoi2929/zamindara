-- What must survive a backup and restore. Printed before and after; the
-- two outputs are compared byte for byte.
select 'auth.users', count(*)::text from auth.users
union all select 'profiles', count(*)::text from public.profiles
union all select 'fields', count(*)::text from public.fields
union all select 'jobs', count(*)::text from public.jobs
union all select 'job_events', count(*)::text from public.job_events
union all select 'regions', count(*)::text from public.regions
union all select 'services', count(*)::text from public.services
union all select 'field area (trigger-derived)', round(sum(area_sqm)::numeric, 2)::text from public.fields
union all select 'boundary', md5(string_agg(extensions.st_astext(boundary), ',' order by id)) from public.fields
union all select 'farmer phone', phone from auth.users where id = '99999999-0000-0000-0000-000000000001'
union all select 'tables with RLS', count(*)::text from pg_tables where schemaname = 'public' and rowsecurity
union all select 'policies', count(*)::text from pg_policies where schemaname = 'public'
union all select 'functions', count(*)::text from pg_proc where pronamespace = 'public'::regnamespace
-- Who may call and read what. A restore that brings the rows back but loses
-- a REVOKE turns a locked function into one anyone can call; the first CI
-- run of this proof caught exactly that, with every count above matching.
-- Effective, not raw: who can actually call it. Raw ACL text differs
-- harmlessly when a grant is implied by PUBLIC rather than written out.
union all select 'execute ' || p.oid::regprocedure::text,
       concat_ws(' ',
         case when has_function_privilege('anon', p.oid, 'execute') then 'anon' end,
         case when has_function_privilege('authenticated', p.oid, 'execute') then 'authenticated' end,
         case when has_function_privilege('service_role', p.oid, 'execute') then 'service_role' end)
  from pg_proc p where p.pronamespace = 'public'::regnamespace
union all select 'access ' || r.rolname || ' ' || c.relname,
       concat_ws(' ',
         case when has_table_privilege(r.oid, c.oid, 'select') then 'select' end,
         case when has_table_privilege(r.oid, c.oid, 'insert') then 'insert' end,
         case when has_table_privilege(r.oid, c.oid, 'update') then 'update' end,
         case when has_table_privilege(r.oid, c.oid, 'delete') then 'delete' end)
  from pg_class c cross join pg_roles r
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm')
    and r.rolname in ('anon', 'authenticated')
union all select 'anon-callable functions', coalesce(string_agg(p.proname, ' ' order by p.proname), 'none')
  from pg_proc p where p.pronamespace = 'public'::regnamespace
   and has_function_privilege('anon', p.oid, 'execute') and p.prosecdef
-- The metrics views read past RLS; a restore must not open them to phones.
union all select 'metrics readable by phones',
       (has_schema_privilege('anon', 'metrics', 'usage') or has_schema_privilege('authenticated', 'metrics', 'usage'))::text
union all select 'metrics views', count(*)::text from pg_views where schemaname = 'metrics'
order by 1;
