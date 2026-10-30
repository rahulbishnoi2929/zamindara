-- Zamindara — extensions
--
-- PostGIS is not optional here. Every core question this product asks is a
-- geometry question: how big is this field, which captains are in range, how
-- far for the travel charge. See docs/TECH_STACK.md.

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Trigram search for village and captain name lookup. Small now; the index
-- matters the moment there are more than a few hundred villages.
create extension if not exists pg_trgm with schema extensions;
