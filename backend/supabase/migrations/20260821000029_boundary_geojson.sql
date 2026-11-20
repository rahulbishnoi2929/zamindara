-- Fields read back from the server as GeoJSON.
--
-- PostgREST returns a geography column as hex EWKB, which the app's reader
-- (geoJsonToPolygon) cannot parse — so every field pulled from the server
-- was silently discarded, and a phone that lost its local copy could never
-- get its fields back. Found by the end-to-end test, 20 Nov 2026.
--
-- A computed column: PostgREST lets `select=boundary_geojson` call this
-- function on each row, so the client asks for it like any column. Invoker
-- rights and the row it is given, so RLS still decides which rows arrive.
create function public.boundary_geojson(f public.fields)
returns json
language sql
stable
set search_path = public, extensions
as $fn$
  select extensions.st_asgeojson(f.boundary)::json;
$fn$;

comment on function public.boundary_geojson(public.fields) is
  'The field boundary as GeoJSON, for the app. Select it as a column: select=boundary_geojson.';
