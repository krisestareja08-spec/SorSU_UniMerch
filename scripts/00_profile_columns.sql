-- ============================================================
-- UniMerch — make sure the profiles table has every column the app uses.
-- Fixes errors like: "Could not find the 'campus' column of 'profiles' in the schema cache".
-- Run in Supabase SQL Editor (paste the WHOLE file). Safe to re-run any time.
-- ============================================================

alter table public.profiles add column if not exists full_name            text;
alter table public.profiles add column if not exists role                 text not null default 'buyer';
alter table public.profiles add column if not exists affiliation          text not null default 'external';
alter table public.profiles add column if not exists verification_status  text not null default 'unverified';
alter table public.profiles add column if not exists is_identity_verified boolean not null default false;
alter table public.profiles add column if not exists student_employee_id  text;
alter table public.profiles add column if not exists course               text;
alter table public.profiles add column if not exists department           text;
alter table public.profiles add column if not exists campus               text;
alter table public.profiles add column if not exists contact              text;
alter table public.profiles add column if not exists birthday             date;
alter table public.profiles add column if not exists avatar_url           text;
alter table public.profiles add column if not exists account_status       text not null default 'active';
alter table public.profiles add column if not exists created_at           timestamptz not null default now();

-- Tell Supabase's API to pick up the new columns immediately (clears the "schema cache" error).
notify pgrst, 'reload schema';
