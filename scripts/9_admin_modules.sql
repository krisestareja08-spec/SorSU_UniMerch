-- ============================================================
-- UniMerch — Verification Admin modules
-- Run in Supabase SQL Editor AFTER 7_verification_apply.sql and 8_verification_storage.sql.
-- Safe to re-run. Paste and run the WHOLE file.
--
--   • verification_audit_log  — activity log for every admin action
--   • profile_change_log      — history of every change to a user's profile (auto, via trigger)
--   • id_number_taken()       — one account per I.D. number (checked at sign-up + verification)
--   • unique verified I.D.    — DB-level guarantee: one verified account per I.D. number
--   • guards                  — users can't self-verify or change their own role
-- ============================================================

create extension if not exists pgcrypto;

-- ── Activity log (same shape as scripts/4_verification_admin.sql) ──────────
create table if not exists public.verification_audit_log (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid references public.verification_requests(id) on delete set null,
  user_id      uuid references public.profiles(id) on delete set null,
  actor_id     uuid references public.profiles(id),
  action       text not null,
  reason       text,
  created_at   timestamptz not null default now()
);
create index if not exists verification_audit_log_created_idx on public.verification_audit_log(created_at desc);

alter table public.verification_audit_log enable row level security;
drop policy if exists "staff read audit log" on public.verification_audit_log;
create policy "staff read audit log" on public.verification_audit_log for select using (public.is_staff());
drop policy if exists "staff write audit log" on public.verification_audit_log;
create policy "staff write audit log" on public.verification_audit_log for insert with check (public.is_staff());

-- ── Profile change history ─────────────────────────────────────────────────
alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles add column if not exists contact text;
alter table public.profiles add column if not exists birthday date;
alter table public.profiles add column if not exists campus text;

create table if not exists public.profile_change_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  changed_by  uuid,
  field       text not null,
  old_value   text,
  new_value   text,
  created_at  timestamptz not null default now()
);
create index if not exists profile_change_log_user_idx on public.profile_change_log(user_id, created_at desc);

alter table public.profile_change_log enable row level security;
drop policy if exists "staff read profile changes" on public.profile_change_log;
create policy "staff read profile changes" on public.profile_change_log for select using (public.is_staff());

create or replace function public.log_profile_changes()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  k text;
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
begin
  foreach k in array array['full_name','role','affiliation','student_employee_id','department','campus',
                           'contact','birthday','account_status','verification_status','is_identity_verified'] loop
    if (o -> k) is distinct from (n -> k) then
      insert into public.profile_change_log (user_id, changed_by, field, old_value, new_value)
      values (new.id, auth.uid(), k, o ->> k, n ->> k);
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists log_profile_changes on public.profiles;
create trigger log_profile_changes after update on public.profiles for each row execute procedure public.log_profile_changes();

-- ── Guards: no self-verification, no self-promotion ────────────────────────
create or replace function public.guard_profile_verification()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- SQL editor / service role (no auth.uid) and staff may change anything
  if auth.uid() is null or public.is_staff() then
    return new;
  end if;
  if new.role is distinct from old.role then
    raise exception 'Only an administrator can change account roles';
  end if;
  if new.is_identity_verified is distinct from old.is_identity_verified
     or (new.verification_status = 'approved' and old.verification_status is distinct from 'approved') then
    raise exception 'Only a Verification Admin can verify an account';
  end if;
  if coalesce(old.is_identity_verified, false) and new.affiliation is distinct from old.affiliation then
    raise exception 'Affiliation of a verified account can only be changed by a Verification Admin';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_verification on public.profiles;
create trigger guard_profile_verification before update on public.profiles for each row execute procedure public.guard_profile_verification();

-- New rows created by the user themselves always start unverified.
create or replace function public.guard_profile_insert()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_staff() then
    new.is_identity_verified := false;
    new.verification_status := 'unverified';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_insert on public.profiles;
create trigger guard_profile_insert before insert on public.profiles for each row execute procedure public.guard_profile_insert();

-- ── One account per I.D. number ────────────────────────────────────────────
create or replace function public.id_number_taken(p_id text)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
      select 1 from public.profiles
      where student_employee_id = trim(p_id) and id is distinct from auth.uid()
    )
    or exists (
      select 1 from public.verification_requests
      where student_employee_id = trim(p_id)
        and user_id is distinct from auth.uid()
        and status in ('pending','under_review','approved')
    );
$$;
grant execute on function public.id_number_taken(text) to anon, authenticated;

-- Sign-up used to mark every buyer verified automatically. Reset buyers who were never
-- approved through the Verification Queue so they go through the real flow.
update public.profiles p
set is_identity_verified = false, verification_status = 'unverified'
where p.role = 'buyer'
  and coalesce(p.is_identity_verified, false)
  and not exists (
    select 1 from public.verification_requests r where r.user_id = p.id and r.status = 'approved'
  );

-- Hard guarantee: an I.D. number can belong to only one verified account.
-- If existing duplicates block this, resolve them in /admin/duplicates and re-run.
do $$
begin
  create unique index if not exists profiles_verified_id_number_unique
    on public.profiles (student_employee_id)
    where is_identity_verified and student_employee_id is not null;
exception when unique_violation then
  raise notice 'Duplicate verified I.D. numbers exist — resolve them in /admin/duplicates, then re-run this script.';
end;
$$;
