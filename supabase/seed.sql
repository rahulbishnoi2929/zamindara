-- GENERATED FILE — do not edit by hand.
--
-- Produced from packages/catalog by:
--   npm run gen:seed --workspace @zamindara/catalog
--
-- Editing this file directly reintroduces the divergence between the
-- database and the app that generating it exists to prevent.

-- ---------------------------------------------------------------------------
-- Regions
--
-- All three states share killa/kanal/marla. North Rajasthan qualifies
-- because Ganganagar and Hanumangarh were settled under the same
-- canal-colony system as Punjab. The rest of Rajasthan uses bigha/biswa
-- and is deliberately absent until its district-level bigha is verified.
-- ---------------------------------------------------------------------------
insert into public.regions (slug, name, state, unit_set, default_chain, languages, is_live)
values
  ('fazilka', 'Fazilka', 'Punjab', '{marla,kanal,bigha,killa}', 'killa', '{pa,hi,en}', true),
  ('muktsar', 'Sri Muktsar Sahib', 'Punjab', '{marla,kanal,bigha,killa}', 'killa', '{pa,hi,en}', false),
  ('ferozepur', 'Ferozepur', 'Punjab', '{marla,kanal,bigha,killa}', 'killa', '{pa,hi,en}', false),
  ('bathinda', 'Bathinda', 'Punjab', '{marla,kanal,bigha,killa}', 'killa', '{pa,hi,en}', false),
  ('sirsa', 'Sirsa', 'Haryana', '{marla,kanal,bigha,killa}', 'killa', '{hi,pa,en}', false),
  ('ganganagar', 'Sri Ganganagar', 'Rajasthan', '{marla,kanal,bigha,killa}', 'killa', '{hi,pa,en}', false),
  ('hanumangarh', 'Hanumangarh', 'Rajasthan', '{marla,kanal,bigha,killa}', 'killa', '{hi,pa,en}', false)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Machinery
-- ---------------------------------------------------------------------------
insert into public.machine_types
  (code, name_en, name_pa, name_hi, category, needs_tractor, travel_rate_per_km, sort_order)
values
  ('tractor', 'Tractor', 'ਟਰੈਕਟਰ', 'ट्रैक्टर', 'tillage', false, 40, 10),
  ('rotavator', 'Rotavator', 'ਰੋਟਾਵੇਟਰ', 'रोटावेटर', 'tillage', true, 40, 20),
  ('cultivator', 'Cultivator', 'ਕਲਟੀਵੇਟਰ', 'कल्टीवेटर', 'tillage', true, 40, 30),
  ('disc_harrow', 'Disc harrow (tavi)', 'ਤਵੀ', 'तवी', 'tillage', true, 40, 40),
  ('mb_plough', 'MB plough', 'ਐਮਬੀ ਹਲ਼', 'एमबी हल', 'tillage', true, 40, 50),
  ('sub_soiler', 'Sub-soiler', 'ਸਬ-ਸੌਇਲਰ', 'सब-सॉइलर', 'tillage', true, 45, 60),
  ('laser_leveller', 'Laser leveller', 'ਲੇਜ਼ਰ ਲੈਵਲਰ', 'लेज़र लेवलर', 'tillage', true, 60, 70),
  ('seed_drill', 'Seed drill', 'ਸੀਡ ਡਰਿੱਲ', 'सीड ड्रिल', 'sowing', true, 40, 80),
  ('happy_seeder', 'Happy Seeder', 'ਹੈਪੀ ਸੀਡਰ', 'हैप्पी सीडर', 'sowing', true, 50, 90),
  ('super_seeder', 'Super Seeder', 'ਸੁਪਰ ਸੀਡਰ', 'सुपर सीडर', 'sowing', true, 50, 100),
  ('zero_till', 'Zero-till drill', 'ਜ਼ੀਰੋ ਟਿੱਲ ਡਰਿੱਲ', 'ज़ीरो टिल ड्रिल', 'sowing', true, 45, 110),
  ('ridger', 'Ridger / bed planter', 'ਰਿੱਜਰ', 'रिजर', 'sowing', true, 40, 120),
  ('combine', 'Combine harvester', 'ਕੰਬਾਈਨ', 'कंबाइन', 'harvesting', false, 60, 130),
  ('straw_reaper', 'Straw reaper (toori)', 'ਤੂੜੀ ਵਾਲੀ ਮਸ਼ੀਨ', 'तूड़ी मशीन', 'harvesting', true, 50, 140),
  ('thresher', 'Thresher', 'ਥਰੈਸ਼ਰ', 'थ्रेशर', 'harvesting', true, 45, 150),
  ('baler', 'Baler', 'ਬੇਲਰ', 'बेलर', 'harvesting', true, 50, 160),
  ('cotton_shredder', 'Cotton stalk shredder', 'ਨਰਮਾ ਸ਼ਰੈਡਰ', 'नरमा श्रेडर', 'harvesting', true, 45, 170),
  ('boom_sprayer', 'Boom sprayer', 'ਸਪਰੇਅ ਮਸ਼ੀਨ', 'स्प्रे मशीन', 'spraying', true, 40, 180),
  ('htp_sprayer', 'Orchard sprayer (HTP)', 'ਐਚਟੀਪੀ ਸਪਰੇਅ', 'एचटीपी स्प्रे', 'spraying', true, 40, 190),
  ('trolley', 'Trolley', 'ਟਰਾਲੀ', 'ट्रॉली', 'haulage', true, 35, 200),
  ('jcb', 'JCB / backhoe', 'ਜੇਸੀਬੀ', 'जेसीबी', 'earthmoving', false, 70, 210)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Services
