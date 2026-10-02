-- ============================================================
-- UniMerch — "Apply for verification" (buyer profile → Verification Admin)
-- Run in Supabase SQL Editor. Safe to re-run.
-- Standalone: creates verification_requests if missing. Still run 4_verification_admin.sql for the audit log + identity-change tables.
--   • verification_requests.cor_url — second document (students: COR + ID; employees: ID only)
--   • is_staff() limited to admin / bao / supply office
--   • restricted products unlock by role OR by verified affiliation
--     (student / faculty / staff / alumni), granted only when the Verification Admin approves
--   • trigger: users cannot self-verify or change affiliation once verified
-- ============================================================

-- Profile columns the verification flow relies on (no-ops if already present)
alter table public.profiles add column if not exists affiliation text not null default 'external';
alter table public.profiles add column if not exists verification_status text not null default 'unverified';
alter table public.profiles add column if not exists is_identity_verified boolean not null default false;
alter table public.profiles add column if not exists student_employee_id text;
alter table public.profiles add column if not exists department text;

-- Same table as scripts/4_verification_admin.sql, so this script also works standalone.
create extension if not exists pgcrypto;

create table if not exists public.verification_requests (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  full_name            text not null,
  student_employee_id  text not null,
  department           text,
  claimed_affiliation  text not null default 'student'
                       check (claimed_affiliation in ('student','faculty','staff','alumni','external')),
  document_type        text not null default 'school_id' check (document_type in ('school_id','cor')),
  document_url         text,
  status               text not null default 'pending'
                       check (status in ('pending','under_review','approved','rejected','needs_resubmission')),
  reviewed_by          uuid references public.profiles(id),
  review_reason        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists verification_requests_user_id_idx on public.verification_requests(user_id);
create index if not exists verification_requests_status_idx on public.verification_requests(status);

alter table public.verification_requests add column if not exists cor_url text;

alter table public.verification_requests enable row level security;

drop policy if exists "users manage own verification requests" on public.verification_requests;
create policy "users manage own verification requests"
  on public.verification_requests for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.is_staff()
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','bao','supply_office')
  );
$$;

create or replace function public.viewer_role_allowed(allowed text[])
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (
        role = any(allowed)
        or (coalesce(is_identity_verified, false) and affiliation = any(allowed))
      )
  );
$$;

create or replace function public.guard_profile_verification()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- SQL editor / service role (no auth.uid) and staff may change anything
  if auth.uid() is null or public.is_staff() then
    return new;
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

-- Staff (admin / bao / supply office) can review every request
drop policy if exists "staff manage verification requests" on public.verification_requests;
create policy "staff manage verification requests"
  on public.verification_requests for all
  using (public.is_staff())
  with check (public.is_staff());
