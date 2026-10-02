-- ============================================================
-- UniMerch — Profile rules, dummy-account reports and bans
-- Run in Supabase SQL Editor AFTER 11_storefront.sql. Paste and run the WHOLE file. Safe to re-run.
--
--   • profiles.course / verification_requests.course
--   • account_status gains 'banned'
--   • account_reports      — store staff report/flag dummy buyers; reported accounts are auto-flagged
--   • suspended / banned accounts cannot place orders
-- ============================================================

alter table public.profiles add column if not exists course text;
alter table public.verification_requests add column if not exists course text;
alter table public.verification_requests add column if not exists note text;

alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check
  check (account_status in ('active','flagged','suspended','banned')) not valid;

-- Campus values must match the app's campus list (lib/roles.ts); free text used to break profile saves.
alter table public.profiles drop constraint if exists profiles_campus_check;
alter table public.profiles add constraint profiles_campus_check
  check (campus is null or campus in ('sorsogon_city_main','bulan','castilla','magallanes','sorsogon_city_baribag')) not valid;

-- Keep course in the profile change history too
create or replace function public.log_profile_changes()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  k text;
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
begin
  foreach k in array array['full_name','role','affiliation','student_employee_id','course','department','campus',
                           'contact','birthday','account_status','verification_status','is_identity_verified'] loop
    if (o -> k) is distinct from (n -> k) then
      insert into public.profile_change_log (user_id, changed_by, field, old_value, new_value)
      values (new.id, auth.uid(), k, o ->> k, n ->> k);
    end if;
  end loop;
  return new;
end;
$$;

-- Users can't change their own account standing.
create or replace function public.guard_profile_verification()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_staff() then
    return new;
  end if;
  if new.role is distinct from old.role then
    raise exception 'Only an administrator can change account roles';
  end if;
  if new.account_status is distinct from old.account_status then
    raise exception 'Only the Verification Admin can change account standing';
  end if;
  if new.is_identity_verified is distinct from old.is_identity_verified
     or (new.verification_status = 'approved' and old.verification_status is distinct from 'approved') then
    raise exception 'Only a Verification Admin can verify an account';
  end if;
  -- Verified users: identity fields change only through re-verification (handled server-side).
  if coalesce(old.is_identity_verified, false) and (
       new.affiliation is distinct from old.affiliation
    or new.full_name is distinct from old.full_name
    or new.student_employee_id is distinct from old.student_employee_id
    or new.course is distinct from old.course
    or new.department is distinct from old.department
  ) then
    raise exception 'Changing your name, I.D. number, course or department requires re-verification';
  end if;
  return new;
end;
$$;

-- ── Reports of dummy / fake buyer accounts ─────────────────────────────────
create table if not exists public.account_reports (
  id             uuid primary key default gen_random_uuid(),
  reported_user  uuid not null references public.profiles(id) on delete cascade,
  reporter_id    uuid not null references public.profiles(id) on delete cascade,
  store_id       uuid references public.seller_profiles(id) on delete set null,
  order_id       uuid references public.orders(id) on delete set null,
  reason         text not null check (reason in ('dummy_account','fake_identity','no_show','abusive','other')),
  details        text,
  status         text not null default 'open' check (status in ('open','dismissed','actioned')),
  resolved_by    uuid references public.profiles(id),
  resolved_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists account_reports_status_idx on public.account_reports(status, created_at desc);
create index if not exists account_reports_user_idx on public.account_reports(reported_user);

alter table public.account_reports enable row level security;

drop policy if exists "store staff report buyers" on public.account_reports;
create policy "store staff report buyers" on public.account_reports
  for insert with check (reporter_id = auth.uid() and store_id is not null and public.store_access(store_id, 'orders'));

drop policy if exists "reporters read own reports" on public.account_reports;
create policy "reporters read own reports" on public.account_reports
  for select using (reporter_id = auth.uid());

drop policy if exists "verification admin manages reports" on public.account_reports;
create policy "verification admin manages reports" on public.account_reports
  for all using (public.is_verification_admin()) with check (public.is_verification_admin());

-- A reported account is flagged immediately; the Verification Admin decides on suspension / ban.
create or replace function public.flag_reported_account()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set account_status = 'flagged'
  where id = new.reported_user and coalesce(account_status, 'active') = 'active';
  return new;
end;
$$;

drop trigger if exists flag_reported_account on public.account_reports;
create trigger flag_reported_account after insert on public.account_reports for each row execute procedure public.flag_reported_account();

-- ── Suspended / banned accounts cannot place orders ────────────────────────
create or replace function public.account_in_good_standing()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select account_status not in ('suspended','banned') from public.profiles where id = auth.uid()), true);
$$;

drop policy if exists "buyers insert orders" on public.orders;
create policy "buyers insert orders" on public.orders
  for insert with check (auth.uid() = buyer_id and public.account_in_good_standing());
