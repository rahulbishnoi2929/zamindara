-- Shared helpers used by every table below.

-- Keep updated_at honest without every caller remembering to set it.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Land-measurement constants, kept in one place so SQL and TypeScript cannot
-- drift apart. Mirrors packages/units/src/constants.ts.
create or replace function public.sqm_per_unit(p_unit text)
returns numeric
language sql
immutable
as $$
  select case p_unit
    when 'marla' then 25.29285264
    when 'kanal' then 505.8570528
    when 'bigha' then 2529.285264
    when 'killa' then 4046.8564224
    when 'acre'  then 4046.8564224
    when 'hectare' then 10000.0
  end::numeric;
$$;

comment on function public.sqm_per_unit is
  'Square metres per land unit. Mirrors packages/units — change both together.';
