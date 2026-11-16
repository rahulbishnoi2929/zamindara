-- Which story the sign-in screen tells.
--
-- There is no SMS provider. India requires DLT registration with TRAI
-- before a real message can be sent and that takes weeks, so until then a
-- captain's code is one the founder reads to him over the phone and sets
-- against his number in the Supabase dashboard.
--
-- The screen must say so. "We have sent you an SMS" to a man who will never
-- receive one is the app telling him to wait for something that is not
-- coming, and he will conclude it is broken — which, from where he stands,
-- it is.
--
-- A column rather than a build flag because the day the SMS paperwork
-- clears, the screen has to change on phones already in captains' hands,
-- and there is no store to push an update through.
--
-- Additive, like every schema change from here on: a shipped APK that has
-- never heard of this column keeps working, reads the columns it knows, and
-- shows the SMS wording it has always shown.

alter table public.app_config
  add column founder_code_signin boolean not null default true;

comment on column public.app_config.founder_code_signin is
  'True: the sign-in screen says the code comes from the founder. False: it says an SMS was sent. No SMS provider is configured yet, so true is the honest answer.';
