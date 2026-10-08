-- ============================================================

-- Users change or link their number from Settings → Account & Security: Supabase Auth texts a
-- 6-digit code to the new number (auth.users.phone / phone_confirmed_at). This script makes the
-- database refuse any self-made change to profiles.contact that doesn't match a confirmed phone.
--
-- CURRENTLY SWITCHED OFF (coming soon): numbers save without a code until an SMS provider is set up.
-- To switch it on later:
--   1. Supabase Dashboard → Authentication → Sign In / Providers → Phone → enable, and set up
--      Twilio, MessageBird, Vonage or Textlocal
--   2. Set NEXT_PUBLIC_PHONE_OTP_ENABLED=true in the app's environment (see lib/features.ts)
--   3. Run:  create or replace function public.phone_otp_required() returns boolean
--            language sql immutable as $$ select true $$;
-- ============================================================

alter table public.profiles add column if not exists contact_verified boolean not null default false;

-- The on/off switch for enforcement. Re-running this file switches it back OFF.
create or replace function public.phone_otp_required()
returns boolean language sql immutable as $$ select false $$;

-- '09171234567', '+63 917 123 4567', '639171234567' → '639171234567' (the format auth.users.phone uses)
create or replace function public.normalize_ph_phone(p text)
returns text language sql immutable as $$
  select case
    when d ~ '^09\d{9}$' then '63' || substr(d, 2)
    when d ~ '^9\d{9}$'  then '63' || d
    else d end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x;
$$;

create or replace function public.guard_profile_contact()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  confirmed text;
begin
  -- contact_verified is always recomputed, so it can't be set by hand
  if new.contact is not distinct from old.contact and new.contact_verified is not distinct from old.contact_verified then return new; end if;

  select u.phone into confirmed from auth.users u where u.id = new.id and u.phone_confirmed_at is not null;
  new.contact_verified := coalesce(new.contact, '') <> '' and public.normalize_ph_phone(new.contact) = public.normalize_ph_phone(confirmed);

  -- Users editing their own profile may only switch to a number they confirmed by SMS.
  -- (Admins and server-side jobs are not blocked; their changes are just marked unverified.)
  if public.phone_otp_required() and auth.uid() = new.id and new.contact is distinct from old.contact and coalesce(new.contact, '') <> '' and not new.contact_verified then
    raise exception 'Verify your new phone number with the SMS code first (Settings → Account & Security).';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_contact on public.profiles;
create trigger guard_profile_contact before update of contact, contact_verified on public.profiles
  for each row execute procedure public.guard_profile_contact();

-- Numbers already confirmed by SMS count as verified
update public.profiles p set contact_verified = true
from auth.users u
where u.id = p.id and u.phone_confirmed_at is not null and coalesce(p.contact, '') <> ''
  and public.normalize_ph_phone(p.contact) = public.normalize_ph_phone(u.phone) and not p.contact_verified;

-- Notification Center: new notifications show up live (RLS still limits each user to their own)
do $$ begin
  if to_regclass('public.notifications') is not null then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception when duplicate_object or undefined_object then null; end $$;

notify pgrst, 'reload schema';
