-- Real rows for the CI restore proof: a signed-up farmer, his field and a
-- job. Committed, unlike the pgTAP tests, so there is something to back up.
insert into auth.users (instance_id, id, aud, role, email, phone,
                        encrypted_password, email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '99999999-0000-0000-0000-000000000001',
        'authenticated', 'authenticated', 'restore@test.local', '919876500999',
        '', now(), now(), now());

insert into public.profiles (id, phone, full_name, region_id)
values ('99999999-0000-0000-0000-000000000001', '9876500999', 'Restore Singh',
        (select id from public.regions where slug = 'fazilka'));

insert into public.fields (id, owner_id, name, boundary, centroid, area_sqm,
                           capture_method, region_id, confirmed_by_owner)
values ('99999999-0000-0000-0000-0000000000f1', '99999999-0000-0000-0000-000000000001',
        'Toba wala khet',
        extensions.st_geographyfromtext(
          'POLYGON((74.0286 30.4028, 74.0293012 30.4028, 74.0293012 30.4033442, 74.0286 30.4033442, 74.0286 30.4028))'),
        extensions.st_geographyfromtext('POINT(74.0286 30.4028)'),
        1, 'drawn', (select id from public.regions where slug = 'fazilka'), true);

insert into public.jobs (id, farmer_id, field_id, service_id, area_sqm, status, is_immediate)
select '99999999-0000-0000-0000-0000000000a1', '99999999-0000-0000-0000-000000000001',
       '99999999-0000-0000-0000-0000000000f1',
       (select id from public.services where code = 'wheat_harvest'),
       f.area_sqm, 'searching', true
from public.fields f where f.id = '99999999-0000-0000-0000-0000000000f1';
