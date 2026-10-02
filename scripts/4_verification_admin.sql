-- ============================================================
-- UniMerch — Verification Admin schema
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to run multiple times (IF NOT EXISTS / IF EXISTS everywhere).
--
-- Adds what the secondary "Verification Admin" dashboard (/admin) needs:
--   • profiles.account_status        — disable / suspend / flag accounts
--   • verification_requests          — the queue (pending/under_review/…)
--   • verification_audit_log         — who verified, when, why
--   • identity_change_requests       — name/department/ID correction requests
-- ============================================================

create extension if not exists pgcrypto;

-- ── Account control ─────────────────────────────────────────────
alter table public.profiles add column if not exists account_status text not null default 'active'
  check (account_status in ('active', 'suspended', 'flagged'));

-- ── Verification queue ──────────────────────────────────────────
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
-- one-identity-per-account: a given ID number can only be claimed by one user
create unique index if not exists verification_requests_id_number_unique
  on public.verification_requests(student_employee_id) where status = 'approved';

alter table public.verification_requests enable row level security;

drop policy if exists "staff manage verification requests" on public.verification_requests;
create policy "staff manage verification requests"
  on public.verification_requests for all
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "users manage own verification requests" on public.verification_requests;
create policy "users manage own verification requests"
  on public.verification_requests for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Audit trail ──────────────────────────────────────────────────
create table if not exists public.verification_audit_log (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid references public.verification_requests(id) on delete set null,
  user_id      uuid references public.profiles(id) on delete set null,
  actor_id     uuid references public.profiles(id),
  action       text not null,
  reason       text,
  created_at   timestamptz not null default now()
);

alter table public.verification_audit_log enable row level security;

drop policy if exists "staff read audit log" on public.verification_audit_log;
create policy "staff read audit log"
  on public.verification_audit_log for select
  using (public.is_staff());

drop policy if exists "staff write audit log" on public.verification_audit_log;
create policy "staff write audit log"
  on public.verification_audit_log for insert
  with check (public.is_staff());

-- ── Identity change requests ─────────────────────────────────────
create table if not exists public.identity_change_requests (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  field            text not null check (field in ('full_name','department','student_employee_id')),
  current_value    text,
  requested_value  text not null,
  status           text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at       timestamptz not null default now()
);

alter table public.identity_change_requests enable row level security;

drop policy if exists "staff manage identity change requests" on public.identity_change_requests;
create policy "staff manage identity change requests"
  on public.identity_change_requests for all
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "users manage own identity change requests" on public.identity_change_requests;
create policy "users manage own identity change requests"
  on public.identity_change_requests for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