--
-- season_months drives the seasonal reordering of the job grid: harvesting
-- first in April, sowing in November, orchard spraying in January.
-- ---------------------------------------------------------------------------
insert into public.services
  (code, name_en, name_pa, name_hi, machine_type_id, default_unit,
   est_minutes_per_killa, season_months, sort_order)
select v.code, v.name_en, v.name_pa, v.name_hi, mt.id,
       v.unit::public.pricing_unit, v.mins, v.months, v.sort_order
from (values
  ('wheat_harvest', 'Wheat harvesting', 'ਕਣਕ ਦੀ ਵਾਢੀ', 'गेहूँ कटाई', 'combine', 'per_killa', 25, array[4], 10),
  ('paddy_harvest', 'Paddy harvesting', 'ਝੋਨੇ ਦੀ ਵਾਢੀ', 'धान कटाई', 'combine', 'per_killa', 30, array[10,11], 20),
  ('straw_collect', 'Straw collection', 'ਤੂੜੀ ਬਣਾਉਣੀ', 'तूड़ी बनाना', 'straw_reaper', 'per_killa', 35, array[4,5], 30),
  ('baling', 'Baling', 'ਬੇਲ ਬਣਾਉਣੇ', 'बेल बनाना', 'baler', 'per_killa', 30, array[4,5,10,11], 40),
  ('ploughing', 'Ploughing', 'ਵਾਹੀ', 'जुताई', 'mb_plough', 'per_killa', 45, array[5,6,10], 50),
  ('rotavator_work', 'Rotavator', 'ਰੋਟਾਵੇਟਰ', 'रोटावेटर', 'rotavator', 'per_killa', 30, array[5,6,10,11], 60),
  ('laser_levelling', 'Laser levelling', 'ਲੇਜ਼ਰ ਲੈਵਲਿੰਗ', 'लेज़र लेवलिंग', 'laser_leveller', 'per_hour', null, array[5,6,11,12], 70),
  ('cotton_bed_prep', 'Cotton bed prep', 'ਨਰਮੇ ਦੀ ਤਿਆਰੀ', 'नरमा तैयारी', 'ridger', 'per_killa', 40, array[4,5], 80),
  ('wheat_sowing', 'Wheat sowing', 'ਕਣਕ ਦੀ ਬਿਜਾਈ', 'गेहूँ बिजाई', 'happy_seeder', 'per_killa', 35, array[10,11], 90),
  ('seed_drilling', 'Seed drilling', 'ਬਿਜਾਈ', 'बिजाई', 'seed_drill', 'per_killa', 30, array[5,6,10,11], 100),
  ('field_spray', 'Spraying', 'ਸਪਰੇਅ', 'स्प्रे', 'boom_sprayer', 'per_killa', 15, array[6,7,8,9], 110),
  ('orchard_spray', 'Kinnow spraying', 'ਕਿੰਨੂ ਸਪਰੇਅ', 'किन्नू स्प्रे', 'htp_sprayer', 'per_killa', 40, array[12,1,2], 120),
  ('haulage', 'Haulage', 'ਢੋਆ-ਢੁਆਈ', 'ढुलाई', 'trolley', 'per_job', null, array[]::int[], 130),
  ('earthwork', 'Earthwork', 'ਮਿੱਟੀ ਦਾ ਕੰਮ', 'मिट्टी का काम', 'jcb', 'per_hour', null, array[]::int[], 140)
) as v(code, name_en, name_pa, name_hi, machine_code, unit, mins, months, sort_order)
join public.machine_types mt on mt.code = v.machine_code
on conflict (code) do nothing;
