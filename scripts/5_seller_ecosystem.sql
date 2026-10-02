-- ============================================================
-- UniMerch — Seller & Product Ecosystem schema
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to run multiple times (IF NOT EXISTS / IF EXISTS everywhere).
--
-- Adds:
--   • products.is_restricted / allowed_roles   — role-gated product visibility
--   • products.has_logo / royalty_*            — BAO-controlled logo royalty
--   • products 'draft' status                  — Save as Draft vs Publish
--   • seller_profiles.qr_status / qr_updated_at / rating(_count) — e-wallet QR + storefront rating
--   • bao_settings                             — singleton row, global royalty %
--   • seller_follows                           — buyer follows seller (storefront)
-- ============================================================

-- ── Products: restriction + royalty + draft status ─────────────
alter table public.products add column if not exists is_restricted      boolean       not null default false;
alter table public.products add column if not exists allowed_roles      text[]        not null default array[]::text[];
alter table public.products add column if not exists has_logo           boolean       not null default false;
alter table public.products add column if not exists royalty_percentage numeric(5,2)  not null default 0;
alter table public.products add column if not exists royalty_amount     numeric(10,2) not null default 0;
alter table public.products add column if not exists final_price        numeric(10,2);
alter table public.products add column if not exists is_royalty_product boolean       not null default false;

update public.products set final_price = price where final_price is null;

alter table public.products drop constraint if exists products_status_check;
alter table public.products add constraint products_status_check
  check (status in ('draft','pending','approved','rejected')) not valid;

-- ── Seller profiles: e-wallet QR status + storefront rating ───
-- Defensive re-adds: some projects never re-ran the scripts that first added these.
alter table public.seller_profiles add column if not exists campus       text;
alter table public.seller_profiles add column if not exists gcash_number text;
alter table public.seller_profiles add column if not exists qr_status     text not null default 'inactive'
  check (qr_status in ('inactive','active'));
alter table public.seller_profiles add column if not exists qr_updated_at timestamptz;
alter table public.seller_profiles add column if not exists rating        numeric(3,2) not null default 0;
alter table public.seller_profiles add column if not exists rating_count  integer      not null default 0;

-- ── BAO settings (single row, id = 1) ──────────────────────────
create table if not exists public.bao_settings (
  id                       smallint    primary key default 1 check (id = 1),
  global_royalty_percentage numeric(5,2) not null default 3,
  updated_at               timestamptz not null default now()
);
insert into public.bao_settings (id, global_royalty_percentage)
values (1, 3)
on conflict (id) do nothing;

alter table public.bao_settings enable row level security;

drop policy if exists "authenticated read bao settings" on public.bao_settings;
create policy "authenticated read bao settings"
  on public.bao_settings for select using (auth.role() = 'authenticated');

drop policy if exists "staff manage bao settings" on public.bao_settings;
create policy "staff manage bao settings"
  on public.bao_settings for all
  using (public.is_staff())
  with check (public.is_staff());

-- ── Seller follows (storefront "Follow Seller") ────────────────
create table if not exists public.seller_follows (
  id          uuid        primary key default gen_random_uuid(),
  follower_id uuid        not null references auth.users(id) on delete cascade,
  seller_id   uuid        not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (follower_id, seller_id)
);

alter table public.seller_follows enable row level security;

drop policy if exists "anyone can read follows" on public.seller_follows;
create policy "anyone can read follows"
  on public.seller_follows for select using (true);

drop policy if exists "users manage own follows" on public.seller_follows;
create policy "users manage own follows"
  on public.seller_follows for all
  using (auth.uid() = follower_id)
  with check (auth.uid() = follower_id);

-- ── Role-based product visibility (strict enforcement at DB level) ──
create or replace function public.viewer_role_allowed(allowed text[])
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = any(allowed)
  );
$$;

drop policy if exists "approved products are public" on public.products;
create policy "approved products are public"
  on public.products for select
  using (
    status = 'approved'
    and (
      is_restricted = false
      or public.is_staff()
      or public.viewer_role_allowed(allowed_roles)
    )
  );

-- ── Root-cause fix: sellers could never create their own storefront row ──
-- the old insert policy only allowed admin accounts to insert,
-- so any seller not onboarded through the admin flow had no
-- seller_profiles row (org name, QR, storefront) and no way to create one —
-- the "Save Shop Settings" upsert silently failed under this policy.
drop policy if exists "admin inserts seller profiles" on public.seller_profiles;
create policy "admin inserts seller profiles"
  on public.seller_profiles for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin'))
    or auth.uid() = id
  );

