-- ============================================================
-- UniMerch — COMPLETE DATABASE SETUP (all scripts, in order)
-- Paste this WHOLE file into the Supabase SQL Editor and click Run.
-- Safe to re-run: every step checks what already exists.
-- Generated from scripts 00, 1–5, 7–13, 15, 17–20 and 22–32. Afterwards run 14_appoint_verification_admin.sql
-- with your admin email to make that account the Verification Admin's Main Admin.
-- ============================================================


-- ############################################################
-- ## 00_profile_columns.sql
-- ############################################################

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


-- ############################################################
-- ## 1_tables.sql
-- ############################################################

-- ============================================================
-- UniMerch  — STEP 1: Run this first in Supabase SQL Editor
-- Creates all tables, RLS, and policies. No storage.
-- ============================================================

-- ── Products ──────────────────────────────────────────────────
create table if not exists public.products (
  id           uuid          primary key default gen_random_uuid(),
  seller_id    uuid          not null references auth.users(id) on delete cascade,
  name         text          not null,
  description  text,
  category     text          not null default 'General',
  price        numeric(10,2) not null check (price >= 0),
  image_url    text,
  stock        integer       not null default 0 check (stock >= 0),
  status       text          not null default 'pending'
               check (status in ('pending','approved','rejected')),
  bao_comment  text,
  badge        text          not null default 'Available'
               check (badge in ('Available','Pre-Order','Interest Check','Sold Out')),
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now()
);

-- ── Cart Items ────────────────────────────────────────────────
create table if not exists public.cart_items (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  product_id uuid        not null references public.products(id) on delete cascade,
  quantity   integer     not null default 1 check (quantity > 0),
  variant    text,
  created_at timestamptz not null default now()
);

-- ── Orders ────────────────────────────────────────────────────
create table if not exists public.orders (
  id             uuid          primary key default gen_random_uuid(),
  buyer_id       uuid          not null references auth.users(id) on delete cascade,
  status         text          not null default 'pending'
                 check (status in ('pending','paid','ready_for_pickup','completed','cancelled')),
  total          numeric(10,2) not null check (total >= 0),
  payment_method text          not null,
  receipt_url    text,
  notes          text,
  created_at     timestamptz   not null default now()
);

-- ── Order Items ───────────────────────────────────────────────
create table if not exists public.order_items (
  id                uuid          primary key default gen_random_uuid(),
  order_id          uuid          not null references public.orders(id) on delete cascade,
  product_id        uuid          references public.products(id) on delete set null,
  seller_id         uuid          not null references auth.users(id) on delete cascade,
  quantity          integer       not null check (quantity > 0),
  unit_price        numeric(10,2) not null check (unit_price >= 0),
  variant           text,
  product_name      text          not null,
  product_image_url text
);

-- ── Product Messages ──────────────────────────────────────────
create table if not exists public.product_messages (
  id         uuid        primary key default gen_random_uuid(),
  product_id uuid        not null references public.products(id) on delete cascade,
  sender_id  uuid        not null references auth.users(id) on delete cascade,
  message    text        not null,
  created_at timestamptz not null default now()
);

-- ── Seller Org Profiles ───────────────────────────────────────
create table if not exists public.seller_profiles (
  id            uuid        primary key references auth.users(id) on delete cascade,
  org_name      text        not null,
  description   text,
  category      text,
  gcash_number  text,
  gcash_qr_url  text,
  created_by    uuid        references auth.users(id),
  status        text        not null default 'active'
                check (status in ('active','suspended','pending')),
  created_at    timestamptz not null default now()
);

-- ── Extra profile columns (added later) ──────────────────────
alter table public.profiles add column if not exists student_employee_id text;
alter table public.profiles add column if not exists department           text;
alter table public.profiles add column if not exists contact              text;
alter table public.profiles add column if not exists birthday             date;
alter table public.profiles add column if not exists avatar_url           text;

-- Campus identity — required for verified members/sellers, not applicable to guest/external accounts.
alter table public.profiles add column if not exists campus text;
alter table public.profiles drop constraint if exists profiles_campus_check;
alter table public.profiles add constraint profiles_campus_check
  check (campus is null or campus in ('sorsogon_city_main','bulan','castilla','magallanes','sorsogon_city_baribag')) not valid;

alter table public.seller_profiles add column if not exists campus text;
alter table public.seller_profiles drop constraint if exists seller_profiles_campus_check;
alter table public.seller_profiles add constraint seller_profiles_campus_check
  check (campus is null or campus in ('sorsogon_city_main','bulan','castilla','magallanes','sorsogon_city_baribag')) not valid;

-- Update orders status constraint if table already existed with old values
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending','paid','partially_paid','ready_for_pickup','completed','cancelled')) not valid;

-- ── Row Level Security ────────────────────────────────────────
alter table public.products         enable row level security;
alter table public.cart_items       enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.product_messages enable row level security;
alter table public.seller_profiles  enable row level security;

-- Products
drop policy if exists "approved products are public"        on public.products;
drop policy if exists "sellers view own products"           on public.products;
drop policy if exists "sellers insert products"             on public.products;
drop policy if exists "sellers update own products"         on public.products;
drop policy if exists "sellers delete own pending products" on public.products;
drop policy if exists "bao can manage all products"         on public.products;

create policy "approved products are public"
  on public.products for select using (status = 'approved');

create policy "sellers view own products"
  on public.products for select using (auth.uid() = seller_id);

create policy "sellers insert products"
  on public.products for insert with check (auth.uid() = seller_id);

create policy "sellers update own products"
  on public.products for update using (auth.uid() = seller_id);

create policy "sellers delete own pending products"
  on public.products for delete using (auth.uid() = seller_id and status = 'pending');

create policy "bao can manage all products"
  on public.products for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('bao','admin')));

-- Cart
drop policy if exists "users manage own cart" on public.cart_items;
create policy "users manage own cart"
  on public.cart_items for all using (auth.uid() = user_id);

-- Security definer helpers break the orders ↔ order_items RLS recursion
create or replace function public.auth_seller_has_order(p_order_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.order_items
    where order_items.order_id = p_order_id
    and   order_items.seller_id = auth.uid()
  );
$$;

create or replace function public.auth_buyer_has_order(p_order_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.orders
    where id = p_order_id
    and   buyer_id = auth.uid()
  );
$$;

-- Orders
drop policy if exists "buyers insert orders"                on public.orders;
drop policy if exists "buyers read own orders"              on public.orders;
drop policy if exists "sellers read orders with their items" on public.orders;
drop policy if exists "sellers update their orders"         on public.orders;

create policy "buyers insert orders"
  on public.orders for insert with check (auth.uid() = buyer_id);

create policy "buyers read own orders"
  on public.orders for select using (auth.uid() = buyer_id);

create policy "sellers read orders with their items"
  on public.orders for select
  using (public.auth_seller_has_order(id));

create policy "sellers update their orders"
  on public.orders for update
  using (public.auth_seller_has_order(id))
  with check (status in ('pending','paid','partially_paid','ready_for_pickup','completed','cancelled'));

-- Order items
drop policy if exists "insert order items for own order" on public.order_items;
drop policy if exists "read own order items"             on public.order_items;

create policy "insert order items for own order"
  on public.order_items for insert
  with check (public.auth_buyer_has_order(order_id));

create policy "read own order items"
  on public.order_items for select
  using (
    public.auth_buyer_has_order(order_id)
    or auth.uid() = seller_id
  );

-- Product messages
drop policy if exists "product message readers" on public.product_messages;
drop policy if exists "product message senders" on public.product_messages;

create policy "product message readers"
  on public.product_messages for select
  using (
    auth.uid() = sender_id
    or exists (select 1 from public.products where id = product_id and seller_id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('bao','admin'))
  );

create policy "product message senders"
  on public.product_messages for insert
  with check (
    auth.uid() = sender_id and (
      exists (select 1 from public.products where id = product_id and seller_id = auth.uid())
      or exists (select 1 from public.profiles where id = auth.uid() and role in ('bao','admin'))
    )
  );

-- Seller profiles
drop policy if exists "anyone reads seller profiles"      on public.seller_profiles;
drop policy if exists "seller updates own profile"        on public.seller_profiles;
drop policy if exists "admin inserts seller profiles" on public.seller_profiles;

create policy "anyone reads seller profiles"
  on public.seller_profiles for select using (true);

create policy "seller updates own profile"
  on public.seller_profiles for update using (auth.uid() = id);

create policy "admin inserts seller profiles"
  on public.seller_profiles for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin')));


-- ############################################################
-- ## 2_storage.sql
-- ############################################################

-- ============================================================
-- UniMerch — STEP 2: Run AFTER step 1.
-- Creates Storage buckets via Supabase Dashboard OR this SQL.
-- If this step errors, create the buckets manually in
-- Dashboard → Storage → New Bucket instead.
-- ============================================================

-- Buckets (may require superuser; skip if you create them manually)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('order-receipts', 'order-receipts', true)
on conflict (id) do nothing;

-- Verification documents (school ID / COR) — private, contains PII
insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

-- Security-definer helper (redefined here too so this script works standalone)
create or replace function public.is_staff()
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','bao','supply_office')
  );
$$;

-- Storage upload policies
drop policy if exists "authenticated can upload product images" on storage.objects;
drop policy if exists "product images are public"              on storage.objects;
drop policy if exists "authenticated can upload receipts"      on storage.objects;
drop policy if exists "receipts are public"                    on storage.objects;
drop policy if exists "users upload own verification docs"     on storage.objects;
drop policy if exists "users read own verification docs"       on storage.objects;
drop policy if exists "staff read verification docs"           on storage.objects;

create policy "authenticated can upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.role() = 'authenticated');

create policy "product images are public"
  on storage.objects for select using (bucket_id = 'product-images');

create policy "authenticated can upload receipts"
  on storage.objects for insert
  with check (bucket_id = 'order-receipts' and auth.role() = 'authenticated');

create policy "receipts are public"
  on storage.objects for select using (bucket_id = 'order-receipts');

-- Verification docs are namespaced by uploader's user id: "<user_id>/<file>"
create policy "users upload own verification docs"
  on storage.objects for insert
  with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users read own verification docs"
  on storage.objects for select
  using (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "staff read verification docs"
  on storage.objects for select
  using (bucket_id = 'verification-docs' and public.is_staff());



-- ############################################################
-- ## 3_columns.sql
-- ############################################################

-- ============================================================
-- UniMerch — STEP 3: Additional columns (run after step 1)
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS)
-- ============================================================

-- Extra product columns
alter table public.products add column if not exists images     text[]  default ARRAY[]::text[];
alter table public.products add column if not exists variations jsonb   default '[]'::jsonb;
alter table public.products add column if not exists tags       text[]  default ARRAY[]::text[];
alter table public.products add column if not exists sku        text;

-- Extra order columns
alter table public.orders add column if not exists reference_number text;
alter table public.orders add column if not exists buyer_note       text;
alter table public.orders add column if not exists amount_paid      numeric(10,2);

-- Add partially_paid to orders status constraint
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending','paid','partially_paid','ready_for_pickup','completed','cancelled')) not valid;

-- Seller profile payment columns
alter table public.seller_profiles add column if not exists gcash_qr_url         text;
alter table public.seller_profiles add column if not exists bank_qr_url          text;
alter table public.seller_profiles add column if not exists bank_account_name    text;
alter table public.seller_profiles add column if not exists bank_account_number  text;
alter table public.seller_profiles add column if not exists gcash_number         text;


-- ############################################################
-- ## 4_verification_admin.sql
-- ############################################################

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


-- ############################################################
-- ## 5_seller_ecosystem.sql
-- ############################################################

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



-- ############################################################
-- ## 7_verification_apply.sql
-- ############################################################

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


-- ############################################################
-- ## 8_verification_storage.sql
-- ############################################################

-- ============================================================
-- UniMerch — Storage for verification documents (I.D. / COR)
-- Run in Supabase SQL Editor after 7_verification_apply.sql. Safe to re-run.
-- If the bucket insert errors, create it manually:
--   Dashboard → Storage → New bucket → name "verification-docs", Public OFF
-- ============================================================

insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

-- Files are stored as "<user_id>/<file>", so users can only touch their own folder.
drop policy if exists "users upload own verification docs" on storage.objects;
create policy "users upload own verification docs"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users read own verification docs" on storage.objects;
create policy "users read own verification docs"
  on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);

-- Verification Admin / BAO can open any uploaded document (signed links on /admin)
drop policy if exists "staff read verification docs" on storage.objects;
create policy "staff read verification docs"
  on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and public.is_staff());


-- ############################################################
-- ## 9_admin_modules.sql
-- ############################################################

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


-- ############################################################
-- ## 10_dashboards.sql
-- ############################################################

-- ============================================================
-- UniMerch — Dashboards are modules, users are members
-- Run in Supabase SQL Editor AFTER scripts 7, 8 and 9. Paste and run the WHOLE file.
-- Safe to re-run.
--
--   • dashboards          — Verification Admin, BAO, Supply Office, Cashier (one each;
--                           Cashier + Supply Office each own an office store)
--                           + one Seller Dashboard per organization
--   • dashboard_members   — which users manage which dashboard; one Main Admin each,
--                           secondary members get per-page permissions
--   • seller_profiles     — now the ORGANIZATION / STORE record (not a person).
--                           products.seller_id / order_items.seller_id = store id.
--   • access rules        — every rule that used profiles.role now uses membership
--   • migration           — existing admin/bao/supply/cashier/seller accounts become
--                           members (earliest account = Main Admin); roles reset to 'buyer'
-- ============================================================

create extension if not exists pgcrypto;

-- ── 1. Tables ──────────────────────────────────────────────────────────────
create table if not exists public.dashboards (
  id          uuid primary key default gen_random_uuid(),
  module      text not null check (module in ('verification','bao','supply_office','cashier','seller')),
  name        text not null,
  store_id    uuid unique references public.seller_profiles(id) on delete cascade,
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create unique index if not exists dashboards_single_module on public.dashboards(module) where module <> 'seller';

create table if not exists public.dashboard_members (
  dashboard_id uuid not null references public.dashboards(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  is_main      boolean not null default false,
  permissions  text[] not null default array[]::text[],
  added_by     uuid,
  created_at   timestamptz not null default now(),
  primary key (dashboard_id, user_id)
);
create unique index if not exists dashboard_one_main_admin on public.dashboard_members(dashboard_id) where is_main;
create index if not exists dashboard_members_user_idx on public.dashboard_members(user_id);

-- Stores are organizations, not people.
alter table public.seller_profiles alter column id set default gen_random_uuid();
alter table public.seller_profiles drop constraint if exists seller_profiles_id_fkey;
alter table public.products        drop constraint if exists products_seller_id_fkey;
alter table public.order_items     drop constraint if exists order_items_seller_id_fkey;
alter table public.seller_follows  drop constraint if exists seller_follows_seller_id_fkey;
alter table public.seller_profiles add column if not exists campus text;

-- ── 2. Access helpers ──────────────────────────────────────────────────────
create or replace function public.dashboard_access(p_dashboard uuid, p_perm text default null)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.dashboard_members m
    where m.dashboard_id = p_dashboard and m.user_id = auth.uid()
      and (m.is_main or p_perm is null or p_perm = any(m.permissions))
  );
$$;

create or replace function public.is_dashboard_main(p_dashboard uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.dashboard_members m
    where m.dashboard_id = p_dashboard and m.user_id = auth.uid() and m.is_main
  );
$$;

create or replace function public.module_access(p_module text, p_perm text default null)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.dashboards d
    join public.dashboard_members m on m.dashboard_id = d.id
    where d.module = p_module and m.user_id = auth.uid()
      and (m.is_main or p_perm is null or p_perm = any(m.permissions))
  );
$$;

create or replace function public.store_access(p_store uuid, p_perm text default null)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.dashboards d
    join public.dashboard_members m on m.dashboard_id = d.id
    where d.store_id = p_store and m.user_id = auth.uid()
      and (m.is_main or p_perm is null or p_perm = any(m.permissions))
  );
$$;

create or replace function public.is_verification_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select public.module_access('verification');
$$;

create or replace function public.is_verification_main()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.dashboards d join public.dashboard_members m on m.dashboard_id = d.id
    where d.module = 'verification' and m.user_id = auth.uid() and m.is_main
  );
$$;

-- "Staff" = members of the university management dashboards.
create or replace function public.is_staff()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.dashboards d join public.dashboard_members m on m.dashboard_id = d.id
    where d.module in ('verification','bao','supply_office') and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select public.module_access('verification') or public.module_access('bao');
$$;

-- Look up an account by email to add it to a dashboard (Main Admins / Verification Admin only).
create or replace function public.find_user_by_email(p_email text)
returns table (id uuid, full_name text)
language sql security definer set search_path = public, auth stable as $$
  select u.id, p.full_name
  from auth.users u left join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(p_email))
    and (
      exists (select 1 from public.dashboard_members m where m.user_id = auth.uid() and m.is_main)
      or public.module_access('verification', 'organizations')
      or public.module_access('verification', 'dashboards')
    )
  limit 1;
$$;
grant execute on function public.find_user_by_email(text) to authenticated;

-- Emails of a dashboard's members (for the Members page).
create or replace function public.dashboard_member_emails(p_dashboard uuid)
returns table (user_id uuid, email text)
language sql security definer set search_path = public, auth stable as $$
  select m.user_id, u.email::text
  from public.dashboard_members m join auth.users u on u.id = m.user_id
  where m.dashboard_id = p_dashboard
    and (public.dashboard_access(p_dashboard) or public.is_verification_admin());
$$;
grant execute on function public.dashboard_member_emails(uuid) to authenticated;

-- ── 3. Rules for dashboards / members ──────────────────────────────────────
alter table public.dashboards enable row level security;
alter table public.dashboard_members enable row level security;

drop policy if exists "signed-in users read dashboards" on public.dashboards;
create policy "signed-in users read dashboards" on public.dashboards
  for select using (auth.role() = 'authenticated');

drop policy if exists "verification admin manages dashboards" on public.dashboards;
create policy "verification admin manages dashboards" on public.dashboards
  for all using (public.module_access('verification', 'organizations'))
  with check (public.module_access('verification', 'organizations'));

drop policy if exists "members read dashboard members" on public.dashboard_members;
create policy "members read dashboard members" on public.dashboard_members
  for select using (
    user_id = auth.uid() or public.dashboard_access(dashboard_id) or public.is_verification_admin()
  );

drop policy if exists "main admin manages members" on public.dashboard_members;
create policy "main admin manages members" on public.dashboard_members
  for all using (
    public.is_dashboard_main(dashboard_id) or public.is_verification_main()
    or public.module_access('verification', 'organizations') or public.module_access('verification', 'dashboards')
  )
  with check (
    public.is_dashboard_main(dashboard_id) or public.is_verification_main()
    or public.module_access('verification', 'organizations') or public.module_access('verification', 'dashboards')
  );

-- Main Admins' member changes are recorded in the activity log too.
drop policy if exists "main admins log member changes" on public.verification_audit_log;
create policy "main admins log member changes" on public.verification_audit_log
  for insert with check (
    actor_id = auth.uid()
    and action in ('member_added','member_removed','member_permissions','main_admin_changed')
    and exists (select 1 from public.dashboard_members m where m.user_id = auth.uid() and m.is_main)
  );

-- Co-members of a dashboard can see each other's profiles (Members page).
drop policy if exists "dashboard co-members read profiles" on public.profiles;
create policy "dashboard co-members read profiles" on public.profiles
  for select using (
    exists (
      select 1 from public.dashboard_members a
      join public.dashboard_members b on b.dashboard_id = a.dashboard_id
      where a.user_id = auth.uid() and b.user_id = profiles.id
    )
  );

-- ── 4. Store data: membership instead of "seller_id = me" ───────────────────
drop policy if exists "sellers view own products"           on public.products;
drop policy if exists "sellers insert products"             on public.products;
drop policy if exists "sellers update own products"         on public.products;
drop policy if exists "sellers delete own pending products" on public.products;
drop policy if exists "bao can manage all products"         on public.products;
drop policy if exists "store members view products"         on public.products;
drop policy if exists "store members insert products"       on public.products;
drop policy if exists "store members update products"       on public.products;
drop policy if exists "store members delete products"       on public.products;
drop policy if exists "offices manage all products"         on public.products;

create policy "store members view products" on public.products
  for select using (public.store_access(seller_id));
create policy "store members insert products" on public.products
  for insert with check (public.store_access(seller_id, 'products'));
create policy "store members update products" on public.products
  for update using (public.store_access(seller_id, 'products'));
create policy "store members delete products" on public.products
  for delete using (public.store_access(seller_id, 'products') and status in ('pending','draft','rejected'));
create policy "offices manage all products" on public.products
  for all using (public.module_access('bao') or public.module_access('supply_office'))
  with check (public.module_access('bao') or public.module_access('supply_office'));

create or replace function public.auth_seller_has_order(p_order_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.order_items oi
    where oi.order_id = p_order_id and public.store_access(oi.seller_id, 'orders')
  );
$$;

drop policy if exists "read own order items" on public.order_items;
create policy "read own order items" on public.order_items
  for select using (public.auth_buyer_has_order(order_id) or public.store_access(seller_id, 'orders'));

drop policy if exists "product message readers" on public.product_messages;
drop policy if exists "product message senders" on public.product_messages;
create policy "product message readers" on public.product_messages
  for select using (
    auth.uid() = sender_id
    or exists (select 1 from public.products p where p.id = product_id and public.store_access(p.seller_id, 'messages'))
    or public.module_access('bao')
  );
create policy "product message senders" on public.product_messages
  for insert with check (
    auth.uid() = sender_id and (
      exists (select 1 from public.products p where p.id = product_id and public.store_access(p.seller_id, 'messages'))
      or public.module_access('bao')
    )
  );

drop policy if exists "seller updates own profile"        on public.seller_profiles;
drop policy if exists "registrar inserts seller profiles" on public.seller_profiles;
drop policy if exists "admin inserts seller profiles"     on public.seller_profiles;
drop policy if exists "store members update storefront"   on public.seller_profiles;
drop policy if exists "verification admin creates stores" on public.seller_profiles;
create policy "store members update storefront" on public.seller_profiles
  for update using (
    public.store_access(id, 'storefront') or public.module_access('verification', 'organizations') or public.module_access('bao')
  );
create policy "verification admin creates stores" on public.seller_profiles
  for insert with check (public.module_access('verification', 'organizations'));

-- ── 5. Verification data: Verification Admin dashboard only ────────────────
drop policy if exists "staff manage verification requests" on public.verification_requests;
create policy "staff manage verification requests" on public.verification_requests
  for all using (public.is_verification_admin()) with check (public.is_verification_admin());

drop policy if exists "staff read verification docs" on storage.objects;
create policy "staff read verification docs" on storage.objects
  for select to authenticated
  using (bucket_id = 'verification-docs' and public.is_verification_admin());

-- Restricted products unlock by verified affiliation only.
create or replace function public.viewer_role_allowed(allowed text[])
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and coalesce(is_identity_verified, false) and affiliation = any(allowed)
  );
$$;

-- ── 6. Migrate existing role-based accounts into dashboards ─────────────────
insert into public.dashboards (module, name)
select v.module, v.name
from (values ('verification','Verification Admin'), ('bao','BAO'), ('supply_office','Supply Office'), ('cashier','Cashier')) as v(module, name)
where not exists (select 1 from public.dashboards d where d.module = v.module);

-- Cashier and Supply Office each sell through one shared office store.
do $$
declare
  office record;
  office_store uuid;
begin
  for office in select * from (values
      ('cashier', 'cashier', 'University Cashier', 'Official university cashier store'),
      ('supply_office', 'supply_office', 'University Supply Office', 'Official university supply office store')
    ) as t(module, legacy_role, store_name, store_desc)
  loop
    select store_id into office_store from public.dashboards where module = office.module;
    if office_store is null then
      insert into public.seller_profiles (org_name, description, status)
      values (office.store_name, office.store_desc, 'active')
      returning id into office_store;
      update public.dashboards set store_id = office_store where module = office.module;
    end if;

    -- products / orders previously owned by that office's staff accounts move to the office store
    update public.products    set seller_id = office_store where seller_id in (select id from public.profiles where role = office.legacy_role);
    update public.order_items set seller_id = office_store where seller_id in (select id from public.profiles where role = office.legacy_role);
  end loop;
end;
$$;

-- Office staff → members of their office dashboard
insert into public.dashboard_members (dashboard_id, user_id)
select d.id, p.id
from public.profiles p
join public.dashboards d on d.module = case p.role
  when 'admin' then 'verification' when 'bao' then 'bao'
  when 'supply_office' then 'supply_office' when 'cashier' then 'cashier' end
on conflict do nothing;

-- Sellers → one organization dashboard each (store id = their old user id, so data lines up)
insert into public.seller_profiles (id, org_name, status)
select p.id, coalesce(nullif(p.full_name, ''), 'My Shop'), 'active'
from public.profiles p
where p.role = 'seller' and not exists (select 1 from public.seller_profiles s where s.id = p.id);

insert into public.dashboards (module, name, store_id)
select 'seller', s.org_name, s.id
from public.seller_profiles s
where not exists (select 1 from public.dashboards d where d.store_id = s.id);

insert into public.dashboard_members (dashboard_id, user_id, is_main)
select d.id, p.id, true
from public.dashboards d
join public.profiles p on p.id = d.store_id
where d.module = 'seller'
  and not exists (select 1 from public.dashboard_members m where m.dashboard_id = d.id and m.is_main)
on conflict do nothing;

-- Every dashboard without a Main Admin: earliest member becomes Main Admin
update public.dashboard_members m set is_main = true
from (
  select distinct on (m2.dashboard_id) m2.dashboard_id, m2.user_id
  from public.dashboard_members m2
  join public.profiles p on p.id = m2.user_id
  where not exists (select 1 from public.dashboard_members x where x.dashboard_id = m2.dashboard_id and x.is_main)
  order by m2.dashboard_id, p.created_at
) first_member
where m.dashboard_id = first_member.dashboard_id and m.user_id = first_member.user_id;

-- Roles no longer grant access; everyone is a regular user account.
do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'log_profile_changes') then
    alter table public.profiles disable trigger log_profile_changes;
  end if;
  update public.profiles set role = 'buyer' where role is distinct from 'buyer';
  if exists (select 1 from pg_trigger where tgname = 'log_profile_changes') then
    alter table public.profiles enable trigger log_profile_changes;
  end if;
end;
$$;

-- No Registrar anywhere.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('buyer','seller','bao','supply_office','cashier','admin')) not valid;

-- ── 7. Check the result ─────────────────────────────────────────────────────
-- Shows every dashboard and its Main Admin. If "main_admin" is empty for Verification Admin,
-- appoint one:  insert into dashboard_members (dashboard_id, user_id, is_main)
--               select id, '<your user id>', true from dashboards where module = 'verification';
select d.module, d.name, p.full_name as main_admin,
       (select count(*) from public.dashboard_members x where x.dashboard_id = d.id) as members
from public.dashboards d
left join public.dashboard_members m on m.dashboard_id = d.id and m.is_main
left join public.profiles p on p.id = m.user_id
order by d.module, d.name;


-- ############################################################
-- ## 11_storefront.sql
-- ############################################################

-- ============================================================
-- UniMerch — Seller Storefront module
-- Run in Supabase SQL Editor AFTER 10_dashboards.sql. Paste and run the WHOLE file. Safe to re-run.
--
--   • branding columns     — logo, banner and theme (accent / layout / banner / tagline)
--                            for future storefront customization
--   • auto storefront      — every Seller Dashboard gets its store (storefront) automatically
--   • indexes              — fast per-seller product listing for thousands of sellers
-- ============================================================

alter table public.seller_profiles add column if not exists logo_url   text;
alter table public.seller_profiles add column if not exists banner_url text;
alter table public.seller_profiles add column if not exists theme      jsonb not null default '{}'::jsonb;
alter table public.seller_profiles add column if not exists rating       numeric(3,2) not null default 0;
alter table public.seller_profiles add column if not exists rating_count integer      not null default 0;

-- Storefront listing: products of one seller, approved, newest first (+ category filter)
create index if not exists products_storefront_idx on public.products (seller_id, status, created_at desc);
create index if not exists products_storefront_category_idx on public.products (seller_id, category) where status = 'approved';
create index if not exists seller_follows_seller_idx on public.seller_follows (seller_id);

-- A Seller Dashboard created without a store automatically gets its storefront.
create or replace function public.ensure_dashboard_store()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.module = 'seller' and new.store_id is null then
    insert into public.seller_profiles (org_name, status, created_by)
    values (new.name, 'active', auth.uid())
    returning id into new.store_id;
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_dashboard_store on public.dashboards;
create trigger ensure_dashboard_store before insert on public.dashboards for each row execute procedure public.ensure_dashboard_store();

-- Storefronts are public pages: anyone (signed in or not) can read store records.
drop policy if exists "anyone reads seller profiles" on public.seller_profiles;
create policy "anyone reads seller profiles" on public.seller_profiles for select using (true);


-- ############################################################
-- ## 12_profile_rules.sql
-- ############################################################

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


-- ############################################################
-- ## 13_orders_pickup.sql
-- ############################################################

-- ============================================================
-- UniMerch — Order status timeline + seller pickup locations
-- Run in Supabase SQL Editor AFTER 12_profile_rules.sql. Paste and run the WHOLE file. Safe to re-run.
--
--   • seller_profiles.pickup_location / pickup_notes — set by the seller on their Storefront page
--   • orders.seller_id                               — each order belongs to ONE store
--   • orders.pickup_location / pickup_notes          — copied at checkout, shown on receipt + order details
--   • order_items.original_price                     — price before discount, for the price breakdown
--   • order_status_history                           — every status change with its time (timeline)
-- ============================================================

alter table public.seller_profiles add column if not exists pickup_location text;
alter table public.seller_profiles add column if not exists pickup_notes    text;

alter table public.orders add column if not exists seller_id       uuid references public.seller_profiles(id) on delete set null;
alter table public.orders add column if not exists pickup_location text;
alter table public.orders add column if not exists pickup_notes    text;
alter table public.orders add column if not exists updated_at      timestamptz not null default now();

alter table public.order_items add column if not exists original_price numeric(10,2);

create index if not exists orders_seller_idx on public.orders(seller_id, created_at desc);
create index if not exists orders_buyer_idx on public.orders(buyer_id, created_at desc);

-- Existing single-store orders: remember their store
update public.orders o set seller_id = s.seller_id
from (
  select order_id, min(seller_id::text)::uuid as seller_id
  from public.order_items group by order_id having count(distinct seller_id) = 1
) s
where o.id = s.order_id and o.seller_id is null
  -- only link orders whose seller has a store record (old orders may point at a plain user account)
  and exists (select 1 from public.seller_profiles sp where sp.id = s.seller_id);

-- ── Status history (timeline) ──────────────────────────────────────────────
create table if not exists public.order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  status      text not null,
  note        text,
  changed_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists order_status_history_order_idx on public.order_status_history(order_id, created_at);

alter table public.order_status_history enable row level security;

drop policy if exists "order parties read status history" on public.order_status_history;
create policy "order parties read status history" on public.order_status_history
  for select using (public.auth_buyer_has_order(order_id) or public.auth_seller_has_order(order_id) or public.is_staff());

create or replace function public.record_order_status()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_history (order_id, status, changed_by)
    values (new.id, new.status, auth.uid());
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists record_order_status_insert on public.orders;
drop trigger if exists record_order_status_update on public.orders;
create trigger record_order_status_update before update on public.orders for each row execute procedure public.record_order_status();

-- History for new orders is written after the row exists (FK), so use an AFTER INSERT trigger.
create or replace function public.record_order_created()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.order_status_history (order_id, status, changed_by, created_at)
  values (new.id, new.status, auth.uid(), new.created_at);
  return new;
end;
$$;
create trigger record_order_status_insert after insert on public.orders for each row execute procedure public.record_order_created();

-- Orders placed before this script: start their timeline with their current status
insert into public.order_status_history (order_id, status, created_at)
select o.id, o.status, o.created_at from public.orders o
where not exists (select 1 from public.order_status_history h where h.order_id = o.id);


-- ############################################################
-- ## 15_bao_bi.sql
-- ############################################################

-- ============================================================
-- UniMerch — BAO oversight: royalties, pulled products, inventory movement, sales reports
-- Run in Supabase SQL Editor AFTER 13_orders_pickup.sql. Paste and run the WHOLE file. Safe to re-run.
--
--   • order_items.royalty_amount   — royalty (per unit) owed to BAO, recorded at checkout
--   • products 'pulled' status     — BAO pulls out products with violations (reason + who + when)
--   • inventory_movements          — every stock change (restock / sale / cancellation / adjustment)
--                                    sales reduce stock automatically; cancellations return it
--   • sales_reports                — stores (sellers, cashier, supply office) submit sales reports to BAO
--   • BAO read access              — BAO sees all orders / order items for monitoring & analytics
-- ============================================================

-- ── Royalty per sold unit ───────────────────────────────────────────────────
alter table public.order_items add column if not exists royalty_amount numeric(10,2) not null default 0;

-- Backfill past sales of logo products from the product's current royalty
update public.order_items oi set royalty_amount = coalesce(p.royalty_amount, 0)
from public.products p
where oi.product_id = p.id and p.is_royalty_product and oi.royalty_amount = 0;

-- ── Pulled-out products (violations) ────────────────────────────────────────
alter table public.products add column if not exists pulled_reason text;
alter table public.products add column if not exists pulled_at     timestamptz;
alter table public.products add column if not exists pulled_by     uuid;

alter table public.products drop constraint if exists products_status_check;
alter table public.products add constraint products_status_check
  check (status in ('draft','pending','approved','rejected','pulled')) not valid;

-- ── Inventory movements ─────────────────────────────────────────────────────
create table if not exists public.inventory_movements (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.seller_profiles(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,
  product_name text,
  change      integer not null,
  reason      text not null check (reason in ('restock','sale','cancellation','adjustment','initial')),
  note        text,
  order_id    uuid references public.orders(id) on delete set null,
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists inventory_movements_store_idx on public.inventory_movements(store_id, created_at desc);
create index if not exists inventory_movements_product_idx on public.inventory_movements(product_id, created_at desc);

alter table public.inventory_movements enable row level security;

drop policy if exists "store members read movements" on public.inventory_movements;
create policy "store members read movements" on public.inventory_movements
  for select using (public.store_access(store_id) or public.module_access('bao'));

drop policy if exists "store members record movements" on public.inventory_movements;
create policy "store members record movements" on public.inventory_movements
  for insert with check (public.store_access(store_id, 'inventory') and created_by = auth.uid());

-- A sale takes the items out of stock (pre-orders never go below zero).
create or replace function public.stock_out_on_sale()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.product_id is not null then
    update public.products set stock = greatest(stock - new.quantity, 0), updated_at = now() where id = new.product_id;
    if exists (select 1 from public.seller_profiles where id = new.seller_id) then
      insert into public.inventory_movements (store_id, product_id, product_name, change, reason, order_id, created_by)
      values (new.seller_id, new.product_id, new.product_name, -new.quantity, 'sale', new.order_id, auth.uid());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stock_out_on_sale on public.order_items;
create trigger stock_out_on_sale after insert on public.order_items for each row execute procedure public.stock_out_on_sale();

-- A cancelled order returns its items to stock.
create or replace function public.stock_back_on_cancel()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  item record;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    for item in select * from public.order_items where order_id = new.id and product_id is not null loop
      update public.products set stock = stock + item.quantity, updated_at = now() where id = item.product_id;
      if exists (select 1 from public.seller_profiles where id = item.seller_id) then
        insert into public.inventory_movements (store_id, product_id, product_name, change, reason, order_id, created_by)
        values (item.seller_id, item.product_id, item.product_name, item.quantity, 'cancellation', new.id, auth.uid());
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists stock_back_on_cancel on public.orders;
create trigger stock_back_on_cancel after update on public.orders for each row execute procedure public.stock_back_on_cancel();

-- ── Sales reports submitted to BAO ─────────────────────────────────────────
create table if not exists public.sales_reports (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.seller_profiles(id) on delete cascade,
  module        text not null check (module in ('seller','cashier','supply_office')),
  period_start  date not null,
  period_end    date not null,
  orders_count  integer not null default 0,
  items_sold    integer not null default 0,
  gross_sales   numeric(12,2) not null default 0,
  royalty_due   numeric(12,2) not null default 0,
  net_sales     numeric(12,2) not null default 0,
  breakdown     jsonb not null default '[]'::jsonb,
  notes         text,
  submitted_by  uuid,
  status        text not null default 'submitted' check (status in ('submitted','acknowledged','flagged')),
  bao_note      text,
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists sales_reports_created_idx on public.sales_reports(created_at desc);
create index if not exists sales_reports_store_idx on public.sales_reports(store_id, created_at desc);

alter table public.sales_reports enable row level security;

drop policy if exists "stores submit sales reports" on public.sales_reports;
create policy "stores submit sales reports" on public.sales_reports
  for insert with check (public.store_access(store_id, 'reports') and submitted_by = auth.uid());

drop policy if exists "stores read own sales reports" on public.sales_reports;
create policy "stores read own sales reports" on public.sales_reports
  for select using (public.store_access(store_id));

drop policy if exists "bao manages sales reports" on public.sales_reports;
create policy "bao manages sales reports" on public.sales_reports
  for all using (public.module_access('bao')) with check (public.module_access('bao'));

-- ── BAO monitors the whole system (read-only on orders) ─────────────────────
drop policy if exists "bao reads all orders" on public.orders;
create policy "bao reads all orders" on public.orders for select using (public.module_access('bao'));

drop policy if exists "bao reads all order items" on public.order_items;
create policy "bao reads all order items" on public.order_items for select using (public.module_access('bao'));

drop policy if exists "bao reads status history" on public.order_status_history;
create policy "bao reads status history" on public.order_status_history for select using (public.module_access('bao'));

-- BAO can read every account (sellers, members) — BAO is part of is_staff(), kept explicit here:
drop policy if exists "bao reads profiles" on public.profiles;
create policy "bao reads profiles" on public.profiles for select using (public.module_access('bao'));



-- ############################################################
-- ## 17_notifications.sql
-- ############################################################

-- ============================================================
-- UniMerch — In-app notifications (the bell icon)
-- Run in Supabase SQL Editor AFTER setup_all.sql. Paste and run the WHOLE file. Safe to re-run.
--
-- Notifications are created automatically by the database when something happens:
--   buyers      → their order status changes · their verification is decided
--   stores      → a new order arrives · BAO approves / rejects / pulls a product · BAO reviews a sales report
--   Verification Admin → new verification request · a seller reports an account
--   BAO         → a product awaits approval · a store submits a sales report
-- ============================================================

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null default 'info',
  title       text not null,
  body        text,
  href        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists "users mark own notifications read" on public.notifications;
create policy "users mark own notifications read" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users delete own notifications" on public.notifications;
create policy "users delete own notifications" on public.notifications
  for delete using (user_id = auth.uid());

-- ── Helpers ─────────────────────────────────────────────────────────────────
create or replace function public.notify_user(p_user uuid, p_kind text, p_title text, p_body text, p_href text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, href)
  select p_user, p_kind, p_title, p_body, p_href
  where p_user is not null and p_user is distinct from auth.uid();   -- don't notify people about their own actions
$$;

-- Everyone on a dashboard who can use `p_perm` (Main Admins always).
create or replace function public.notify_dashboard(p_dashboard uuid, p_perm text, p_kind text, p_title text, p_body text, p_href text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, href)
  select m.user_id, p_kind, p_title, p_body, p_href
  from public.dashboard_members m
  where m.dashboard_id = p_dashboard
    and (m.is_main or p_perm is null or p_perm = any(m.permissions))
    and m.user_id is distinct from auth.uid();
$$;

create or replace function public.store_dashboard_path(p_store uuid)
returns table (dashboard_id uuid, base text)
language sql security definer set search_path = public stable as $$
  select d.id, case d.module when 'cashier' then '/cashier' when 'supply_office' then '/supply-office' else '/seller' end
  from public.dashboards d where d.store_id = p_store limit 1;
$$;

-- ── Orders ──────────────────────────────────────────────────────────────────
create or replace function public.notify_order_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  dash record;
  code text := upper(left(new.id::text, 8));
  label text;
begin
  if tg_op = 'INSERT' then
    if new.seller_id is not null then
      select * into dash from public.store_dashboard_path(new.seller_id);
      if dash.dashboard_id is not null then
        perform public.notify_dashboard(dash.dashboard_id, 'orders', 'order', 'New order #' || code,
          'A buyer placed an order worth ₱' || to_char(new.total, 'FM999,999,990.00') || '.', dash.base || '/orders');
      end if;
    end if;
  elsif new.status is distinct from old.status then
    label := case new.status
      when 'paid' then 'Payment confirmed — your items are being prepared'
      when 'partially_paid' then 'Partial payment received'
      when 'ready_for_pickup' then 'Ready for pickup'
      when 'completed' then 'Order completed'
      when 'cancelled' then 'Order cancelled'
      else 'Order updated' end;
    perform public.notify_user(new.buyer_id, 'order', label, 'Order #' || code, '/marketplace/orders/' || new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists notify_order_events on public.orders;
create trigger notify_order_events after insert or update of status on public.orders for each row execute procedure public.notify_order_events();

-- ── Verification ────────────────────────────────────────────────────────────
create or replace function public.notify_verification_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  vdash uuid;
begin
  if tg_op = 'INSERT' then
    select id into vdash from public.dashboards where module = 'verification';
    if vdash is not null then
      perform public.notify_dashboard(vdash, 'queue', 'verification', 'New verification request',
        coalesce(new.full_name, 'A user') || ' applied as ' || new.claimed_affiliation || '.', '/admin/queue/' || new.id);
    end if;
  elsif new.status is distinct from old.status and new.status in ('approved','rejected','needs_resubmission') then
    perform public.notify_user(new.user_id, 'verification',
      case new.status when 'approved' then 'You are verified!' when 'rejected' then 'Verification declined' else 'Please resubmit your documents' end,
      coalesce(new.review_reason, case new.status when 'approved' then 'Restricted items for your group are now unlocked.' else 'Open your profile for details.' end),
      '/marketplace/account');
  end if;
  return new;
end;
$$;

drop trigger if exists notify_verification_events on public.verification_requests;
create trigger notify_verification_events after insert or update of status on public.verification_requests for each row execute procedure public.notify_verification_events();

-- ── Products (approval / rejection / pull-out) ──────────────────────────────
create or replace function public.notify_product_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  dash record;
  bao uuid;
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status = 'pending' then
      select id into bao from public.dashboards where module = 'bao';
      if bao is not null then
        perform public.notify_dashboard(bao, 'approvals', 'product', 'Product awaiting approval', new.name, '/bao/approvals');
      end if;
    elsif tg_op = 'UPDATE' and new.status in ('approved','rejected','pulled') then
      select * into dash from public.store_dashboard_path(new.seller_id);
      if dash.dashboard_id is not null then
        perform public.notify_dashboard(dash.dashboard_id, 'products', 'product',
          case new.status when 'approved' then 'Product approved — now live' when 'rejected' then 'Product rejected by BAO' else 'Product pulled out by BAO' end,
          new.name || coalesce(' — ' || new.bao_comment, ''), dash.base || '/products');
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_product_events on public.products;
create trigger notify_product_events after insert or update of status on public.products for each row execute procedure public.notify_product_events();

-- ── Sales reports ───────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.sales_reports') is not null then
    execute $f$
      create or replace function public.notify_report_events()
      returns trigger language plpgsql security definer set search_path = public as $b$
      declare
        bao uuid;
        dash record;
      begin
        if tg_op = 'INSERT' then
          select id into bao from public.dashboards where module = 'bao';
          if bao is not null then
            perform public.notify_dashboard(bao, 'reports', 'report', 'New sales report',
              'Period ' || new.period_start || ' to ' || new.period_end || '.', '/bao/reports?open=' || new.id);
          end if;
        elsif new.status is distinct from old.status then
          select * into dash from public.store_dashboard_path(new.store_id);
          perform public.notify_user(new.submitted_by, 'report',
            case new.status when 'acknowledged' then 'BAO acknowledged your sales report' else 'BAO flagged your sales report' end,
            coalesce(new.bao_note, 'Period ' || new.period_start || ' to ' || new.period_end || '.'),
            coalesce(dash.base, '/seller') || '/reports');
        end if;
        return new;
      end;
      $b$;
    $f$;
    execute 'drop trigger if exists notify_report_events on public.sales_reports';
    execute 'create trigger notify_report_events after insert or update of status on public.sales_reports for each row execute procedure public.notify_report_events()';
  end if;
end;
$$;

-- ── Account reports (dummy accounts) ────────────────────────────────────────
do $$
begin
  if to_regclass('public.account_reports') is not null then
    execute $f$
      create or replace function public.notify_account_report()
      returns trigger language plpgsql security definer set search_path = public as $b$
      declare
        vdash uuid;
      begin
        select id into vdash from public.dashboards where module = 'verification';
        if vdash is not null then
          perform public.notify_dashboard(vdash, 'reports', 'report', 'Account reported by a seller',
            replace(new.reason, '_', ' ') || coalesce(' — ' || new.details, ''), '/admin/reports');
        end if;
        return new;
      end;
      $b$;
    $f$;
    execute 'drop trigger if exists notify_account_report on public.account_reports';
    execute 'create trigger notify_account_report after insert on public.account_reports for each row execute procedure public.notify_account_report()';
  end if;
end;
$$;



-- ############################################################
-- ## 18_store_violations.sql
-- ############################################################

-- ============================================================
-- UniMerch — BAO flags sellers for violations
-- Run in Supabase SQL Editor AFTER 17_notifications.sql. Paste and run the WHOLE file. Safe to re-run.
--
--   • store_violations — BAO records a violation against a store (optionally for one product)
--   • the store's dashboard members are notified automatically
-- ============================================================

create table if not exists public.store_violations (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.seller_profiles(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,
  product_name text,
  severity    text not null default 'warning' check (severity in ('warning','serious')),
  reason      text not null,
  flagged_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists store_violations_store_idx on public.store_violations(store_id, created_at desc);

alter table public.store_violations enable row level security;

drop policy if exists "bao manages violations" on public.store_violations;
create policy "bao manages violations" on public.store_violations
  for all using (public.module_access('bao')) with check (public.module_access('bao') and flagged_by = auth.uid());

drop policy if exists "stores read own violations" on public.store_violations;
create policy "stores read own violations" on public.store_violations
  for select using (public.store_access(store_id));

-- Notify the store when BAO flags it
create or replace function public.notify_store_violation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  dash record;
begin
  select * into dash from public.store_dashboard_path(new.store_id);
  if dash.dashboard_id is not null then
    perform public.notify_dashboard(dash.dashboard_id, null, 'violation',
      case new.severity when 'serious' then 'Serious violation flagged by BAO' else 'Violation warning from BAO' end,
      coalesce(new.product_name || ': ', '') || new.reason, dash.base || '/products');
  end if;
  return new;
end;
$$;

drop trigger if exists notify_store_violation on public.store_violations;
create trigger notify_store_violation after insert on public.store_violations for each row execute procedure public.notify_store_violation();



-- ############################################################
-- ## 19_cashier_branches.sql
-- ############################################################

-- ============================================================
-- UniMerch — Cashier branches (one Cashier dashboard + store per campus / department)
-- Run in Supabase SQL Editor AFTER setup_all.sql. Paste and run the WHOLE file. Safe to re-run.
--
-- The university has a cashier office per campus branch. Each branch is its own dashboard with
-- its own store (a secondary seller of uniforms and university merchandise), scoped to:
--   • campus       — serves the whole campus branch
--   • department   — serves one department of a campus
--   • centralized  — serves the university centrally (still tied to a campus location)
-- The Verification Admin creates branches. The existing Cashier becomes "Cashier — Bulan Campus".
-- ============================================================

-- Branch identity on the dashboard
alter table public.dashboards add column if not exists campus     text;
alter table public.dashboards add column if not exists scope      text;
alter table public.dashboards add column if not exists department text;
alter table public.dashboards drop constraint if exists dashboards_scope_check;
alter table public.dashboards add constraint dashboards_scope_check
  check (scope is null or scope in ('campus','department','centralized')) not valid;
alter table public.dashboards drop constraint if exists dashboards_cashier_campus_check;
alter table public.dashboards add constraint dashboards_cashier_campus_check
  check (module <> 'cashier' or campus is not null) not valid;

-- Cashier is no longer a single dashboard: many branches, like seller organizations
drop index if exists public.dashboards_single_module;
create unique index if not exists dashboards_single_module on public.dashboards(module)
  where module not in ('seller','cashier');

-- ── The existing Cashier becomes the Bulan Campus branch ───────────────────
update public.dashboards
set name = 'Cashier — Bulan Campus', campus = 'bulan', scope = 'campus'
where module = 'cashier' and campus is null;

update public.seller_profiles sp
set org_name = 'University Cashier — Bulan Campus', campus = 'bulan', category = coalesce(sp.category, 'University Cashier')
from public.dashboards d
where d.module = 'cashier' and d.store_id = sp.id and d.campus = 'bulan' and sp.org_name = 'University Cashier';

-- ── A new Cashier branch automatically gets its store (storefront) ─────────
create or replace function public.ensure_dashboard_store()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.module in ('seller','cashier') and new.store_id is null then
    insert into public.seller_profiles (org_name, status, created_by, campus, category)
    values (new.name, 'active', auth.uid(), new.campus, case when new.module = 'cashier' then 'University Cashier' end)
    returning id into new.store_id;
  end if;
  return new;
end;
$$;

-- ── The Verification Admin (Cashier Branches page) can create and staff branches ──
drop policy if exists "verification admin manages dashboards" on public.dashboards;
create policy "verification admin manages dashboards" on public.dashboards
  for all using (public.module_access('verification', 'organizations') or public.module_access('verification', 'cashiers'))
  with check (public.module_access('verification', 'organizations') or public.module_access('verification', 'cashiers'));

drop policy if exists "verification admin creates stores" on public.seller_profiles;
create policy "verification admin creates stores" on public.seller_profiles
  for insert with check (public.module_access('verification', 'organizations') or public.module_access('verification', 'cashiers'));

drop policy if exists "main admin manages members" on public.dashboard_members;
create policy "main admin manages members" on public.dashboard_members
  for all using (
    public.is_dashboard_main(dashboard_id) or public.is_verification_main()
    or public.module_access('verification', 'organizations') or public.module_access('verification', 'dashboards')
    or public.module_access('verification', 'cashiers')
  )
  with check (
    public.is_dashboard_main(dashboard_id) or public.is_verification_main()
    or public.module_access('verification', 'organizations') or public.module_access('verification', 'dashboards')
    or public.module_access('verification', 'cashiers')
  );

create or replace function public.find_user_by_email(p_email text)
returns table (id uuid, full_name text)
language sql security definer set search_path = public, auth stable as $$
  select u.id, p.full_name
  from auth.users u left join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(p_email))
    and (
      exists (select 1 from public.dashboard_members m where m.user_id = auth.uid() and m.is_main)
      or public.module_access('verification', 'organizations')
      or public.module_access('verification', 'dashboards')
      or public.module_access('verification', 'cashiers')
    )
  limit 1;
$$;
grant execute on function public.find_user_by_email(text) to authenticated;


-- Check: every Cashier branch
select d.name, d.campus, d.scope, d.department, sp.org_name as store
from public.dashboards d left join public.seller_profiles sp on sp.id = d.store_id
where d.module = 'cashier' order by d.campus, d.name;


-- Refresh Supabase's API so the new tables/columns are visible immediately.
notify pgrst, 'reload schema';


-- ============================================================
-- UniMerch — Remove every Registrar leftover from the database
-- There is no Registrar in UniMerch. The old demo account registrar@unimerch.sorsu.edu.ph
-- ("Registrar Officer") was carried into the Cashier dashboard by earlier migrations, so
-- logging in with it opened a "Registrar" dashboard. This removes it for good.
-- Safe to re-run. Paste the WHOLE file into the Supabase SQL Editor and click Run.
-- ============================================================

-- 1. Registrar accounts: the old demo login, any profile still named/role "registrar".
drop table if exists pg_temp.registrar_accounts;
create temporary table registrar_accounts as
select u.id
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) like 'registrar%'
   or p.role = 'registrar'
   or p.full_name ilike '%registrar%';

-- 2. They lose every dashboard membership (no more "Registrar" dashboard on login).
delete from public.dashboard_members where user_id in (select id from registrar_accounts);

-- 3. Delete the accounts. If an account is still referenced (e.g. it created records),
--    it is banned and renamed instead so it can never log in to a dashboard again.
do $$
declare r record;
begin
  for r in select id from registrar_accounts loop
    begin
      delete from auth.users where id = r.id;
    exception when others then
      update public.profiles
      set role = 'buyer', full_name = 'Removed account', account_status = 'banned'
      where id = r.id;
      update auth.users set banned_until = 'infinity' where id = r.id;
    end;
  end loop;
end $$;

-- 4. Any dashboard still named "Registrar" is removed (members go with it).
--    Cashier branches were already renamed by 19_cashier_branches.sql.
update public.seller_profiles set status = 'suspended'
where id in (select store_id from public.dashboards where name ilike '%registrar%' and store_id is not null);
delete from public.dashboards where name ilike '%registrar%';

-- 5. Stores still called "Registrar" are hidden from the marketplace.
update public.seller_profiles set status = 'suspended' where org_name ilike '%registrar%';

-- 6. No "registrar" role value anywhere.
update public.profiles set role = 'buyer' where role = 'registrar';
drop policy if exists "registrar inserts seller profiles" on public.seller_profiles;

notify pgrst, 'reload schema';

-- Check: both should return no rows.
select u.email, p.full_name from auth.users u left join public.profiles p on p.id = u.id
where lower(u.email) like 'registrar%' and u.banned_until is null;
select module, name from public.dashboards where name ilike '%registrar%';


-- ============================================================
-- UniMerch — Walk-in pre-orders: store hours + claim deadlines
-- Run in Supabase SQL Editor AFTER 21_delete_user.sql. Paste and run the WHOLE file. Safe to re-run.
--
--   • seller_profiles.store_hours         — when the buyer can walk in to pay/claim (shown at checkout)
--   • seller_profiles.claim_window_days   — days a buyer has to claim an order after it is placed
--   • orders.pickup_deadline              — claim-by date, copied at checkout
-- ============================================================

alter table public.seller_profiles add column if not exists store_hours text;
alter table public.seller_profiles add column if not exists claim_window_days integer not null default 7;
alter table public.orders add column if not exists pickup_deadline timestamptz;

do $$ begin
  alter table public.seller_profiles add constraint seller_claim_window_days_check check (claim_window_days between 1 and 60);
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';


-- ============================================================
-- UniMerch — Buyer ↔ seller chat on an order ("Chat with Seller")
-- Run in Supabase SQL Editor AFTER 22_preorder_pickup.sql. Paste and run the WHOLE file. Safe to re-run.
--
--   • order_messages — one conversation per order, between the buyer and the store's staff
--   • notifications  — a new message notifies the other side (bell icon)
-- ============================================================

create table if not exists public.order_messages (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  sender_id   uuid not null references auth.users(id) on delete cascade,
  from_store  boolean not null default false,   -- true when sent by the store's staff
  message     text not null check (length(trim(message)) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists order_messages_order_idx on public.order_messages(order_id, created_at);

alter table public.order_messages enable row level security;

drop policy if exists "order chat readers" on public.order_messages;
create policy "order chat readers" on public.order_messages for select using (
  exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid())
  or public.auth_seller_has_order(order_id)
);

-- Buyers post as themselves; store staff with the orders permission post as the store.
drop policy if exists "order chat senders" on public.order_messages;
create policy "order chat senders" on public.order_messages for insert with check (
  sender_id = auth.uid() and (
    (not from_store and exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid()))
    or (from_store and public.auth_seller_has_order(order_id))
  )
);

-- Live updates for open chat panels
do $$ begin
  alter publication supabase_realtime add table public.order_messages;
exception when duplicate_object or undefined_object then null; end $$;

-- ── Notifications ───────────────────────────────────────────────────────────
create or replace function public.notify_order_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  o record;
  dash record;
  code text := upper(left(new.order_id::text, 8));
  preview text := left(new.message, 120);
begin
  select id, buyer_id, seller_id into o from public.orders where id = new.order_id;
  if new.from_store then
    perform public.notify_user(o.buyer_id, 'message', 'New message from the seller', 'Order #' || code || ': ' || preview,
      '/marketplace/orders/' || new.order_id || '#chat');
  elsif o.seller_id is not null then
    select * into dash from public.store_dashboard_path(o.seller_id);
    if dash.dashboard_id is not null then
      perform public.notify_dashboard(dash.dashboard_id, 'orders', 'message', 'Buyer message on order #' || code, preview,
        dash.base || '/orders?chat=' || new.order_id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_order_message on public.order_messages;
create trigger notify_order_message after insert on public.order_messages for each row execute procedure public.notify_order_message();

notify pgrst, 'reload schema';


-- ============================================================
-- UniMerch — Buyer ↔ seller messaging about a product ("Message Seller")
-- Run in Supabase SQL Editor AFTER 23_order_chat.sql. Paste and run the WHOLE file. Safe to re-run.
--
--   • conversations              — one per buyer + store + product; status open / pending / closed
--   • conversation_messages      — text, photo, product card (upsell) or system note; with read receipts
--   • notification_preferences   — per-user switches for order and message notifications
--   • chat-images bucket         — photos sent in chat
--
-- Lifecycle: buyer writes → pending (waiting for the store) · store replies → open ·
--            the buyer orders the product, either side closes it, or 14 days pass → closed.
--            Any new message reopens a closed conversation.
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.conversations (
  id               uuid primary key default gen_random_uuid(),
  buyer_id         uuid not null references public.profiles(id) on delete cascade,
  seller_id        uuid not null references public.seller_profiles(id) on delete cascade,  -- the store
  product_id       uuid references public.products(id) on delete set null,
  status           text not null default 'open' check (status in ('open','pending','closed')),
  closed_reason    text check (closed_reason in ('purchase','inactive','buyer','seller')),
  last_message     text,
  last_message_at  timestamptz not null default now(),
  last_from_store  boolean,
  created_at       timestamptz not null default now(),
  unique (buyer_id, seller_id, product_id)
);
create index if not exists conversations_buyer_idx on public.conversations(buyer_id, last_message_at desc);
create index if not exists conversations_seller_idx on public.conversations(seller_id, last_message_at desc);

create table if not exists public.conversation_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  sender_id        uuid references auth.users(id) on delete set null,     -- null for system notes
  from_store       boolean not null default false,
  kind             text not null default 'text' check (kind in ('text','image','product','system')),
  content          text check (content is null or length(content) <= 2000),
  image_url        text,
  product_id       uuid references public.products(id) on delete set null, -- product card (kind = 'product')
  is_read          boolean not null default false,
  created_at       timestamptz not null default now(),
  check (kind <> 'text'    or length(trim(coalesce(content, ''))) > 0),
  check (kind <> 'image'   or image_url is not null),
  check (kind <> 'product' or product_id is not null)
);
create index if not exists conversation_messages_conv_idx on public.conversation_messages(conversation_id, created_at);
create index if not exists conversation_messages_unread_idx on public.conversation_messages(conversation_id) where not is_read;

create table if not exists public.notification_preferences (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  order_updates  boolean not null default true,
  messages       boolean not null default true,
  updated_at     timestamptz not null default now()
);

-- Columns from 11_storefront.sql / 13_orders_pickup.sql that the inbox functions read (no-ops if present)
alter table public.seller_profiles add column if not exists logo_url text;
alter table public.orders add column if not exists seller_id uuid references public.seller_profiles(id) on delete set null;

-- ── Notifications inbox (also created by 17_notifications.sql; repeated so this file works on its own) ──
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null default 'info',
  title       text not null,
  body        text,
  href        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(user_id) where read_at is null;
alter table public.notifications enable row level security;

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications
  for select using (user_id = auth.uid());
drop policy if exists "users mark own notifications read" on public.notifications;
create policy "users mark own notifications read" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users delete own notifications" on public.notifications;
create policy "users delete own notifications" on public.notifications
  for delete using (user_id = auth.uid());

create or replace function public.store_dashboard_path(p_store uuid)
returns table (dashboard_id uuid, base text)
language sql security definer set search_path = public stable as $$
  select d.id, case d.module when 'cashier' then '/cashier' when 'supply_office' then '/supply-office' else '/seller' end
  from public.dashboards d where d.store_id = p_store limit 1;
$$;

-- ── Access helpers ──────────────────────────────────────────────────────────
-- 'buyer', 'store' (staff with the Messages permission) or null for the signed-in user.
create or replace function public.conversation_role(p_conv uuid)
returns text language sql security definer set search_path = public stable as $$
  select case
    when c.buyer_id = auth.uid() then 'buyer'
    when public.store_access(c.seller_id, 'messages') then 'store'
  end
  from public.conversations c where c.id = p_conv;
$$;

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.notification_preferences enable row level security;

-- Conversations are created and changed only through the functions below.
drop policy if exists "conversation participants read" on public.conversations;
create policy "conversation participants read" on public.conversations for select
  using (buyer_id = auth.uid() or public.store_access(seller_id, 'messages'));

drop policy if exists "conversation participants read messages" on public.conversation_messages;
create policy "conversation participants read messages" on public.conversation_messages for select
  using (public.conversation_role(conversation_id) is not null);

drop policy if exists "conversation participants send" on public.conversation_messages;
create policy "conversation participants send" on public.conversation_messages for insert with check (
  sender_id = auth.uid() and kind <> 'system' and not is_read and (
    (not from_store and public.conversation_role(conversation_id) = 'buyer')
    or (from_store and public.conversation_role(conversation_id) = 'store')
  )
);

drop policy if exists "users manage own notification preferences" on public.notification_preferences;
create policy "users manage own notification preferences" on public.notification_preferences for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Notification preferences (applied to every notification helper) ─────────
create or replace function public.wants_notification(p_user uuid, p_kind text)
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((
    select case p_kind when 'message' then np.messages when 'order' then np.order_updates else true end
    from public.notification_preferences np where np.user_id = p_user
  ), true);
$$;

create or replace function public.notify_user(p_user uuid, p_kind text, p_title text, p_body text, p_href text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, href)
  select p_user, p_kind, p_title, p_body, p_href
  where p_user is not null and p_user is distinct from auth.uid()   -- don't notify people about their own actions
    and public.wants_notification(p_user, p_kind);
$$;

create or replace function public.notify_dashboard(p_dashboard uuid, p_perm text, p_kind text, p_title text, p_body text, p_href text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, href)
  select m.user_id, p_kind, p_title, p_body, p_href
  from public.dashboard_members m
  where m.dashboard_id = p_dashboard
    and (m.is_main or p_perm is null or p_perm = any(m.permissions))
    and m.user_id is distinct from auth.uid()
    and public.wants_notification(m.user_id, p_kind);
$$;

-- ── Start (or reopen) a conversation from a product page ────────────────────
create or replace function public.start_conversation(p_product uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  prod record;
  store_name text;
  conv uuid;
begin
  if me is null then raise exception 'Sign in to message the seller.'; end if;
  select id, seller_id, name into prod from public.products where id = p_product and status = 'approved';
  if prod.id is null then raise exception 'This product is no longer available.'; end if;
  if public.store_access(prod.seller_id) then raise exception 'You can''t message your own store.'; end if;

  select id into conv from public.conversations where buyer_id = me and seller_id = prod.seller_id and product_id = p_product;
  if conv is not null then return conv; end if;

  select coalesce(org_name, 'the seller') into store_name from public.seller_profiles where id = prod.seller_id;
  insert into public.conversations (buyer_id, seller_id, product_id, status)
  values (me, prod.seller_id, p_product, 'open')
  on conflict (buyer_id, seller_id, product_id) do nothing
  returning id into conv;
  if conv is null then  -- created by a parallel request
    select id into conv from public.conversations where buyer_id = me and seller_id = prod.seller_id and product_id = p_product;
    return conv;
  end if;

  insert into public.conversation_messages (conversation_id, kind, content, is_read)
  values (conv, 'system', 'You are now discussing ' || prod.name || ' with ' || store_name || '.', true);
  return conv;
end;
$$;

-- Marks the other side's messages as read (read receipts).
create or replace function public.mark_conversation_read(p_conv uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r text := public.conversation_role(p_conv);
begin
  if r is null then return; end if;
  update public.conversation_messages
  set is_read = true
  where conversation_id = p_conv and not is_read and kind <> 'system' and from_store = (r = 'buyer');
end;
$$;

-- Either side can close or reopen a conversation.
create or replace function public.set_conversation_status(p_conv uuid, p_close boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  r text := public.conversation_role(p_conv);
begin
  if r is null then raise exception 'Conversation not found.'; end if;
  update public.conversations
  set status = case when p_close then 'closed' else 'open' end,
      closed_reason = case when p_close then case r when 'store' then 'seller' else 'buyer' end end
  where id = p_conv and (status = 'closed') is distinct from p_close;
  if found then
    insert into public.conversation_messages (conversation_id, kind, content, is_read)
    values (p_conv, 'system', 'Conversation ' || case when p_close then 'closed' else 'reopened' end
      || ' by the ' || case r when 'store' then 'seller' else 'buyer' end || '.', true);
  end if;
end;
$$;

-- Closes conversations with no messages for 14 days. Called when an inbox loads (and daily by pg_cron if available).
create or replace function public.close_inactive_conversations()
returns void language plpgsql security definer set search_path = public as $$
declare
  c record;
begin
  for c in
    update public.conversations set status = 'closed', closed_reason = 'inactive'
    where status <> 'closed' and last_message_at < now() - interval '14 days'
    returning id
  loop
    insert into public.conversation_messages (conversation_id, kind, content, is_read)
    values (c.id, 'system', 'Conversation closed after 14 days without messages.', true);
  end loop;
end;
$$;

do $$ begin
  perform cron.schedule('close-inactive-conversations', '0 3 * * *', 'select public.close_inactive_conversations()');
exception when others then null;  -- pg_cron not enabled: inboxes close stale conversations when they load
end $$;

-- ── Inbox + conversation details (also returns the other side's name, which RLS would hide) ──
create or replace function public.list_conversations(p_store uuid default null)
returns table (
  id uuid, status text, closed_reason text, last_message text, last_message_at timestamptz, last_from_store boolean,
  product_id uuid, product_name text, product_image text, product_price numeric,
  seller_id uuid, store_name text, store_logo text,
  buyer_id uuid, buyer_name text, unread integer
) language sql security definer set search_path = public stable as $$
  select c.id, c.status, c.closed_reason, c.last_message, c.last_message_at, c.last_from_store,
         p.id, p.name, p.image_url, p.price,
         c.seller_id, s.org_name, s.logo_url,
         c.buyer_id, coalesce(nullif(trim(b.full_name), ''), 'Buyer'),
         (select count(*)::int from public.conversation_messages m
          where m.conversation_id = c.id and not m.is_read and m.kind <> 'system'
            and m.from_store = (p_store is null))
  from public.conversations c
  left join public.products p on p.id = c.product_id
  left join public.seller_profiles s on s.id = c.seller_id
  left join public.profiles b on b.id = c.buyer_id
  where case when p_store is null then c.buyer_id = auth.uid()
             else c.seller_id = p_store and public.store_access(p_store, 'messages') end
  order by c.last_message_at desc
  limit 200;
$$;

create or replace function public.conversation_details(p_conv uuid)
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'id', c.id, 'status', c.status, 'closed_reason', c.closed_reason, 'role', public.conversation_role(c.id),
    'product', case when p.id is null then null else jsonb_build_object(
      'id', p.id, 'name', p.name, 'price', p.price, 'image_url', p.image_url, 'badge', p.badge,
      'stock', p.stock, 'variations', coalesce(to_jsonb(p.variations), '[]'::jsonb), 'available', p.status = 'approved') end,
    'store', jsonb_build_object('id', s.id, 'name', s.org_name, 'logo_url', s.logo_url),
    'buyer', jsonb_build_object('id', b.id, 'name', coalesce(nullif(trim(b.full_name), ''), 'Buyer'),
      'verified', b.is_identity_verified, 'affiliation', b.affiliation, 'campus', b.campus,
      'course', b.course, 'department', b.department,
      'orders_with_store', (select count(*) from public.orders o where o.buyer_id = b.id and o.seller_id = c.seller_id and o.status = 'completed'))
  )
  from public.conversations c
  left join public.products p on p.id = c.product_id
  left join public.seller_profiles s on s.id = c.seller_id
  left join public.profiles b on b.id = c.buyer_id
  where c.id = p_conv and public.conversation_role(c.id) is not null;
$$;

-- Total unread messages for the header badge (buyer side) or a store's inbox.
create or replace function public.unread_message_count(p_store uuid default null)
returns integer language sql security definer set search_path = public stable as $$
  select count(*)::int
  from public.conversation_messages m
  join public.conversations c on c.id = m.conversation_id
  where not m.is_read and m.kind <> 'system'
    and case when p_store is null then c.buyer_id = auth.uid() and m.from_store
             else c.seller_id = p_store and not m.from_store and public.store_access(p_store, 'messages') end;
$$;

-- ── On every message: validate, update the conversation, notify the other side ──
create or replace function public.before_conversation_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Product cards may only show the conversation store's own products
  if new.kind = 'product' and not exists (
    select 1 from public.products p join public.conversations c on c.seller_id = p.seller_id
    where p.id = new.product_id and c.id = new.conversation_id
  ) then
    raise exception 'You can only share your own store''s products.';
  end if;
  return new;
end;
$$;

drop trigger if exists before_conversation_message on public.conversation_messages;
create trigger before_conversation_message before insert on public.conversation_messages
  for each row execute procedure public.before_conversation_message();

create or replace function public.after_conversation_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c record;
  dash record;
  preview text;
  product_name text;
begin
  if new.kind = 'system' then return new; end if;
  select * into c from public.conversations where id = new.conversation_id;
  select name into product_name from public.products where id = c.product_id;
  preview := case new.kind when 'image' then '📷 Photo' when 'product' then '🛍️ Shared a product' else left(new.content, 120) end;

  update public.conversations
  set last_message = preview, last_message_at = new.created_at, last_from_store = new.from_store,
      status = case when new.from_store then 'open' else 'pending' end, closed_reason = null
  where id = new.conversation_id;

  -- One unread notification per conversation: replace the previous one instead of stacking them
  if new.from_store then
    delete from public.notifications
    where user_id = c.buyer_id and kind = 'message' and read_at is null and href = '/marketplace/messages?c=' || c.id;
    perform public.notify_user(c.buyer_id, 'message', 'New reply about ' || coalesce(product_name, 'your inquiry'), preview,
      '/marketplace/messages?c=' || c.id);
  else
    select * into dash from public.store_dashboard_path(c.seller_id);
    if dash.dashboard_id is not null then
      delete from public.notifications
      where kind = 'message' and read_at is null and href = dash.base || '/messages?c=' || c.id;
      perform public.notify_dashboard(dash.dashboard_id, 'messages', 'message', 'Buyer message about ' || coalesce(product_name, 'a product'), preview,
        dash.base || '/messages?c=' || c.id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists after_conversation_message on public.conversation_messages;
create trigger after_conversation_message after insert on public.conversation_messages
  for each row execute procedure public.after_conversation_message();

-- ── Close the conversation once the buyer orders the product ────────────────
create or replace function public.close_conversation_on_purchase()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c record;
begin
  for c in
    update public.conversations conv set status = 'closed', closed_reason = 'purchase'
    from public.orders o
    where o.id = new.order_id and conv.buyer_id = o.buyer_id and conv.product_id = new.product_id and conv.status <> 'closed'
    returning conv.id
  loop
    insert into public.conversation_messages (conversation_id, kind, content, is_read)
    values (c.id, 'system', 'Order #' || upper(left(new.order_id::text, 8)) || ' placed. Conversation closed. Send a message to reopen it.', true);
  end loop;
  return new;
end;
$$;

drop trigger if exists close_conversation_on_purchase on public.order_items;
create trigger close_conversation_on_purchase after insert on public.order_items
  for each row execute procedure public.close_conversation_on_purchase();

-- ── Realtime ────────────────────────────────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.conversations;
exception when duplicate_object or undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.conversation_messages;
exception when duplicate_object or undefined_object then null; end $$;

-- ── Photos sent in chat (namespaced by sender: "<user_id>/<file>") ───────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "users upload own chat images" on storage.objects;
create policy "users upload own chat images" on storage.objects for insert
  with check (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "chat images are public" on storage.objects;
create policy "chat images are public" on storage.objects for select using (bucket_id = 'chat-images');

notify pgrst, 'reload schema';


-- ============================================================
-- UniMerch — SMS (OTP) verification for phone numbers
-- Run in Supabase SQL Editor AFTER 24_product_chat.sql. Paste and run the WHOLE file. Safe to re-run.
--
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


-- ============================================================
-- UniMerch — Reviews, seller banners, synced carts
-- Run in Supabase SQL Editor AFTER 25_phone_verification.sql. Paste and run the WHOLE file. Safe to re-run.
--
--   • product_reviews  — verified reviews: only buyers with a COMPLETED order containing the product
--                        can rate it (1–5 + comment); product and store averages update automatically
--   • store_banners    — promotional banners stores upload for the homepage carousel, shown only
--                        between starts_at and ends_at; BAO can take any banner down
--   • user_carts       — the signed-in user's cart, synced live across their devices
-- ============================================================

-- ── Reviews ─────────────────────────────────────────────────────────────────
create table if not exists public.product_reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  seller_id   uuid not null references public.seller_profiles(id) on delete cascade,
  buyer_id    uuid not null references public.profiles(id) on delete cascade,
  order_id    uuid not null references public.orders(id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  comment     text check (comment is null or length(comment) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (order_id, product_id)
);
create index if not exists product_reviews_product_idx on public.product_reviews(product_id, created_at desc);
create index if not exists product_reviews_seller_idx on public.product_reviews(seller_id);

alter table public.products add column if not exists rating_avg numeric(3,2) not null default 0;
alter table public.products add column if not exists rating_count integer not null default 0;
alter table public.seller_profiles add column if not exists rating numeric(3,2) default 0;
alter table public.seller_profiles add column if not exists rating_count integer default 0;

-- The buyer must have a completed order from this store that contains the product.
create or replace function public.can_review(p_order uuid, p_product uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.orders o join public.order_items oi on oi.order_id = o.id
    where o.id = p_order and o.buyer_id = auth.uid() and o.status = 'completed' and oi.product_id = p_product
  );
$$;

alter table public.product_reviews enable row level security;

drop policy if exists "reviews are public" on public.product_reviews;
create policy "reviews are public" on public.product_reviews for select using (true);

drop policy if exists "verified buyers review" on public.product_reviews;
create policy "verified buyers review" on public.product_reviews for insert
  with check (buyer_id = auth.uid() and public.can_review(order_id, product_id)
    and seller_id = (select p.seller_id from public.products p where p.id = product_id));

drop policy if exists "buyers edit own reviews" on public.product_reviews;
create policy "buyers edit own reviews" on public.product_reviews for update
  using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());

drop policy if exists "buyers delete own reviews" on public.product_reviews;
create policy "buyers delete own reviews" on public.product_reviews for delete using (buyer_id = auth.uid());

drop policy if exists "bao removes reviews" on public.product_reviews;
create policy "bao removes reviews" on public.product_reviews for delete using (public.module_access('bao'));

-- Buyers can't move a review to another product/order/store when editing
create or replace function public.guard_review_update()
returns trigger language plpgsql as $$
begin
  new.product_id := old.product_id; new.seller_id := old.seller_id;
  new.buyer_id := old.buyer_id; new.order_id := old.order_id;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists guard_review_update on public.product_reviews;
create trigger guard_review_update before update on public.product_reviews
  for each row execute procedure public.guard_review_update();

create or replace function public.refresh_ratings()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p uuid := coalesce(new.product_id, old.product_id);
  s uuid := coalesce(new.seller_id, old.seller_id);
begin
  update public.products set
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.product_reviews where product_id = p), 0),
    rating_count = (select count(*) from public.product_reviews where product_id = p)
  where id = p;
  update public.seller_profiles set
    rating = coalesce((select round(avg(rating)::numeric, 2) from public.product_reviews where seller_id = s), 0),
    rating_count = (select count(*) from public.product_reviews where seller_id = s)
  where id = s;
  return null;
end;
$$;
drop trigger if exists refresh_ratings on public.product_reviews;
create trigger refresh_ratings after insert or update of rating or delete on public.product_reviews
  for each row execute procedure public.refresh_ratings();

-- Tell the store about new reviews
create or replace function public.notify_new_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  dash record;
  pname text;
begin
  select name into pname from public.products where id = new.product_id;
  select * into dash from public.store_dashboard_path(new.seller_id);
  if dash.dashboard_id is not null then
    perform public.notify_dashboard(dash.dashboard_id, 'products', 'product',
      'New ' || new.rating || '★ review', coalesce(pname, 'A product') || coalesce(' — ' || left(new.comment, 100), ''),
      '/marketplace/product/' || new.product_id || '#reviews');
  end if;
  return new;
end;
$$;
drop trigger if exists notify_new_review on public.product_reviews;
create trigger notify_new_review after insert on public.product_reviews
  for each row execute procedure public.notify_new_review();

-- Reviews show the buyer's first name + initial only
create or replace function public.product_review_list(p_product uuid, p_limit int default 20, p_offset int default 0)
returns table (id uuid, rating smallint, comment text, created_at timestamptz, reviewer text, mine boolean)
language sql security definer set search_path = public stable as $$
  select r.id, r.rating, r.comment, r.created_at,
         coalesce(split_part(trim(b.full_name), ' ', 1) || ' ' || left(split_part(trim(b.full_name), ' ', array_length(string_to_array(trim(b.full_name), ' '), 1)), 1) || '.', 'Buyer'),
         r.buyer_id = auth.uid()
  from public.product_reviews r left join public.profiles b on b.id = r.buyer_id
  where r.product_id = p_product
  order by r.created_at desc
  limit least(p_limit, 50) offset p_offset;
$$;

-- Units sold per product (completed orders), for "popular" sorting
alter table public.products add column if not exists sold_count integer not null default 0;
create or replace function public.refresh_sold_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and 'completed' in (new.status, old.status) then
    update public.products p set sold_count = (
      select coalesce(sum(oi.quantity), 0) from public.order_items oi join public.orders o on o.id = oi.order_id
      where oi.product_id = p.id and o.status = 'completed')
    where p.id in (select product_id from public.order_items where order_id = new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists refresh_sold_count on public.orders;
create trigger refresh_sold_count after update of status on public.orders
  for each row execute procedure public.refresh_sold_count();

update public.products p set sold_count = s.qty
from (select oi.product_id, sum(oi.quantity)::int qty from public.order_items oi join public.orders o on o.id = oi.order_id
      where o.status = 'completed' group by oi.product_id) s
where s.product_id = p.id and p.sold_count <> s.qty;

-- ── Seller banners ──────────────────────────────────────────────────────────
create table if not exists public.store_banners (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references public.seller_profiles(id) on delete cascade,
  title       text not null check (length(trim(title)) between 1 and 80),
  subtitle    text check (subtitle is null or length(subtitle) <= 160),
  image_url   text,
  link_url    text check (link_url is null or link_url ~ '^/'),   -- in-app links only
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at <= starts_at + interval '90 days')
);
create index if not exists store_banners_active_idx on public.store_banners(starts_at, ends_at);

alter table public.store_banners enable row level security;

drop policy if exists "running banners are public" on public.store_banners;
create policy "running banners are public" on public.store_banners for select
  using (now() between starts_at and ends_at
         and exists (select 1 from public.seller_profiles s where s.id = seller_id and coalesce(s.status, 'active') = 'active'));

drop policy if exists "stores manage own banners" on public.store_banners;
create policy "stores manage own banners" on public.store_banners for all
  using (public.store_access(seller_id, 'storefront')) with check (public.store_access(seller_id, 'storefront'));

drop policy if exists "bao reviews banners" on public.store_banners;
create policy "bao reviews banners" on public.store_banners for select using (public.module_access('bao'));
drop policy if exists "bao removes banners" on public.store_banners;
create policy "bao removes banners" on public.store_banners for delete using (public.module_access('bao'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-banners', 'store-banners', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Files live under "<store id>/…" and only that store's staff may upload or remove them
drop policy if exists "stores upload banners" on storage.objects;
create policy "stores upload banners" on storage.objects for insert
  with check (bucket_id = 'store-banners' and public.store_access(((storage.foldername(name))[1])::uuid, 'storefront'));
drop policy if exists "stores delete banners" on storage.objects;
create policy "stores delete banners" on storage.objects for delete
  using (bucket_id = 'store-banners' and public.store_access(((storage.foldername(name))[1])::uuid, 'storefront'));
drop policy if exists "banner images are public" on storage.objects;
create policy "banner images are public" on storage.objects for select using (bucket_id = 'store-banners');

-- ── Cart synced across devices ──────────────────────────────────────────────
create table if not exists public.user_carts (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  items       jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 100),
  device      text,            -- which browser saved it last (so it ignores its own echo)
  updated_at  timestamptz not null default now()
);
alter table public.user_carts enable row level security;
drop policy if exists "users own their cart" on public.user_carts;
create policy "users own their cart" on public.user_carts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Realtime ────────────────────────────────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.user_carts;
exception when duplicate_object or undefined_object then null; end $$;
do $$ begin
  if to_regclass('public.notifications') is not null then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception when duplicate_object or undefined_object then null; end $$;

notify pgrst, 'reload schema';


-- ############################################################
-- ## 27_variant_prices_payment_modes.sql
-- ############################################################

-- ============================================================
-- UniMerch — Per-size prices and payment modes per product
-- Run in Supabase SQL Editor AFTER 26_reviews_banners_cart.sql. Paste and run the WHOLE file. Safe to re-run.
--
--   • products.variant_prices — optional price per size/variant, e.g. {"S": 250, "XL": 300}.
--                               Sizes without a price use products.price (which is the lowest price).
--   • products.payment_modes  — how buyers may pay for this product: walk_in (cash at the counter),
--                               online (GCash / bank transfer) or both. Checkout only offers these.
--                               Existing products keep both; Cashier and Supply Office products
--                               default to walk-in in the Add Product form.
-- ============================================================

alter table public.products add column if not exists variant_prices jsonb  not null default '{}'::jsonb;
alter table public.products add column if not exists payment_modes  text[] not null default array['walk_in','online'];

alter table public.products drop constraint if exists products_payment_modes_check;
alter table public.products add constraint products_payment_modes_check
  check (cardinality(payment_modes) > 0 and payment_modes <@ array['walk_in','online']) not valid;

alter table public.products drop constraint if exists products_variant_prices_check;
alter table public.products add constraint products_variant_prices_check
  check (jsonb_typeof(variant_prices) = 'object') not valid;

notify pgrst, 'reload schema';

-- Check
select count(*) filter (where variant_prices <> '{}'::jsonb) as products_with_size_prices,
       count(*) filter (where payment_modes = array['walk_in'])  as walk_in_only,
       count(*) filter (where payment_modes = array['online'])   as online_only,
       count(*)                                                   as all_products
from public.products;


-- ############################################################
-- ## 28_product_variants.sql
-- ############################################################

-- ============================================================
-- UniMerch — Product variants (sizes): each size is its own purchasable option
-- Run in Supabase SQL Editor AFTER 27_variant_prices_payment_modes.sql. Paste and run the WHOLE file. Safe to re-run.
--
--   • product_variants — one row per size (and optional colour) of a product, each with its own
--                        price, stock, SKU and optional image. Buyers pick one; the cart, checkout,
--                        orders and stock all work on that exact variant.
--   • products.price / price_max / stock / variations are kept in sync automatically:
--       price = lowest variant price, price_max = highest, stock = total of all variants,
--       variations = the variant names (so lists, cards and search keep working)
--   • order_items.variant_id — the exact variant bought; a sale takes stock from that variant and
--     a cancelled order puts it back
--   • Existing products with sizes are converted: each size becomes a variant with its size price
--     (from scripts/27) or the product price, and the product's stock is split across its sizes —
--     sellers should check those numbers once.
-- ============================================================

create table if not exists public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  name        text not null,                 -- what the buyer picks, e.g. "M" or "M / Maroon"
  size        text,
  color       text,
  price       numeric(10,2) not null check (price >= 0),
  stock       integer not null default 0 check (stock >= 0),
  sku         text,
  image_url   text,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (product_id, name)
);
create index if not exists product_variants_product_idx on public.product_variants(product_id, position);

alter table public.products            add column if not exists price_max  numeric(10,2);
alter table public.order_items         add column if not exists variant_id uuid references public.product_variants(id) on delete set null;
alter table public.inventory_movements add column if not exists variant_id uuid references public.product_variants(id) on delete set null;

-- ── Who can see / change variants ──────────────────────────────────────────
alter table public.product_variants enable row level security;

-- Visible exactly when the product itself is visible to this viewer (products RLS applies)
drop policy if exists "variants follow their product" on public.product_variants;
create policy "variants follow their product" on public.product_variants for select
  using (exists (select 1 from public.products p where p.id = product_id));

-- The store's members with Products (prices, sizes) or Inventory (stock) permission
drop policy if exists "store manages variants" on public.product_variants;
create policy "store manages variants" on public.product_variants for all
  using (exists (select 1 from public.products p where p.id = product_id
                 and (public.store_access(p.seller_id, 'products') or public.store_access(p.seller_id, 'inventory'))))
  with check (exists (select 1 from public.products p where p.id = product_id
                 and (public.store_access(p.seller_id, 'products') or public.store_access(p.seller_id, 'inventory'))));

-- ── Keep the product's price range, total stock and size list in sync ─────
create or replace function public.sync_product_from_variants()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p set
    price      = v.min_price,
    price_max  = v.max_price,
    stock      = v.total_stock,
    variations = v.names,
    updated_at = now()
  from (
    select min(price) as min_price, max(price) as max_price, sum(stock)::int as total_stock,
           jsonb_agg(name order by position, created_at) as names
    from public.product_variants where product_id = pid
  ) v
  where p.id = pid and v.min_price is not null;   -- last variant removed: leave the product as it is
  return null;
end;
$$;

drop trigger if exists sync_product_from_variants on public.product_variants;
create trigger sync_product_from_variants after insert or update or delete on public.product_variants
  for each row execute procedure public.sync_product_from_variants();

-- ── Sales take stock from the exact variant; cancellations put it back ────
create or replace function public.stock_out_on_sale()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.variant_id is not null then
    -- the variant sync trigger then updates the product's total stock
    update public.product_variants set stock = greatest(stock - new.quantity, 0), updated_at = now() where id = new.variant_id;
  elsif new.product_id is not null then
    update public.products set stock = greatest(stock - new.quantity, 0), updated_at = now() where id = new.product_id;
  end if;
  if new.product_id is not null and exists (select 1 from public.seller_profiles where id = new.seller_id) then
    insert into public.inventory_movements (store_id, product_id, variant_id, product_name, change, reason, order_id, created_by)
    values (new.seller_id, new.product_id, new.variant_id,
            new.product_name || coalesce(' (' || new.variant || ')', ''), -new.quantity, 'sale', new.order_id, auth.uid());
  end if;
  return new;
end;
$$;

create or replace function public.stock_back_on_cancel()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  item record;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    for item in select * from public.order_items where order_id = new.id and product_id is not null loop
      if item.variant_id is not null then
        update public.product_variants set stock = stock + item.quantity, updated_at = now() where id = item.variant_id;
      else
        update public.products set stock = stock + item.quantity, updated_at = now() where id = item.product_id;
      end if;
      if exists (select 1 from public.seller_profiles where id = item.seller_id) then
        insert into public.inventory_movements (store_id, product_id, variant_id, product_name, change, reason, order_id, created_by)
        values (item.seller_id, item.product_id, item.variant_id,
                item.product_name || coalesce(' (' || item.variant || ')', ''), item.quantity, 'cancellation', new.id, auth.uid());
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists stock_out_on_sale on public.order_items;
create trigger stock_out_on_sale after insert on public.order_items for each row execute procedure public.stock_out_on_sale();
drop trigger if exists stock_back_on_cancel on public.orders;
create trigger stock_back_on_cancel after update on public.orders for each row execute procedure public.stock_back_on_cancel();

-- ── Convert existing products that have sizes ─────────────────────────────
do $$
declare
  has_prices boolean := exists (select 1 from information_schema.columns
                                where table_schema = 'public' and table_name = 'products' and column_name = 'variant_prices');
  p record;
  n int;
  i int;
  size_name text;
  size_price numeric;
begin
  for p in
    select * from public.products pr
    where (case when jsonb_typeof(pr.variations) = 'array' then jsonb_array_length(pr.variations) else 0 end) > 0
      and not exists (select 1 from public.product_variants v where v.product_id = pr.id)
  loop
    n := jsonb_array_length(p.variations);
    for i in 0 .. n - 1 loop
      size_name := p.variations ->> i;
      continue when size_name is null or btrim(size_name) = '';
      size_price := null;
      if has_prices then
        execute 'select (variant_prices ->> $1)::numeric from public.products where id = $2' into size_price using size_name, p.id;
      end if;
      insert into public.product_variants (product_id, name, size, price, stock, position)
      values (p.id, size_name, size_name, coalesce(size_price, p.price),
              -- split the product's stock across its sizes; the first size takes the remainder
              (p.stock / n) + case when i = 0 then p.stock % n else 0 end, i)
      on conflict (product_id, name) do nothing;
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Check: products with variants, and their price range / total stock
select p.name, p.price as lowest, p.price_max as highest, p.stock as total_stock, count(v.*) as variants
from public.products p join public.product_variants v on v.product_id = p.id
group by p.id order by p.name;


-- ############################################################
-- ## 29_preorder_id_penalties.sql
-- ############################################################

-- ============================================================
-- UniMerch — Pre-orders: I.D. check, buyer pick-up date, unclaimed-order penalties
-- Run in Supabase SQL Editor AFTER 28_product_variants.sql. Paste and run the WHOLE file. Safe to re-run.
--
-- Pre-order flow (details in "Pre-order flow: pay first, queue…" below):
--   I.D. + pay full / half online or walk-in → I.D. checked → Partially Paid / Payment Received →
--   Ready for Pick Up → buyer picks the pick-up day → Completed (or Returned / Refunded, Cancelled).
--   An unpaid pre-order not picked up by its day is discarded (cancelled) and the shop's penalty
--   (default ₱10) is charged. While a penalty with a shop is unpaid, the buyer can't order from that
--   shop. It's paid at the shop's counter or online (receipt), and the shop clears it.
--
--   • seller_profiles.claim_window_days  — now 3–7 days: how far ahead a buyer may set the pick-up date
--   • seller_profiles.preorder_penalty   — the shop's penalty for unclaimed pre-orders (₱10 default)
--   • orders.pickup_date / buyer_id_path / id_status — buyer's chosen date, I.D. photo, shop's check
--   • buyer_penalties                    — penalty charges (unpaid → pending_review → paid / waived)
--   • storage bucket preorder-ids        — private: the buyer and that shop's staff only
--   • orders.is_preorder / payment_plan   — pre-order flag; 'full' or 'half' online payment
--   • set_preorder_pickup()              — the buyer picks the pick-up day once it's ready
--   • preorder_forms                     — the shop's pre-order completion forms
--   • expire_overdue_preorders()         — discards overdue pre-orders and charges the penalty
--     (the app calls it whenever orders are opened; also scheduled hourly when pg_cron is enabled)
-- ============================================================

-- ── Shop settings ─────────────────────────────────────────────────────────
alter table public.seller_profiles add column if not exists claim_window_days integer not null default 7;
update public.seller_profiles set claim_window_days = least(greatest(claim_window_days, 3), 7)
where claim_window_days not between 3 and 7;
alter table public.seller_profiles drop constraint if exists seller_claim_window_days_check;
alter table public.seller_profiles add constraint seller_claim_window_days_check check (claim_window_days between 3 and 7);

alter table public.seller_profiles add column if not exists preorder_penalty numeric(10,2) not null default 10;
alter table public.seller_profiles drop constraint if exists seller_preorder_penalty_check;
alter table public.seller_profiles add constraint seller_preorder_penalty_check check (preorder_penalty between 0 and 10000);

-- ── Pre-order details on the order ────────────────────────────────────────
alter table public.orders add column if not exists pickup_deadline timestamptz;
alter table public.orders add column if not exists pickup_date     date;
alter table public.orders add column if not exists buyer_id_path   text;
alter table public.orders add column if not exists id_status       text;
alter table public.orders drop constraint if exists orders_id_status_check;
alter table public.orders add constraint orders_id_status_check
  check (id_status is null or id_status in ('pending', 'approved', 'rejected')) not valid;

-- ── Penalty charges ───────────────────────────────────────────────────────
create table if not exists public.buyer_penalties (
  id              uuid primary key default gen_random_uuid(),
  buyer_id        uuid not null references auth.users(id) on delete cascade,
  store_id        uuid not null references public.seller_profiles(id) on delete cascade,
  order_id        uuid unique references public.orders(id) on delete set null,
  amount          numeric(10,2) not null check (amount >= 0),
  reason          text not null default 'Pre-order not picked up by the pick-up date',
  status          text not null default 'unpaid' check (status in ('unpaid', 'pending_review', 'paid', 'waived')),
  payment_method  text check (payment_method is null or payment_method in ('cash', 'gcash', 'bank')),
  receipt_url     text,
  reference_number text,
  created_at      timestamptz not null default now(),
  paid_at         timestamptz,
  cleared_by      uuid references auth.users(id) on delete set null
);
create index if not exists buyer_penalties_buyer_idx on public.buyer_penalties(buyer_id, status);
create index if not exists buyer_penalties_store_idx on public.buyer_penalties(store_id, status);

alter table public.buyer_penalties enable row level security;

drop policy if exists "buyers see their penalties" on public.buyer_penalties;
create policy "buyers see their penalties" on public.buyer_penalties for select using (buyer_id = auth.uid());

drop policy if exists "shops see their penalties" on public.buyer_penalties;
create policy "shops see their penalties" on public.buyer_penalties for select using (public.store_access(store_id, 'orders'));

-- The shop clears (paid / waived) or sends back a receipt for review
drop policy if exists "shops clear their penalties" on public.buyer_penalties;
create policy "shops clear their penalties" on public.buyer_penalties for update
  using (public.store_access(store_id, 'orders')) with check (public.store_access(store_id, 'orders'));

-- Buyer pays online: attaches a receipt to an unpaid penalty (status → pending_review only)
create or replace function public.submit_penalty_payment(p_penalty uuid, p_method text, p_receipt_url text, p_reference text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_method not in ('gcash', 'bank') then raise exception 'Choose GCash or bank transfer.'; end if;
  if coalesce(p_receipt_url, '') = '' then raise exception 'Upload your payment receipt.'; end if;
  update public.buyer_penalties
  set status = 'pending_review', payment_method = p_method, receipt_url = p_receipt_url, reference_number = nullif(trim(p_reference), '')
  where id = p_penalty and buyer_id = auth.uid() and status = 'unpaid';
  if not found then raise exception 'This penalty is not waiting for payment.'; end if;
end;
$$;
grant execute on function public.submit_penalty_payment(uuid, text, text, text) to authenticated;

-- Can this buyer order from this shop? (false while a penalty with the shop isn't cleared)
create or replace function public.has_unpaid_penalty(p_buyer uuid, p_store uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.buyer_penalties
                 where buyer_id = p_buyer and store_id = p_store and status in ('unpaid', 'pending_review'));
$$;
grant execute on function public.has_unpaid_penalty(uuid, uuid) to authenticated;

-- Overdue pre-orders are discarded by expire_overdue_preorders() (below).

-- Hourly, when the pg_cron extension is enabled (Database → Extensions → pg_cron)
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'expire-overdue-preorders';
    perform cron.schedule('expire-overdue-preorders', '0 * * * *', 'select public.expire_overdue_preorders()');
  end if;
end $$;

-- ── Private storage for pre-order I.D. photos ─────────────────────────────
-- Path: {store_id}/{buyer_id}/{file}. The buyer uploads; that shop's staff (Orders) and the buyer can view.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('preorder-ids', 'preorder-ids', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false;

drop policy if exists "buyers upload pre-order ids" on storage.objects;
create policy "buyers upload pre-order ids" on storage.objects for insert
  with check (bucket_id = 'preorder-ids' and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists "pre-order ids readable by buyer and shop" on storage.objects;
create policy "pre-order ids readable by buyer and shop" on storage.objects for select
  using (bucket_id = 'preorder-ids' and (
    (storage.foldername(name))[2] = auth.uid()::text
    or public.store_access(((storage.foldername(name))[1])::uuid, 'orders')
  ));

-- ── Pre-order flow: pay first, queue, the buyer picks the pick-up day ─────────
--   1. Checkout: the buyer uploads an I.D. and pays the full amount or half online (GCash / bank,
--      with a receipt), or chooses walk-in and pays at the counter.            → pending
--   2. The shop checks the I.D. (the order stays Pending), then records the payment:
--      Partially Paid or Payment Received. Paid pre-orders are served first, in order of when they
--      were placed; unpaid walk-in pre-orders after them.
--   3. Stock arrives → "Ready for Pick Up": the buyer is notified and picks today or a day within
--      the shop's claim window (3–7 days). Not choosing = the last day of the window.
--   4. Fully paid → Completed. Otherwise Returned / Refunded or Cancelled.
--   5. Missed pick-up day: an unpaid (walk-in) pre-order is cancelled and the penalty charged, so
--      the stock can be sold again; a paid one is flagged for the shop to refund or re-schedule.
--   6. Stock is taken at pick-up, not at checkout. Marking "ready" doesn't reserve it: the first to
--      pick up gets it. When a size runs out, pre-orders still "ready" for it go back to the waitlist
--      (Paid / Partially Paid, same place in the queue) and the buyer is told.
alter table public.orders add column if not exists is_preorder boolean not null default false;
alter table public.orders add column if not exists payment_plan text;
alter table public.orders drop constraint if exists orders_payment_plan_check;
alter table public.orders add constraint orders_payment_plan_check
  check (payment_plan is null or payment_plan in ('full', 'half')) not valid;
update public.orders set is_preorder = true where not is_preorder and (pickup_date is not null or buyer_id_path is not null);
create index if not exists orders_preorder_idx on public.orders(seller_id, created_at) where is_preorder;
-- Has this order's stock been taken? Earlier orders: yes (at checkout). New pre-orders: at pick-up.
alter table public.orders add column if not exists stock_taken boolean not null default true;

create or replace function public.preorder_insert_rules()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_preorder then new.stock_taken := false; end if;
  return new;
end;
$$;
drop trigger if exists preorder_insert_rules on public.orders;
create trigger preorder_insert_rules before insert on public.orders for each row execute procedure public.preorder_insert_rules();

-- Sales take stock from the exact size (replaces 28_product_variants.sql) — except pre-orders,
-- which take it when they're picked up
create or replace function public.stock_out_on_sale()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.orders where id = new.order_id and not stock_taken) then
    return new;
  end if;
  if new.variant_id is not null then
    -- the variant sync trigger then updates the product's total stock
    update public.product_variants set stock = greatest(stock - new.quantity, 0), updated_at = now() where id = new.variant_id;
  elsif new.product_id is not null then
    update public.products set stock = greatest(stock - new.quantity, 0), updated_at = now() where id = new.product_id;
  end if;
  if new.product_id is not null and exists (select 1 from public.seller_profiles where id = new.seller_id) then
    insert into public.inventory_movements (store_id, product_id, variant_id, product_name, change, reason, order_id, created_by)
    values (new.seller_id, new.product_id, new.variant_id,
            new.product_name || coalesce(' (' || new.variant || ')', ''), -new.quantity, 'sale', new.order_id, auth.uid());
  end if;
  return new;
end;
$$;

-- A pre-order is picked up: take its stock now (refused when a size is short)
create or replace function public.take_preorder_stock(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  item record;
  have integer;
begin
  -- The order being completed is skipped by the "back to the waitlist" trigger below
  perform set_config('app.completing_order', p_order::text, true);
  for item in select * from public.order_items where order_id = p_order and product_id is not null loop
    have := coalesce((select stock from public.product_variants where id = item.variant_id),
                     (select stock from public.products where id = item.product_id), 0);
    if have < item.quantity then
      raise exception 'Only % of % in stock — restock it before completing this pre-order.',
        have, item.product_name || coalesce(' (' || item.variant || ')', '');
    end if;
    if item.variant_id is not null then
      update public.product_variants set stock = stock - item.quantity, updated_at = now() where id = item.variant_id;
    else
      update public.products set stock = stock - item.quantity, updated_at = now() where id = item.product_id;
    end if;
    if exists (select 1 from public.seller_profiles where id = item.seller_id) then
      insert into public.inventory_movements (store_id, product_id, variant_id, product_name, change, reason, note, order_id, created_by)
      values (item.seller_id, item.product_id, item.variant_id, item.product_name || coalesce(' (' || item.variant || ')', ''),
              -item.quantity, 'sale', 'Pre-order picked up', p_order, auth.uid());
    end if;
  end loop;
  perform set_config('app.completing_order', '', true);
end;
$$;
revoke all on function public.take_preorder_stock(uuid) from public, anon, authenticated;

-- Returned / refunded orders
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending','paid','partially_paid','ready_for_pickup','completed','cancelled','refunded')) not valid;
drop policy if exists "sellers update their orders" on public.orders;
create policy "sellers update their orders" on public.orders for update
  using (public.auth_seller_has_order(id))
  with check (status in ('pending','paid','partially_paid','ready_for_pickup','completed','cancelled','refunded'));

-- "Payment received" means the whole amount; earlier paid pre-orders get their amount filled in
update public.orders o set amount_paid = o.total
where o.is_preorder and o.amount_paid is null
  and (o.status = 'paid' or exists (select 1 from public.order_status_history h where h.order_id = o.id and h.status = 'paid'));

create or replace function public.preorder_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  window_days integer;
  today date := (now() at time zone 'Asia/Manila')::date;
begin
  if new.status = 'paid' and old.status is distinct from 'paid' and coalesce(new.amount_paid, 0) < new.total then
    new.amount_paid := new.total;
  end if;
  -- Picked up: the pre-order's stock is taken now
  if new.status = 'completed' and old.status is distinct from 'completed' and new.is_preorder and not new.stock_taken then
    perform public.take_preorder_stock(new.id);
    new.stock_taken := true;
  end if;
  -- Ready for pick up without a chosen day (or the shop cleared it for a new one): the buyer has
  -- until the end of the shop's claim window to choose and pick up
  if new.is_preorder and new.status = 'ready_for_pickup' and new.pickup_date is null
     and (old.status is distinct from 'ready_for_pickup' or old.pickup_date is not null or new.pickup_deadline is null) then
    select claim_window_days into window_days from public.seller_profiles where id = new.seller_id;
    new.pickup_deadline := ((today + coalesce(window_days, 7))::timestamp + time '23:59:59') at time zone 'Asia/Manila';
  end if;
  return new;
end;
$$;
drop trigger if exists preorder_rules on public.orders;
create trigger preorder_rules before update on public.orders for each row execute procedure public.preorder_rules();

-- The buyer picks the pick-up day once the pre-order is ready (today up to the deadline)
create or replace function public.set_preorder_pickup(p_order uuid, p_date date)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  today date := (now() at time zone 'Asia/Manila')::date;
  last_day date;
  dash record;
begin
  select * into o from public.orders where id = p_order and buyer_id = auth.uid() for update;
  if not found then raise exception 'Order not found.'; end if;
  if not o.is_preorder or o.status <> 'ready_for_pickup' then
    raise exception 'You can choose a pick-up day once your pre-order is ready for pick up.';
  end if;
  if o.pickup_deadline is not null and o.pickup_deadline < now() then
    raise exception 'The pick-up period has ended. Message the shop.';
  end if;
  last_day := coalesce((o.pickup_deadline at time zone 'Asia/Manila')::date, today + 7);
  if p_date is null or p_date < today or p_date > last_day then
    raise exception 'Choose a day from today up to %.', to_char(last_day, 'Mon DD');
  end if;
  update public.orders
  set pickup_date = p_date, pickup_deadline = (p_date::timestamp + time '23:59:59') at time zone 'Asia/Manila'
  where id = p_order;
  select * into dash from public.store_dashboard_path(o.seller_id);
  if dash.dashboard_id is not null then
    perform public.notify_dashboard(dash.dashboard_id, 'orders', 'order',
      'Pick-up day set · #' || upper(left(o.id::text, 8)),
      'The buyer will pick up their pre-order on ' || to_char(p_date, 'Dy, Mon DD') || '.', dash.base || '/orders');
  end if;
end;
$$;
grant execute on function public.set_preorder_pickup(uuid, date) to authenticated;

-- Missed pick-up day: only unpaid pre-orders are discarded (with the penalty when it was ready)
create or replace function public.expire_overdue_preorders()
returns integer language plpgsql security definer set search_path = public as $$
declare
  o record;
  n integer := 0;
  fee numeric;
  shop text;
begin
  for o in
    select ord.id, ord.buyer_id, ord.seller_id, ord.status from public.orders ord
    where (ord.is_preorder or ord.pickup_date is not null) and ord.pickup_deadline is not null and ord.pickup_deadline < now()
      and ord.status in ('pending', 'ready_for_pickup')
      and coalesce(ord.amount_paid, 0) <= 0
      and not exists (select 1 from public.order_status_history h where h.order_id = ord.id and h.status in ('paid', 'partially_paid'))
    for update of ord skip locked
  loop
    update public.orders set status = 'cancelled' where id = o.id;
    if o.status = 'ready_for_pickup' then
      select preorder_penalty, org_name into fee, shop from public.seller_profiles where id = o.seller_id;
      if coalesce(fee, 0) > 0 then
        insert into public.buyer_penalties (buyer_id, store_id, order_id, amount)
        values (o.buyer_id, o.seller_id, o.id, fee)
        on conflict (order_id) do nothing;
        perform public.notify_user(o.buyer_id, 'order', 'Pre-order not picked up',
          format('Your pre-order from %s wasn''t picked up by your pick-up day, so it was cancelled and a ₱%s penalty was added. Pay it to order from this shop again.', coalesce(shop, 'the shop'), fee),
          '/marketplace/account#penalties');
      end if;
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;
grant execute on function public.expire_overdue_preorders() to authenticated;

-- Returned items go back to stock, like cancelled ones
create or replace function public.stock_back_on_cancel()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  item record;
begin
  -- Only stock that was taken goes back (a pre-order's stock is taken at pick-up)
  if new.status in ('cancelled', 'refunded') and old.status not in ('cancelled', 'refunded') and old.stock_taken then
    for item in select * from public.order_items where order_id = new.id and product_id is not null loop
      if item.variant_id is not null then
        update public.product_variants set stock = stock + item.quantity, updated_at = now() where id = item.variant_id;
      else
        update public.products set stock = stock + item.quantity, updated_at = now() where id = item.product_id;
      end if;
      if exists (select 1 from public.seller_profiles where id = item.seller_id) then
        insert into public.inventory_movements (store_id, product_id, variant_id, product_name, change, reason, order_id, created_by)
        values (item.seller_id, item.product_id, item.variant_id,
                item.product_name || coalesce(' (' || item.variant || ')', ''), item.quantity, 'cancellation', new.id, auth.uid());
      end if;
    end loop;
  end if;
  return new;
end;
$$;

-- Buyer notifications (replaces the version in 17_notifications.sql): pre-order wording + refunds
create or replace function public.notify_order_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  dash record;
  code text := upper(left(new.id::text, 8));
  label text;
begin
  if tg_op = 'INSERT' then
    if new.seller_id is not null then
      select * into dash from public.store_dashboard_path(new.seller_id);
      if dash.dashboard_id is not null then
        perform public.notify_dashboard(dash.dashboard_id, 'orders', 'order',
          case when new.is_preorder then 'New pre-order #' else 'New order #' end || code,
          'A buyer placed an order worth ₱' || to_char(new.total, 'FM999,999,990.00') || '.', dash.base || '/orders');
      end if;
    end if;
  elsif new.status is distinct from old.status then
    label := case new.status
      when 'paid' then case
        when new.is_preorder and old.status = 'ready_for_pickup' then 'Back on the pre-order waitlist — your size ran out. You keep your place.'
        when new.is_preorder then 'Payment received for your pre-order'
        else 'Payment confirmed — your items are being prepared' end
      when 'partially_paid' then case
        when new.is_preorder and old.status = 'ready_for_pickup' then 'Back on the pre-order waitlist — your size ran out. You keep your place.'
        else 'Partial payment received' end
      when 'ready_for_pickup' then case when new.is_preorder then 'Pre-order ready — choose your pick-up day' else 'Ready for pickup' end
      when 'completed' then 'Order completed'
      when 'cancelled' then 'Order cancelled'
      when 'refunded' then 'Order returned / refunded'
      else 'Order updated' end;
    perform public.notify_user(new.buyer_id, 'order', label, 'Order #' || code, '/marketplace/orders/' || new.id);
  end if;
  return new;
end;
$$;

-- A size (or a product without sizes) ran out: pre-orders still "ready" for it go back to the waitlist
create or replace function public.preorder_back_to_waitlist()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  o record;
begin
  if new.stock > 0 or old.stock <= 0 then return new; end if;
  for o in
    select distinct ord.id, ord.total, ord.amount_paid from public.orders ord
    join public.order_items oi on oi.order_id = ord.id
    where ord.is_preorder and not ord.stock_taken and ord.status = 'ready_for_pickup'
      and ord.id::text is distinct from nullif(current_setting('app.completing_order', true), '')
      and case when tg_table_name = 'product_variants' then oi.variant_id = new.id
               else oi.product_id = new.id and oi.variant_id is null end
  loop
    update public.orders
    set status = case when coalesce(o.amount_paid, 0) >= o.total then 'paid' else 'partially_paid' end,
        pickup_date = null, pickup_deadline = null
    where id = o.id;
  end loop;
  return new;
end;
$$;
drop trigger if exists preorder_back_to_waitlist on public.product_variants;
create trigger preorder_back_to_waitlist after update of stock on public.product_variants
  for each row execute procedure public.preorder_back_to_waitlist();
drop trigger if exists preorder_back_to_waitlist on public.products;
create trigger preorder_back_to_waitlist after update of stock on public.products
  for each row execute procedure public.preorder_back_to_waitlist();

-- ── Pre-order forms (made by the shop) ─────────────────────────────────────
-- A form has a title and Size / Qty cells; each cell lists the products it covers, e.g.
-- "School Uniform": [Polo, Blouse] [Pants, Skirt]. columns = [{"products":[{"id":…,"name":…}]}]
create table if not exists public.preorder_forms (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.seller_profiles(id) on delete cascade,
  title       text not null check (char_length(trim(title)) between 1 and 120),
  columns     jsonb not null default '[]'::jsonb,
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists preorder_forms_store_idx on public.preorder_forms(store_id, created_at desc);
alter table public.preorder_forms enable row level security;
drop policy if exists "shops manage their pre-order forms" on public.preorder_forms;
create policy "shops manage their pre-order forms" on public.preorder_forms for all
  using (public.store_access(store_id, 'orders')) with check (public.store_access(store_id, 'orders'));

notify pgrst, 'reload schema';

-- Check
select (select count(*) from public.buyer_penalties) as penalties,
       (select count(*) from public.orders where is_preorder) as preorders,
       (select count(*) from public.preorder_forms) as preorder_forms,
       exists (select 1 from storage.buckets where id = 'preorder-ids') as id_bucket;


-- ############################################################
-- ## 30_guest_restriction.sql
-- ############################################################

-- ============================================================
-- UniMerch — "Guest" option for restricted products (replaces "Alumni")
-- Run in Supabase SQL Editor AFTER 29_preorder_id_penalties.sql. Paste and run the WHOLE file. Safe to re-run.
--
-- A restricted product lists who may see and buy it (products.allowed_roles):
--   • student / faculty / staff — a VERIFIED university member with that affiliation
--   • guest                     — any signed-in user who is NOT a verified university member
--                                 (external accounts, and members whose verification isn't approved)
-- "alumni" is no longer offered; products restricted to alumni now allow guests instead.
-- ============================================================

create or replace function public.viewer_role_allowed(allowed text[])
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (
      (coalesce(is_identity_verified, false) and affiliation = any(allowed))
      or ('guest' = any(allowed) and (not coalesce(is_identity_verified, false) or affiliation = 'external'))
    )
  );
$$;

-- Existing products restricted to alumni → guests
update public.products
set allowed_roles = array(select distinct case when r = 'alumni' then 'guest' else r end from unnest(allowed_roles) as r)
where 'alumni' = any(allowed_roles);

notify pgrst, 'reload schema';

-- Check: restricted products and who they allow
select name, allowed_roles from public.products where is_restricted order by name;



-- ############################################################
-- ## 31_supply_office_branches.sql
-- ############################################################

-- ============================================================
-- UniMerch — Cashier branches are renamed "Supply Office" branches
-- Run in Supabase SQL Editor AFTER 30_guest_restriction.sql. Paste and run the WHOLE file. Safe to re-run.
--
-- Display names only: "Cashier — Bulan Campus" → "Supply Office — Bulan Campus", and the branch
-- stores "University Cashier — …" → "University Supply Office — …". Features are unchanged, and
-- the internal module key stays 'cashier'.
-- ============================================================

-- Branch dashboards
update public.dashboards
set name = replace(name, 'Cashier', 'Supply Office')
where module = 'cashier' and name like '%Cashier%';

-- Branch stores (storefront name, category, description)
update public.seller_profiles sp
set org_name    = replace(replace(sp.org_name, 'University Cashier', 'University Supply Office'), 'Cashier', 'Supply Office'),
    category    = case when sp.category = 'University Cashier' then 'University Supply Office' else sp.category end,
    description = case when sp.description = 'Official university cashier store' then 'Official university supply office store' else sp.description end
from public.dashboards d
where d.module = 'cashier' and d.store_id = sp.id
  and (sp.org_name like '%Cashier%' or sp.category = 'University Cashier' or sp.description = 'Official university cashier store');

-- New branches get a "University Supply Office" store
create or replace function public.ensure_dashboard_store()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.module in ('seller','cashier') and new.store_id is null then
    insert into public.seller_profiles (org_name, status, created_by, campus, category)
    values (new.name, 'active', auth.uid(), new.campus, case when new.module = 'cashier' then 'University Supply Office' end)
    returning id into new.store_id;
  end if;
  return new;
end;
$$;

-- ── Branches are supplied by the Main Supply Office ───────────────────────
-- Branches sell. The Main Supply Office adds their stock (restock requests, or directly) and takes
-- back damaged / defective items (return reports). Royalty on branch sales is owed by the Main
-- office (scripts/32). Branches can't add stock themselves (app/store-actions.ts).
create table if not exists public.branch_stock_requests (
  id                 uuid primary key default gen_random_uuid(),
  branch_store_id    uuid not null references public.seller_profiles(id) on delete cascade,
  kind               text not null check (kind in ('restock', 'return')),
  product_id         uuid references public.products(id) on delete set null,
  variant_id         uuid references public.product_variants(id) on delete set null,
  product_name       text not null default '',
  quantity           integer not null check (quantity > 0),
  reason             text check (reason is null or reason in ('damaged', 'defective', 'other')),
  note               text,
  photo_url          text,
  status             text not null default 'pending' check (status in ('pending', 'fulfilled', 'partial', 'approved', 'declined')),
  fulfilled_quantity integer,
  main_note          text,
  created_by         uuid default auth.uid() references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  reviewed_by        uuid references auth.users(id) on delete set null,
  reviewed_at        timestamptz
);
-- The product's photo, so both sides recognise the item at a glance
alter table public.branch_stock_requests add column if not exists product_image_url text;
create index if not exists branch_stock_requests_store_idx on public.branch_stock_requests(branch_store_id, created_at desc);
create index if not exists branch_stock_requests_pending_idx on public.branch_stock_requests(created_at) where status = 'pending';

alter table public.branch_stock_requests enable row level security;
drop policy if exists "branch and main office read stock requests" on public.branch_stock_requests;
create policy "branch and main office read stock requests" on public.branch_stock_requests for select
  using (public.store_access(branch_store_id, 'inventory') or public.module_access('supply_office', 'inventory'));
drop policy if exists "branches send stock requests" on public.branch_stock_requests;
create policy "branches send stock requests" on public.branch_stock_requests for insert
  with check (public.store_access(branch_store_id, 'inventory') and status = 'pending');
drop policy if exists "branches withdraw pending requests" on public.branch_stock_requests;
create policy "branches withdraw pending requests" on public.branch_stock_requests for delete
  using (public.store_access(branch_store_id, 'inventory') and status = 'pending');

-- A new request: checked against the branch's own product, named, and sent to the Main office
create or replace function public.branch_request_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pname text;
  vname text;
  vstock integer;
  pstock integer;
  pimg text;
  vimg text;
  office record;
begin
  if not exists (select 1 from public.dashboards where store_id = new.branch_store_id and module = 'cashier') then
    raise exception 'Only Supply Office branches send stock requests.';
  end if;
  select name, stock, image_url into pname, pstock, pimg from public.products where id = new.product_id and seller_id = new.branch_store_id;
  if pname is null then raise exception 'Choose one of your branch''s products.'; end if;
  if new.variant_id is not null then
    select name, stock, image_url into vname, vstock, vimg from public.product_variants where id = new.variant_id and product_id = new.product_id;
    if vname is null then raise exception 'That size was not found.'; end if;
  end if;
  if new.kind = 'return' then
    if new.reason is null then raise exception 'Choose why the items go back: damaged, defective or other.'; end if;
    if new.quantity > coalesce(vstock, pstock, 0) then
      raise exception 'Only % in stock — you can''t return %.', coalesce(vstock, pstock, 0), new.quantity;
    end if;
  else
    new.reason := null;
  end if;
  new.product_name := pname || coalesce(' (' || vname || ')', '');
  new.product_image_url := coalesce(vimg, pimg);
  new.status := 'pending';
  new.created_by := auth.uid();

  select d.id into office from public.dashboards d where d.module = 'supply_office' limit 1;
  if office.id is not null then
    perform public.notify_dashboard(office.id, 'inventory', 'inventory',
      case new.kind when 'restock' then 'Restock request' else 'Damaged / defective items reported' end,
      coalesce((select org_name from public.seller_profiles where id = new.branch_store_id), 'A branch') || ': '
        || new.quantity || ' × ' || new.product_name,
      '/supply-office/branch-inventory');
  end if;
  return new;
end;
$$;
drop trigger if exists branch_request_rules on public.branch_stock_requests;
create trigger branch_request_rules before insert on public.branch_stock_requests
  for each row execute procedure public.branch_request_rules();
update public.branch_stock_requests r
set product_image_url = coalesce((select image_url from public.product_variants where id = r.variant_id),
                                 (select image_url from public.products where id = r.product_id))
where r.product_image_url is null;

-- Stock change on a branch product / size, recorded as an inventory movement
create or replace function public.branch_stock_change(p_store uuid, p_product uuid, p_variant uuid, p_delta integer, p_reason text, p_note text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  label text;
  after_stock integer;
  now_stock integer;
begin
  select coalesce((select stock from public.product_variants where id = p_variant and product_id = p_product),
                  (select stock from public.products where id = p_product and seller_id = p_store))
    into now_stock;
  if now_stock is null then raise exception 'That product was not found in the branch.'; end if;
  if now_stock + p_delta < 0 then raise exception 'Only % in stock.', now_stock; end if;
  if p_variant is not null then
    update public.product_variants v set stock = v.stock + p_delta, updated_at = now()
    where v.id = p_variant and v.product_id = p_product returning v.stock into after_stock;
    select p.name || ' (' || v.name || ')' into label from public.products p join public.product_variants v on v.product_id = p.id where v.id = p_variant;
  else
    update public.products p set stock = p.stock + p_delta, updated_at = now()
    where p.id = p_product and p.seller_id = p_store returning p.stock into after_stock;
    select name into label from public.products where id = p_product;
  end if;
  insert into public.inventory_movements (store_id, product_id, variant_id, product_name, change, reason, note, created_by)
  values (p_store, p_product, p_variant, label, p_delta, p_reason, p_note, auth.uid());
  return after_stock;
end;
$$;
revoke all on function public.branch_stock_change(uuid, uuid, uuid, integer, text, text) from public, anon, authenticated;

-- The Main office fulfils / declines a restock, or approves / declines a return
create or replace function public.review_branch_request(p_id uuid, p_decision text, p_quantity integer default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.branch_stock_requests;
  qty integer;
  current_stock integer;
  dash uuid;
  title text;
begin
  if not public.module_access('supply_office', 'inventory') then
    raise exception 'Only the Main Supply Office reviews branch requests.';
  end if;
  select * into r from public.branch_stock_requests where id = p_id and status = 'pending' for update;
  if not found then raise exception 'This request was already reviewed.'; end if;

  if p_decision = 'decline' then
    update public.branch_stock_requests set status = 'declined', main_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
    title := case r.kind when 'restock' then 'Restock request declined' else 'Return report declined' end;
  elsif r.kind = 'restock' and p_decision = 'fulfil' then
    qty := coalesce(p_quantity, r.quantity);
    if qty < 1 then raise exception 'Enter how many units you''re sending.'; end if;
    perform public.branch_stock_change(r.branch_store_id, r.product_id, r.variant_id, qty, 'restock',
      'From Main Supply Office' || coalesce(': ' || nullif(trim(p_note), ''), ''));
    update public.branch_stock_requests
    set status = case when qty >= r.quantity then 'fulfilled' else 'partial' end, fulfilled_quantity = qty,
        main_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_id;
    title := 'Restock sent: ' || qty || ' × ' || r.product_name;
  elsif r.kind = 'return' and p_decision = 'approve' then
    select coalesce((select stock from public.product_variants where id = r.variant_id), (select stock from public.products where id = r.product_id), 0)
      into current_stock;
    qty := least(coalesce(p_quantity, r.quantity), current_stock);
    if qty > 0 then
      perform public.branch_stock_change(r.branch_store_id, r.product_id, r.variant_id, -qty, 'adjustment',
        'Returned to Main Supply Office: ' || r.reason || coalesce(' — ' || nullif(trim(r.note), ''), ''));
    end if;
    update public.branch_stock_requests
    set status = 'approved', fulfilled_quantity = qty, main_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_id;
    title := 'Return approved: ' || qty || ' × ' || r.product_name;
  else
    raise exception 'Choose fulfil or decline for restocks, approve or decline for returns.';
  end if;

  select id into dash from public.dashboards where store_id = r.branch_store_id and module = 'cashier' limit 1;
  if dash is not null then
    perform public.notify_dashboard(dash, 'inventory', 'inventory', title, coalesce(nullif(trim(p_note), ''), r.product_name), '/cashier/inventory');
  end if;
end;
$$;
grant execute on function public.review_branch_request(uuid, text, integer, text) to authenticated;

-- The Main office adds to, removes from or counts a branch's stock directly
create or replace function public.main_adjust_branch_stock(p_store uuid, p_product uuid, p_variant uuid, p_mode text, p_quantity integer, p_note text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  before_stock integer;
  delta integer;
begin
  if not public.module_access('supply_office', 'inventory') then raise exception 'Only the Main Supply Office manages branch stock.'; end if;
  if not exists (select 1 from public.dashboards where store_id = p_store and module = 'cashier') then raise exception 'That store is not a Supply Office branch.'; end if;
  if not exists (select 1 from public.products where id = p_product and seller_id = p_store) then raise exception 'That product is not in this branch.'; end if;
  select coalesce((select stock from public.product_variants where id = p_variant and product_id = p_product), (select stock from public.products where id = p_product))
    into before_stock;
  delta := case p_mode when 'add' then p_quantity when 'remove' then -p_quantity when 'set' then p_quantity - before_stock end;
  if delta is null then raise exception 'Choose add, remove or set.'; end if;
  if p_quantity < 0 or (p_mode <> 'set' and p_quantity < 1) then raise exception 'Enter a valid number of units.'; end if;
  if delta = 0 then return before_stock; end if;
  return public.branch_stock_change(p_store, p_product, p_variant, delta,
    case when p_mode = 'add' then 'restock' else 'adjustment' end,
    coalesce(nullif(trim(p_note), ''), case p_mode when 'add' then 'Added by Main Supply Office' when 'set' then 'Stock count by Main Supply Office' else 'Removed by Main Supply Office' end));
end;
$$;
grant execute on function public.main_adjust_branch_stock(uuid, uuid, uuid, text, integer, text) to authenticated;

-- What the Main office sees of its branches: the branches, and each branch's products and sizes
create or replace function public.supply_branches()
returns table (store_id uuid, name text, campus text)
language sql security definer set search_path = public stable as $$
  select d.store_id, d.name, d.campus from public.dashboards d
  where d.module = 'cashier' and d.store_id is not null and public.module_access('supply_office', 'inventory')
  order by d.name;
$$;
grant execute on function public.supply_branches() to authenticated;

create or replace function public.branch_inventory(p_store uuid)
returns table (product_id uuid, product_name text, image_url text, product_status text, product_stock integer,
               variant_id uuid, variant_name text, variant_stock integer)
language sql security definer set search_path = public stable as $$
  select p.id, p.name, p.image_url, p.status, p.stock, v.id, v.name, v.stock
  from public.products p
  left join public.product_variants v on v.product_id = p.id
  where p.seller_id = p_store and public.module_access('supply_office', 'inventory')
    and exists (select 1 from public.dashboards where store_id = p_store and module = 'cashier')
  order by p.name, v.position, v.name;
$$;
grant execute on function public.branch_inventory(uuid) to authenticated;

-- ── Supply requests: special orders to the Main Supply Office ──────────────
-- Organizations and Supply Office branches order from the Main Supply Office: big orders for an
-- event (existing catalog items, modified ones, or a new design such as a uniform) and stock for an
-- organization's collaboration products (collab stock only comes from here).
--   submitted → (changes_requested ↔ submitted) → approved (quote: items + royalty per unit × qty,
--   + delivery fee) → payment_review (receipt) → paid → preparing → ready (walk-in pick-up) or
--   out_for_delivery → completed.  Also declined / cancelled.
-- Completed: collab stock is added to the organization's product; new / modified designs marked
-- "list on the marketplace" become product drafts (photos, sizes, delivered units as stock) that the
-- requester prices and submits to BAO as usual. Royalty collected here is remitted by the Main
-- office (scripts/32). Each request has a chat between the requester and the Main office.
create table if not exists public.supply_requests (
  id                 uuid primary key default gen_random_uuid(),
  requester_store_id uuid not null references public.seller_profiles(id) on delete cascade,
  requester_module   text not null check (requester_module in ('seller', 'cashier')),
  title              text not null check (char_length(trim(title)) between 1 and 150),
  description        text,
  link_url           text,
  attachments        jsonb not null default '[]'::jsonb,   -- [{url | path, name, kind: image | document}]
  needed_by          date,
  fulfilment         text not null default 'pickup' check (fulfilment in ('pickup', 'delivery')),
  delivery_address   text,
  status             text not null default 'submitted' check (status in (
                       'submitted', 'changes_requested', 'approved', 'payment_review', 'paid', 'preparing',
                       'ready', 'out_for_delivery', 'completed', 'declined', 'cancelled')),
  items_total        numeric(12,2),
  royalty_total      numeric(12,2),
  delivery_fee       numeric(12,2) not null default 0,
  total              numeric(12,2),
  royalty_percentage numeric(5,2),
  main_note          text,
  payment_method     text check (payment_method is null or payment_method in ('cash', 'gcash', 'bank')),
  receipt_url        text,
  reference_number   text,
  quoted_at          timestamptz,
  paid_at            timestamptz,
  scheduled_date     date,
  completed_at       timestamptz,
  created_by         uuid default auth.uid() references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists supply_requests_store_idx on public.supply_requests(requester_store_id, created_at desc);
create index if not exists supply_requests_status_idx on public.supply_requests(status, created_at desc);

create table if not exists public.supply_request_items (
  id                  uuid primary key default gen_random_uuid(),
  request_id          uuid not null references public.supply_requests(id) on delete cascade,
  kind                text not null check (kind in ('catalog', 'modified', 'custom', 'collab_stock')),
  product_id          uuid references public.products(id) on delete set null,
  variant_id          uuid references public.product_variants(id) on delete set null,
  design_group        text,                 -- sizes of one design share it (one listing per design)
  name                text not null,
  size                text,
  quantity            integer not null check (quantity > 0),
  notes               text,
  uses_logo           boolean not null default false,
  list_on_marketplace boolean not null default false,
  unit_price          numeric(12,2),
  royalty_percentage  numeric(5,2),
  royalty_amount      numeric(12,2) not null default 0,   -- per unit
  created_product_id  uuid references public.products(id) on delete set null,
  position            integer not null default 0
);
alter table public.supply_request_items add column if not exists image_url text;   -- product / size photo, or the design's first image
create index if not exists supply_request_items_request_idx on public.supply_request_items(request_id, position);

create table if not exists public.supply_request_messages (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.supply_requests(id) on delete cascade,
  sender_id  uuid default auth.uid() references auth.users(id) on delete set null,
  from_main  boolean not null default false,
  message    text not null check (char_length(trim(message)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists supply_request_messages_idx on public.supply_request_messages(request_id, created_at);

-- Who is looking at a request: the requester's store staff, or the Main Supply Office
create or replace function public.supply_request_role(p_request uuid)
returns text language sql security definer set search_path = public stable as $$
  select case
    when public.store_access(r.requester_store_id, 'supply') then 'requester'
    when public.module_access('supply_office', 'supply') then 'main'
  end
  from public.supply_requests r where r.id = p_request;
$$;
grant execute on function public.supply_request_role(uuid) to authenticated;

alter table public.supply_requests enable row level security;
alter table public.supply_request_items enable row level security;
alter table public.supply_request_messages enable row level security;
drop policy if exists "supply requests readable by requester and main office" on public.supply_requests;
create policy "supply requests readable by requester and main office" on public.supply_requests for select
  using (public.store_access(requester_store_id, 'supply') or public.module_access('supply_office', 'supply'));
drop policy if exists "supply request items readable" on public.supply_request_items;
create policy "supply request items readable" on public.supply_request_items for select
  using (public.supply_request_role(request_id) is not null);
drop policy if exists "supply request chat readable" on public.supply_request_messages;
create policy "supply request chat readable" on public.supply_request_messages for select
  using (public.supply_request_role(request_id) is not null);
drop policy if exists "supply request chat send" on public.supply_request_messages;
create policy "supply request chat send" on public.supply_request_messages for insert
  with check (public.supply_request_role(request_id) is not null);

-- Supply request notifications: the other side hears about every step and message
create or replace function public.notify_supply_request(p_request uuid, p_to text, p_title text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.supply_requests;
  dash record;
  office uuid;
begin
  select * into r from public.supply_requests where id = p_request;
  if not found then return; end if;
  if p_to = 'main' then
    select id into office from public.dashboards where module = 'supply_office' limit 1;
    if office is not null then
      perform public.notify_dashboard(office, 'supply', 'supply', p_title, p_body, '/supply-office/special-orders/' || r.id);
    end if;
  else
    select * into dash from public.store_dashboard_path(r.requester_store_id);
    if dash.dashboard_id is not null then
      perform public.notify_dashboard(dash.dashboard_id, 'supply', 'supply', p_title, p_body, dash.base || '/supply-requests/' || r.id);
    end if;
  end if;
end;
$$;
revoke all on function public.notify_supply_request(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.supply_message_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  role text := public.supply_request_role(new.request_id);
  r public.supply_requests;
begin
  if role is null then raise exception 'You can''t message about this request.'; end if;
  new.sender_id := auth.uid();
  new.from_main := role = 'main';
  select * into r from public.supply_requests where id = new.request_id;
  perform public.notify_supply_request(new.request_id, case when new.from_main then 'requester' else 'main' end,
    case when new.from_main then 'Main Supply Office replied' else 'New message on a supply request' end,
    r.title || ': ' || left(new.message, 120));
  return new;
end;
$$;
drop trigger if exists supply_message_rules on public.supply_request_messages;
create trigger supply_message_rules before insert on public.supply_request_messages
  for each row execute procedure public.supply_message_rules();

-- Send (or, after "changes requested", resend) a request with its items
create or replace function public.submit_supply_request(p_store uuid, p_payload jsonb, p_request uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  rid uuid := p_request;
  mod text;
  main_store uuid;
  it jsonb;
  pos integer := 0;
  k text;
  a jsonb;
  pid uuid; pname text; pprice numeric; plogo boolean; pseller uuid; pcollab boolean; pstatus text; pimg text;
  vid uuid; vname text; vprice numeric; vimg text;
  first_img text;
begin
  if not public.store_access(p_store, 'supply') then raise exception 'You don''t have access to this store''s supply requests.'; end if;
  select module into mod from public.dashboards where store_id = p_store and module in ('seller', 'cashier') limit 1;
  if mod is null then raise exception 'Only organizations and Supply Office branches send supply requests.'; end if;
  select store_id into main_store from public.dashboards where module = 'supply_office' and store_id is not null limit 1;
  if coalesce(trim(p_payload->>'title'), '') = '' then raise exception 'Give the request a title, e.g. Foundation Day shirts.'; end if;
  if jsonb_array_length(coalesce(p_payload->'items', '[]'::jsonb)) = 0 then raise exception 'Add at least one item.'; end if;
  if jsonb_array_length(p_payload->'items') > 100 then raise exception 'Keep a request under 100 lines.'; end if;
  for a in select * from jsonb_array_elements(coalesce(p_payload->'attachments', '[]'::jsonb)) loop
    if a ? 'path' and (a->>'path') not like p_store::text || '/%' then raise exception 'Upload the files again.'; end if;
    if first_img is null and a->>'kind' = 'image' and a ? 'url' then first_img := a->>'url'; end if;
  end loop;

  if rid is null then
    insert into public.supply_requests (requester_store_id, requester_module, title)
    values (p_store, mod, trim(p_payload->>'title')) returning id into rid;
  else
    perform 1 from public.supply_requests where id = rid and requester_store_id = p_store and status in ('submitted', 'changes_requested') for update;
    if not found then raise exception 'This request can''t be edited any more.'; end if;
    delete from public.supply_request_items where request_id = rid;
  end if;
  update public.supply_requests set
    title = left(trim(p_payload->>'title'), 150),
    description = nullif(trim(p_payload->>'description'), ''),
    link_url = nullif(trim(p_payload->>'link_url'), ''),
    attachments = coalesce(p_payload->'attachments', '[]'::jsonb),
    needed_by = nullif(p_payload->>'needed_by', '')::date,
    fulfilment = case when p_payload->>'fulfilment' = 'delivery' then 'delivery' else 'pickup' end,
    delivery_address = case when p_payload->>'fulfilment' = 'delivery' then nullif(trim(p_payload->>'delivery_address'), '') end,
    status = 'submitted', updated_at = now()
  where id = rid;
  if (select fulfilment from public.supply_requests where id = rid) = 'delivery'
     and (select delivery_address from public.supply_requests where id = rid) is null then
    raise exception 'Add where it should be delivered.';
  end if;

  for it in select * from jsonb_array_elements(p_payload->'items') loop
    pos := pos + 1;
    k := it->>'kind';
    if k not in ('catalog', 'modified', 'custom', 'collab_stock') then raise exception 'Unknown item type.'; end if;
    if coalesce((it->>'quantity')::integer, 0) < 1 then raise exception 'Every item needs a quantity of 1 or more.'; end if;
    pid := null; pname := null; pprice := null; plogo := false; pseller := null; pcollab := false; pstatus := null; pimg := null;
    vid := null; vname := null; vprice := null; vimg := null;
    if k in ('catalog', 'modified', 'collab_stock') then
      select id, name, price, is_royalty_product, seller_id, supply_office_collab, status, image_url
        into pid, pname, pprice, plogo, pseller, pcollab, pstatus, pimg
      from public.products where id = nullif(it->>'product_id', '')::uuid;
      if pid is null then raise exception 'One of the products is no longer available.'; end if;
      if k = 'collab_stock' then
        if pseller <> p_store or not pcollab then raise exception 'Order stock only for your own collaboration products.'; end if;
      elsif pseller is distinct from main_store or pstatus <> 'approved' then
        raise exception 'Pick items from the Main Supply Office''s products.';
      end if;
      if nullif(it->>'variant_id', '') is not null then
        select id, name, price, image_url into vid, vname, vprice, vimg from public.product_variants where id = (it->>'variant_id')::uuid and product_id = pid;
        if vid is null then raise exception 'A size of % is no longer available.', pname; end if;
      end if;
    elsif coalesce(trim(it->>'name'), '') = '' then
      raise exception 'Name every new design.';
    end if;
    insert into public.supply_request_items (request_id, kind, product_id, variant_id, design_group, name, size, quantity, notes,
                                             uses_logo, list_on_marketplace, unit_price, position, image_url)
    values (rid, k, pid, vid, nullif(it->>'design_group', ''),
            case when k = 'custom' then left(trim(it->>'name'), 150) else pname end,
            coalesce(vname, nullif(trim(it->>'size'), '')),
            (it->>'quantity')::integer,
            nullif(trim(it->>'notes'), ''),
            case when k = 'custom' then coalesce((it->>'uses_logo')::boolean, false) else coalesce(plogo, false) end,
            k in ('custom', 'modified') and coalesce((it->>'list_on_marketplace')::boolean, false),
            -- Catalog items start at the catalog price; the Main office prices the rest in its quote
            case when k = 'catalog' then coalesce(vprice, pprice) end,
            pos,
            case when k = 'custom' then first_img else coalesce(vimg, pimg) end);
  end loop;

  perform public.notify_supply_request(rid, 'main',
    case when p_request is null then 'New supply request' else 'Supply request updated' end,
    coalesce((select org_name from public.seller_profiles where id = p_store), 'A store') || ': ' || trim(p_payload->>'title'));
  return rid;
end;
$$;
grant execute on function public.submit_supply_request(uuid, jsonb, uuid) to authenticated;

-- The Main office reviews: approve with a quote, ask for changes, or decline
create or replace function public.review_supply_request(p_id uuid, p_decision text, p_note text default null,
                                                        p_prices jsonb default '[]'::jsonb, p_delivery_fee numeric default 0)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.supply_requests;
  rate numeric;
  pr jsonb;
  missing integer;
begin
  if not public.module_access('supply_office', 'supply') then raise exception 'Only the Main Supply Office reviews supply requests.'; end if;
  select * into r from public.supply_requests where id = p_id for update;
  if not found then raise exception 'Request not found.'; end if;

  if p_decision = 'approve' then
    if r.status <> 'submitted' then raise exception 'Only a request waiting for review can be approved.'; end if;
    for pr in select * from jsonb_array_elements(coalesce(p_prices, '[]'::jsonb)) loop
      if (pr->>'unit_price')::numeric < 0 then raise exception 'Prices can''t be negative.'; end if;
      update public.supply_request_items set unit_price = round((pr->>'unit_price')::numeric, 2)
      where id = (pr->>'id')::uuid and request_id = p_id;
    end loop;
    select count(*) into missing from public.supply_request_items where request_id = p_id and unit_price is null;
    if missing > 0 then raise exception 'Set a price for every item.'; end if;
    if coalesce(p_delivery_fee, 0) < 0 then raise exception 'The delivery fee can''t be negative.'; end if;
    -- Royalty: per unit of every logo item, times the units requested
    select coalesce(global_royalty_percentage, 0) into rate from public.bao_settings where id = 1;
    rate := coalesce(rate, 0);
    update public.supply_request_items set
      royalty_percentage = case when uses_logo then rate end,
      royalty_amount     = case when uses_logo then round(unit_price * rate / 100, 2) else 0 end
    where request_id = p_id;
    update public.supply_requests set
      items_total   = (select sum(unit_price * quantity) from public.supply_request_items where request_id = p_id),
      royalty_total = (select sum(royalty_amount * quantity) from public.supply_request_items where request_id = p_id),
      delivery_fee  = case when r.fulfilment = 'delivery' then coalesce(p_delivery_fee, 0) else 0 end,
      royalty_percentage = rate,
      status = 'approved', quoted_at = now(), main_note = nullif(trim(p_note), ''), updated_at = now()
    where id = p_id;
    update public.supply_requests set total = items_total + royalty_total + delivery_fee where id = p_id;
    perform public.notify_supply_request(p_id, 'requester', 'Supply request approved — please pay',
      r.title || ': ₱' || to_char((select total from public.supply_requests where id = p_id), 'FM999,999,990.00') || ' including royalty.');
  elsif p_decision = 'changes' then
    if r.status <> 'submitted' then raise exception 'Only a request waiting for review can be sent back.'; end if;
    if coalesce(trim(p_note), '') = '' then raise exception 'Tell them what to change.'; end if;
    update public.supply_requests set status = 'changes_requested', main_note = trim(p_note), updated_at = now() where id = p_id;
    perform public.notify_supply_request(p_id, 'requester', 'Changes requested on your supply request', r.title || ': ' || trim(p_note));
  elsif p_decision = 'decline' then
    if r.status not in ('submitted', 'changes_requested', 'approved') then raise exception 'This request can''t be declined now.'; end if;
    update public.supply_requests set status = 'declined', main_note = nullif(trim(p_note), ''), updated_at = now() where id = p_id;
    perform public.notify_supply_request(p_id, 'requester', 'Supply request declined', r.title || coalesce(': ' || nullif(trim(p_note), ''), ''));
  else
    raise exception 'Choose approve, changes or decline.';
  end if;
end;
$$;
grant execute on function public.review_supply_request(uuid, text, text, jsonb, numeric) to authenticated;

-- The requester pays the quote: online with a receipt, or at the Main office counter
create or replace function public.pay_supply_request(p_id uuid, p_method text, p_receipt_url text default null, p_reference text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.supply_requests;
begin
  select * into r from public.supply_requests where id = p_id for update;
  if not found or not public.store_access(r.requester_store_id, 'supply') then raise exception 'Request not found.'; end if;
  if r.status <> 'approved' then raise exception 'This request isn''t waiting for payment.'; end if;
  if p_method not in ('cash', 'gcash', 'bank') then raise exception 'Choose how you''re paying.'; end if;
  if p_method <> 'cash' and coalesce(trim(p_receipt_url), '') = '' then raise exception 'Upload the payment receipt.'; end if;
  update public.supply_requests set
    payment_method = p_method,
    receipt_url = case when p_method = 'cash' then null else trim(p_receipt_url) end,
    reference_number = nullif(trim(p_reference), ''),
    status = case when p_method = 'cash' then 'approved' else 'payment_review' end,
    updated_at = now()
  where id = p_id;
  perform public.notify_supply_request(p_id, 'main',
    case when p_method = 'cash' then 'Supply request: paying at the counter' else 'Supply request payment to check' end,
    r.title || ': ₱' || to_char(r.total, 'FM999,999,990.00'));
end;
$$;
grant execute on function public.pay_supply_request(uuid, text, text, text) to authenticated;

-- The requester withdraws a request that isn't paid yet
create or replace function public.cancel_supply_request(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.supply_requests;
begin
  select * into r from public.supply_requests where id = p_id for update;
  if not found or not public.store_access(r.requester_store_id, 'supply') then raise exception 'Request not found.'; end if;
  if r.status not in ('submitted', 'changes_requested', 'approved') then raise exception 'A paid or closed request can''t be cancelled. Message the Main office.'; end if;
  update public.supply_requests set status = 'cancelled', updated_at = now() where id = p_id;
  perform public.notify_supply_request(p_id, 'main', 'Supply request cancelled', r.title);
end;
$$;
grant execute on function public.cancel_supply_request(uuid) to authenticated;

-- The Main office moves a paid request along. Completing it adds collab stock to the organization's
-- product and turns "list on the marketplace" designs into product drafts in the requester's store.
create or replace function public.advance_supply_request(p_id uuid, p_step text, p_date date default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.supply_requests;
  it record;
  g record;
  pid uuid;
  rate numeric;
  imgs text[];
  code text;
  label text;
begin
  if not public.module_access('supply_office', 'supply') then raise exception 'Only the Main Supply Office updates supply requests.'; end if;
  select * into r from public.supply_requests where id = p_id for update;
  if not found then raise exception 'Request not found.'; end if;
  code := upper(left(r.id::text, 8));

  if p_step = 'paid' then
    if r.status not in ('approved', 'payment_review') then raise exception 'This request isn''t waiting for payment.'; end if;
    update public.supply_requests set status = 'paid', paid_at = now(), payment_method = coalesce(payment_method, 'cash'), updated_at = now() where id = p_id;
    label := 'Payment received — your supply order is confirmed';
  elsif p_step = 'reject_payment' then
    if r.status <> 'payment_review' then raise exception 'There''s no payment to check.'; end if;
    update public.supply_requests set status = 'approved', main_note = coalesce(nullif(trim(p_note), ''), main_note), updated_at = now() where id = p_id;
    label := 'Payment not confirmed — please check and send it again';
  elsif p_step = 'preparing' then
    if r.status <> 'paid' then raise exception 'Mark it paid first.'; end if;
    update public.supply_requests set status = 'preparing', scheduled_date = coalesce(p_date, scheduled_date), updated_at = now() where id = p_id;
    label := 'Your supply order is being prepared';
  elsif p_step in ('ready', 'out_for_delivery') then
    if r.status not in ('paid', 'preparing') then raise exception 'Mark it paid first.'; end if;
    update public.supply_requests set status = p_step, scheduled_date = coalesce(p_date, scheduled_date), updated_at = now() where id = p_id;
    label := case when p_step = 'ready' then 'Supply order ready for pick-up at the Main Supply Office' else 'Supply order out for delivery' end
             || coalesce(' — ' || to_char(coalesce(p_date, r.scheduled_date), 'Dy, Mon DD'), '');
  elsif p_step = 'completed' then
    if r.status not in ('paid', 'preparing', 'ready', 'out_for_delivery') then raise exception 'Mark it paid first.'; end if;
    -- Collab stock goes into the organization's own product / size
    for it in select * from public.supply_request_items where request_id = p_id and kind = 'collab_stock' and product_id is not null loop
      if it.variant_id is not null then
        update public.product_variants set stock = stock + it.quantity, updated_at = now() where id = it.variant_id;
      else
        update public.products set stock = stock + it.quantity, updated_at = now() where id = it.product_id and seller_id = r.requester_store_id;
      end if;
      insert into public.inventory_movements (store_id, product_id, variant_id, product_name, change, reason, note, created_by)
      values (r.requester_store_id, it.product_id, it.variant_id, it.name || coalesce(' (' || it.size || ')', ''), it.quantity,
              'restock', 'Supply order #' || code || ' from Main Supply Office', auth.uid());
    end loop;
    -- New / modified designs to sell: one product draft per design, its sizes as variants
    select array_agg(a->>'url') filter (where a->>'kind' = 'image' and a ? 'url') into imgs from jsonb_array_elements(r.attachments) a;
    select coalesce(global_royalty_percentage, 0) into rate from public.bao_settings where id = 1;
    for g in
      select coalesce(design_group, id::text) as grp, min(name) as name, min(notes) as notes, bool_or(uses_logo) as logo,
             min(unit_price) as price, sum(quantity) as qty, bool_or(size is not null) as sized
      from public.supply_request_items
      where request_id = p_id and kind in ('custom', 'modified') and list_on_marketplace and created_product_id is null
      group by coalesce(design_group, id::text)
    loop
      insert into public.products (seller_id, name, description, category, price, stock, badge, image_url, images, status,
                                   has_logo, is_royalty_product, royalty_percentage, supply_office_collab)
      values (r.requester_store_id, g.name, coalesce(g.notes, r.description), 'General', coalesce(g.price, 0),
              case when g.sized then 0 else g.qty end, 'Available', imgs[1], coalesce(imgs, '{}'), 'draft',
              g.logo, g.logo, case when g.logo then coalesce(rate, 0) else 0 end, r.requester_module = 'seller')
      returning id into pid;
      insert into public.product_variants (product_id, name, size, price, stock, position)
      select pid, size, size, coalesce(min(unit_price), 0), sum(quantity), min(position)
      from public.supply_request_items
      where request_id = p_id and coalesce(design_group, id::text) = g.grp and size is not null
      group by size;
      update public.supply_request_items set created_product_id = pid
      where request_id = p_id and coalesce(design_group, id::text) = g.grp;
    end loop;
    update public.supply_requests set status = 'completed', completed_at = now(), updated_at = now() where id = p_id;
    label := case when r.fulfilment = 'delivery' then 'Supply order delivered' else 'Supply order picked up' end;
  else
    raise exception 'Unknown step.';
  end if;
  if nullif(trim(p_note), '') is not null and p_step <> 'reject_payment' then
    update public.supply_requests set main_note = trim(p_note) where id = p_id;
  end if;
  perform public.notify_supply_request(p_id, 'requester', label, r.title || coalesce(' — ' || nullif(trim(p_note), ''), ''));
end;
$$;
grant execute on function public.advance_supply_request(uuid, text, date, text) to authenticated;

-- Photos for lines sent before photos were saved
update public.supply_request_items si
set image_url = coalesce((select image_url from public.product_variants where id = si.variant_id),
                         (select image_url from public.products where id = si.product_id))
where si.image_url is null and si.product_id is not null;
update public.supply_request_items si
set image_url = (select a->>'url' from public.supply_requests r, jsonb_array_elements(r.attachments) a
                 where r.id = si.request_id and a->>'kind' = 'image' and a ? 'url' limit 1)
where si.image_url is null and si.kind = 'custom';

-- Private files of a request (proposal documents): the requester uploads, both sides can read
insert into storage.buckets (id, name, public, file_size_limit)
values ('supply-requests', 'supply-requests', false, 20971520)
on conflict (id) do update set public = false;
drop policy if exists "supply request files upload" on storage.objects;
create policy "supply request files upload" on storage.objects for insert
  with check (bucket_id = 'supply-requests' and public.store_access(((storage.foldername(name))[1])::uuid, 'supply'));
drop policy if exists "supply request files read" on storage.objects;
create policy "supply request files read" on storage.objects for select
  using (bucket_id = 'supply-requests' and (
    public.store_access(((storage.foldername(name))[1])::uuid, 'supply') or public.module_access('supply_office', 'supply')));

-- ── Collaboration stock, from the Main Supply Office's side ───────────────
-- (the collaboration flag itself is created in 32_performance.sql; added here too so this runs first)
alter table public.products add column if not exists supply_office_collab boolean not null default false;
-- The Main office sees every organization's collaboration products and their stock, sends a stock
-- order (already quoted: cost + royalty per logo unit × units; the organization pays, the stock is
-- added when it's completed) and can correct the count or take out damaged units.
create or replace function public.collab_inventory()
returns table (store_id uuid, store_name text, product_id uuid, product_name text, image_url text, product_status text,
               price numeric, logo boolean, product_stock integer, variant_id uuid, variant_name text, variant_price numeric, variant_stock integer)
language sql security definer set search_path = public stable as $$
  select p.seller_id, sp.org_name, p.id, p.name, p.image_url, p.status, p.price, p.is_royalty_product, p.stock, v.id, v.name, v.price, v.stock
  from public.products p
  join public.seller_profiles sp on sp.id = p.seller_id
  left join public.product_variants v on v.product_id = p.id
  where p.supply_office_collab and p.status <> 'draft'
    and (public.module_access('supply_office', 'inventory') or public.module_access('supply_office', 'supply'))
  order by sp.org_name, p.name, v.position, v.name;
$$;
grant execute on function public.collab_inventory() to authenticated;

create or replace function public.send_collab_stock_order(p_product uuid, p_lines jsonb, p_note text default null,
                                                          p_fulfilment text default 'pickup', p_address text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  p record;
  ln jsonb;
  vid uuid;
  vname text;
  rid uuid;
  rate numeric;
  pos integer := 0;
begin
  if not (public.module_access('supply_office', 'inventory') or public.module_access('supply_office', 'supply')) then
    raise exception 'Only the Main Supply Office sends stock orders.';
  end if;
  select pr.id, pr.name, pr.seller_id, pr.is_royalty_product, pr.image_url into p
  from public.products pr where pr.id = p_product and pr.supply_office_collab;
  if p.id is null then raise exception 'That isn''t a collaboration product.'; end if;
  if not exists (select 1 from public.dashboards where store_id = p.seller_id and module = 'seller') then
    raise exception 'Collaboration products belong to organizations.';
  end if;
  if jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) = 0 then raise exception 'Enter the units to send.'; end if;
  if p_fulfilment = 'delivery' and coalesce(trim(p_address), '') = '' then raise exception 'Add where it should be delivered.'; end if;
  select coalesce(global_royalty_percentage, 0) into rate from public.bao_settings where id = 1;
  rate := coalesce(rate, 0);

  insert into public.supply_requests (requester_store_id, requester_module, title, description, fulfilment, delivery_address, status, main_note, quoted_at)
  values (p.seller_id, 'seller', left('Stock for ' || p.name, 150), 'Stock order sent by the Main Supply Office.',
          case when p_fulfilment = 'delivery' then 'delivery' else 'pickup' end,
          case when p_fulfilment = 'delivery' then trim(p_address) end,
          'approved', nullif(trim(p_note), ''), now())
  returning id into rid;

  for ln in select * from jsonb_array_elements(p_lines) loop
    if coalesce((ln->>'quantity')::integer, 0) < 1 then continue; end if;
    if coalesce((ln->>'unit_price')::numeric, -1) < 0 then raise exception 'Set the price per unit.'; end if;
    vid := null; vname := null;
    if nullif(ln->>'variant_id', '') is not null then
      select pv.id, pv.name into vid, vname from public.product_variants pv where pv.id = (ln->>'variant_id')::uuid and pv.product_id = p.id;
      if vid is null then raise exception 'A size of % was not found.', p.name; end if;
    end if;
    pos := pos + 1;
    insert into public.supply_request_items (request_id, kind, product_id, variant_id, design_group, name, size, quantity,
                                             uses_logo, unit_price, royalty_percentage, royalty_amount, position, image_url)
    values (rid, 'collab_stock', p.id, vid, p.id::text, p.name, vname, (ln->>'quantity')::integer,
            coalesce(p.is_royalty_product, false), round((ln->>'unit_price')::numeric, 2),
            case when p.is_royalty_product then rate end,
            case when p.is_royalty_product then round((ln->>'unit_price')::numeric * rate / 100, 2) else 0 end, pos,
            coalesce((select image_url from public.product_variants where id = vid), p.image_url));
  end loop;
  if pos = 0 then raise exception 'Enter the units to send.'; end if;

  update public.supply_requests set
    items_total   = (select sum(unit_price * quantity) from public.supply_request_items where request_id = rid),
    royalty_total = (select sum(royalty_amount * quantity) from public.supply_request_items where request_id = rid),
    delivery_fee = 0, royalty_percentage = rate
  where id = rid;
  update public.supply_requests set total = items_total + royalty_total where id = rid;
  perform public.notify_supply_request(rid, 'requester', 'Stock order from the Main Supply Office — please pay',
    p.name || ': ₱' || to_char((select total from public.supply_requests where id = rid), 'FM999,999,990.00') || ' including royalty.');
  return rid;
end;
$$;
grant execute on function public.send_collab_stock_order(uuid, jsonb, text, text, text) to authenticated;

-- Corrections only: take out damaged units, or set the counted total
create or replace function public.main_adjust_collab_stock(p_product uuid, p_variant uuid, p_mode text, p_quantity integer, p_note text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  store uuid;
  before_stock integer;
  after_stock integer;
  delta integer;
  dash record;
  pname text;
begin
  if not (public.module_access('supply_office', 'inventory') or public.module_access('supply_office', 'supply')) then
    raise exception 'Only the Main Supply Office corrects collaboration stock.';
  end if;
  select seller_id, name into store, pname from public.products where id = p_product and supply_office_collab;
  if store is null then raise exception 'That isn''t a collaboration product.'; end if;
  select coalesce((select stock from public.product_variants where id = p_variant and product_id = p_product),
                  (select stock from public.products where id = p_product)) into before_stock;
  if p_mode = 'remove' then
    if coalesce(p_quantity, 0) < 1 then raise exception 'Enter how many units to take out.'; end if;
    delta := -p_quantity;
  elsif p_mode = 'set' then
    if coalesce(p_quantity, -1) < 0 then raise exception 'The counted total can''t be negative.'; end if;
    delta := p_quantity - before_stock;
  else
    raise exception 'New stock is sent as a stock order. Here you can only take units out or set the count.';
  end if;
  if delta = 0 then return before_stock; end if;
  after_stock := public.branch_stock_change(store, p_product, p_variant, delta, 'adjustment',
    'Main Supply Office: ' || coalesce(nullif(trim(p_note), ''), case when p_mode = 'set' then 'stock count' else 'damaged / taken out' end));
  select * into dash from public.store_dashboard_path(store);
  if dash.dashboard_id is not null then
    perform public.notify_dashboard(dash.dashboard_id, 'inventory', 'inventory', 'Stock corrected by the Main Supply Office',
      pname || ': ' || before_stock || ' → ' || after_stock || coalesce(' — ' || nullif(trim(p_note), ''), ''), dash.base || '/inventory');
  end if;
  return after_stock;
end;
$$;
grant execute on function public.main_adjust_collab_stock(uuid, uuid, text, integer, text) to authenticated;

notify pgrst, 'reload schema';

-- Check: every Supply Office branch and its store
select d.name as branch, sp.org_name as store, sp.category
from public.dashboards d left join public.seller_profiles sp on sp.id = d.store_id
where d.module = 'cashier' order by d.campus, d.name;



-- ############################################################
-- ## 32_performance.sql
-- ############################################################

-- ============================================================
-- UniMerch — speed-up (indexes, faster row-level security) + royalty remittance
-- Run in Supabase SQL Editor AFTER 31_supply_office_branches.sql. Paste and run the WHOLE file. Safe to re-run.
-- Nothing is deleted. Section 3 adds the royalty remittance feature (see its notes); the rest only adds
-- indexes and rewrites how the security policies are evaluated (same rules, same results).
--
-- 1. Indexes for the queries the app runs most (marketplace listing, order lines, banners, chats).
--    order_items had none at all, yet every order permission check looks rows up by order_id.
-- 2. Security policies called functions such as auth.uid(), module_access('bao') and
--    store_access(seller_id) once PER ROW. On the products table every marketplace page ran a
--    dashboard lookup for every product. The policies are rewritten so each check runs ONCE per
--    query (Supabase advisor lint 0003 "auth_rls_initplan"):
--      auth.uid()                     → (select auth.uid())
--      is_staff() / is_admin() / …    → (select public.is_staff())
--      module_access('bao')           → (select public.module_access('bao'))
--      store_access(seller_id, 'x')   → seller_id in (select public.my_store_ids('x'))
--
-- If you re-run an older script that recreates policies, run this one again afterwards.
-- ============================================================

-- ── 1. Indexes ───────────────────────────────────────────────

-- Marketplace home, search and category pages: newest approved products
create index if not exists products_approved_created_idx on public.products (created_at desc) where status = 'approved';
create index if not exists products_approved_category_idx on public.products (category, created_at desc) where status = 'approved';

-- Order lines: permission checks (by order), store dashboards (by store), product history
create index if not exists order_items_order_idx   on public.order_items (order_id);
create index if not exists order_items_seller_idx  on public.order_items (seller_id);
create index if not exists order_items_product_idx on public.order_items (product_id);

-- "Near me" campus filter, banners per store, product chat, dashboards by module
create index if not exists seller_profiles_campus_idx  on public.seller_profiles (campus);
create index if not exists store_banners_seller_idx    on public.store_banners (seller_id);
create index if not exists product_messages_product_idx on public.product_messages (product_id, created_at);
create index if not exists dashboards_module_idx       on public.dashboards (module);
create index if not exists dashboard_members_dashboard_idx on public.dashboard_members (dashboard_id);

-- ── 2. Helper: the signed-in user's stores (used by the policies below) ──

-- The stores the signed-in user may act for (optionally: with permission p_perm).
-- Same rule as store_access(), but returned as one list so a policy can check it once per query.
create or replace function public.my_store_ids(p_perm text default null)
returns setof uuid language sql security definer set search_path = public stable as $$
  select d.store_id
  from public.dashboards d
  join public.dashboard_members m on m.dashboard_id = d.id
  where m.user_id = auth.uid() and d.store_id is not null
    and (m.is_main or p_perm is null or p_perm = any(m.permissions));
$$;

-- ── 3. Royalty: remittance to BAO, rate changes, Supply Office collaborations ──
--
-- How royalty works: BAO sets one rate (bao_settings.global_royalty_percentage). A product with the
-- official university logo carries that rate; buyers pay the listed price and, per unit sold,
-- round(price × rate ÷ 100, 2) goes to BAO (taken from the store's earnings).
--   • Each royalty sale line records its rate and the store that OWES it (royalty_store_id): the
--     selling store, or the Main Supply Office for products made in collaboration with it.
--   • A store remits the royalty of its PAID sales (paid / ready for pickup / completed) with a
--     receipt; BAO approves (those sales leave the balance, which resets) or rejects (they return).
--   • When BAO changes the rate, every logo listing and every sale not yet remitted moves to the
--     new rate. Sales inside a remittance (waiting or approved) keep the rate they were remitted at.

-- Products made with the Main Supply Office: the Supply Office pays the royalty, not the seller
alter table public.products add column if not exists supply_office_collab boolean not null default false;

create table if not exists public.royalty_remittances (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references public.seller_profiles(id) on delete cascade,  -- the paying store
  amount           numeric(12,2) not null default 0,
  items_count      integer not null default 0,
  period_start     timestamptz,                         -- first and last sale included
  period_end       timestamptz,
  breakdown        jsonb not null default '[]'::jsonb,  -- per product and rate: product, rate, items, gross, royalty, collab, store
  method           text not null check (method in ('gcash','bank')),
  receipt_url      text not null,
  reference_number text,
  notes            text,
  status           text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_by     uuid references auth.users(id) on delete set null,
  reviewed_by      uuid references auth.users(id) on delete set null,
  reviewed_at      timestamptz,
  bao_note         text,
  created_at       timestamptz not null default now()
);
create index if not exists royalty_remittances_store_idx  on public.royalty_remittances (store_id, created_at desc);
create index if not exists royalty_remittances_status_idx on public.royalty_remittances (status, created_at desc);
-- At most one remittance waiting for BAO per store
create unique index if not exists royalty_remittances_one_pending on public.royalty_remittances (store_id) where status = 'pending';

alter table public.royalty_remittances enable row level security;
-- Read only: remittances are created and reviewed through the functions below
drop policy if exists "stores read own remittances" on public.royalty_remittances;
create policy "stores read own remittances" on public.royalty_remittances
  for select using (store_id in (select public.my_store_ids()));
drop policy if exists "bao reads remittances" on public.royalty_remittances;
create policy "bao reads remittances" on public.royalty_remittances
  for select using ((select public.module_access('bao')));

-- Sale lines: the rate used, the store that owes the royalty, the remittance that paid it
alter table public.order_items add column if not exists royalty_percentage numeric(5,2);
alter table public.order_items add column if not exists royalty_store_id   uuid;
alter table public.order_items add column if not exists remittance_id      uuid references public.royalty_remittances(id) on delete set null;
create index if not exists order_items_royalty_open_idx on public.order_items (royalty_store_id) where remittance_id is null;
create index if not exists order_items_remittance_idx   on public.order_items (remittance_id);
-- Royalty collected in supply orders (scripts/31) is remitted by the Main office the same way
do $$ begin
  if to_regclass('public.supply_request_items') is not null then
    alter table public.supply_request_items add column if not exists remittance_id uuid references public.royalty_remittances(id) on delete set null;
  end if;
end $$;

-- Past royalty sales: owed by the store that sold them, at the rate they were recorded with
update public.order_items oi set
  royalty_store_id   = oi.seller_id,
  royalty_percentage = coalesce(
    (select p.royalty_percentage from public.products p where p.id = oi.product_id and p.is_royalty_product),
    round(oi.royalty_amount * 100 / nullif(oi.unit_price, 0), 2))
where oi.royalty_amount > 0 and oi.royalty_store_id is null;

-- Supply Office branches (module 'cashier') are supplied by the Main Supply Office, which pays the
-- royalty on everything they sell
create or replace function public.is_branch_store(p_store uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.dashboards where store_id = p_store and module = 'cashier');
$$;
create or replace function public.main_supply_store()
returns uuid language sql security definer set search_path = public stable as $$
  select store_id from public.dashboards where module = 'supply_office' and store_id is not null limit 1;
$$;

-- Product royalty fields always follow price and rate (also when size prices change)
create or replace function public.products_royalty_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_royalty_product then
    new.royalty_amount := round(coalesce(new.price, 0) * coalesce(new.royalty_percentage, 0) / 100, 2);
    -- Collaborations and branch products: the Main Supply Office pays the royalty, so the seller
    -- receives the full price
    new.final_price := new.price - case when new.supply_office_collab or public.is_branch_store(new.seller_id) then 0 else new.royalty_amount end;
  else
    new.royalty_amount := 0;
    new.final_price := new.price;
  end if;
  return new;
end;
$$;
drop trigger if exists products_royalty_fields on public.products;
create trigger products_royalty_fields
  before insert or update of price, royalty_percentage, is_royalty_product, supply_office_collab on public.products
  for each row execute procedure public.products_royalty_fields();

-- Each new sale line of a logo product: record its rate and who owes the royalty
create or replace function public.order_items_royalty_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  new.remittance_id := null;  -- only submit_royalty_remittance() attaches lines to a remittance
  select is_royalty_product, royalty_percentage, supply_office_collab into p
  from public.products where id = new.product_id;
  if coalesce(p.is_royalty_product, false) then
    new.royalty_percentage := p.royalty_percentage;
    new.royalty_store_id := new.seller_id;
    -- Every branch sale: owed by the Main Supply Office
    if public.is_branch_store(new.seller_id) then
      new.royalty_store_id := coalesce(public.main_supply_store(), new.seller_id);
    end if;
    -- Collaboration products: the royalty was paid up front, per unit, in the supply order that
    -- brought their stock (scripts/31), so their sales carry none
    if p.supply_office_collab then
      new.royalty_store_id := null;
      new.royalty_percentage := null;
      new.royalty_amount := 0;
    end if;
  else
    new.royalty_store_id := null;
  end if;
  return new;
end;
$$;
drop trigger if exists order_items_royalty_owner on public.order_items;
create trigger order_items_royalty_owner before insert on public.order_items
  for each row execute procedure public.order_items_royalty_owner();

-- Branch sales not remitted yet move to the Main Supply Office (remittances already sent stay)
update public.order_items oi set royalty_store_id = public.main_supply_store()
where oi.royalty_store_id is not null and oi.remittance_id is null
  and public.is_branch_store(oi.seller_id) and public.main_supply_store() is not null
  and oi.royalty_store_id is distinct from public.main_supply_store();
-- Branch logo products: the branch keeps the full price
update public.products set price = price where is_royalty_product and public.is_branch_store(seller_id);

-- BAO changes the rate → every logo listing and every sale not yet remitted uses the new rate
create or replace function public.apply_royalty_rate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.global_royalty_percentage is distinct from old.global_royalty_percentage then
    update public.products set royalty_percentage = new.global_royalty_percentage
    where is_royalty_product and royalty_percentage is distinct from new.global_royalty_percentage;

    update public.order_items set
      royalty_percentage = new.global_royalty_percentage,
      royalty_amount     = round(unit_price * new.global_royalty_percentage / 100, 2)
    where royalty_store_id is not null and remittance_id is null;
  end if;
  return new;
end;
$$;
drop trigger if exists apply_royalty_rate on public.bao_settings;
create trigger apply_royalty_rate after update on public.bao_settings
  for each row execute procedure public.apply_royalty_rate();

-- A store's royalty sales that are not remitted yet (or waiting in its pending remittance).
-- A function because the Supply Office owes royalty on other stores' orders, which it can't read.
drop function if exists public.royalty_lines(uuid);
create or replace function public.royalty_lines(p_store uuid)
returns table (
  item_id uuid, order_id uuid, ordered_at timestamptz, order_status text, product_name text,
  quantity integer, unit_price numeric, royalty_percentage numeric, royalty_amount numeric,
  origin_store uuid, origin_name text, collab boolean, remittance_id uuid, origin_branch boolean, fully_paid boolean,
  supply boolean
)
language plpgsql security definer set search_path = public stable as $$
#variable_conflict use_column
begin
  if not public.store_access(p_store, 'reports') then
    raise exception 'You don''t have access to this store''s royalty.';
  end if;
  return query
    select oi.id, oi.order_id, o.created_at, o.status, oi.product_name,
           oi.quantity, oi.unit_price, oi.royalty_percentage, oi.royalty_amount,
           oi.seller_id, sp.org_name, oi.royalty_store_id is distinct from oi.seller_id, oi.remittance_id,
           public.is_branch_store(oi.seller_id),
           o.status in ('paid', 'completed') or (o.status = 'ready_for_pickup' and coalesce(o.amount_paid, o.total) >= o.total),
           false
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    left join public.seller_profiles sp on sp.id = oi.seller_id
    left join public.royalty_remittances r on r.id = oi.remittance_id
    where oi.royalty_store_id = p_store
      and o.status not in ('cancelled', 'refunded')
      and (oi.remittance_id is null or r.status = 'pending')
    union all
    -- Paid supply orders' royalty (per unit × units ordered), owed by the Main office
    select si.id, si.request_id, coalesce(sr.paid_at, sr.created_at), 'paid'::text, si.name || coalesce(' (' || si.size || ')', ''),
           si.quantity, si.unit_price, si.royalty_percentage, si.royalty_amount,
           sr.requester_store_id, sp.org_name, false, si.remittance_id, public.is_branch_store(sr.requester_store_id), true, true
    from public.supply_request_items si
    join public.supply_requests sr on sr.id = si.request_id
    left join public.seller_profiles sp on sp.id = sr.requester_store_id
    left join public.royalty_remittances r on r.id = si.remittance_id
    where p_store = public.main_supply_store() and si.royalty_amount > 0
      and sr.status in ('paid', 'preparing', 'ready', 'out_for_delivery', 'completed')
      and (si.remittance_id is null or r.status = 'pending')
    order by 3 desc;
end;
$$;

-- A store remits the royalty of all its paid, not-yet-remitted sales (amount computed here, never sent)
create or replace function public.submit_royalty_remittance(
  p_store uuid, p_method text, p_receipt_url text, p_reference text default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  rid uuid;
  total numeric;
  n integer;
  first_at timestamptz;
  last_at timestamptz;
  parts jsonb;
  bao uuid;
  store_name text;
begin
  if not public.store_access(p_store, 'reports') then
    raise exception 'You don''t have access to this store''s royalty.';
  end if;
  if p_method not in ('gcash', 'bank') then raise exception 'Choose GCash or bank transfer.'; end if;
  if coalesce(trim(p_receipt_url), '') = '' then raise exception 'Upload the payment receipt.'; end if;
  if exists (select 1 from public.royalty_remittances where store_id = p_store and status = 'pending') then
    raise exception 'A remittance is already waiting for BAO''s review.';
  end if;

  insert into public.royalty_remittances (store_id, method, receipt_url, reference_number, notes, submitted_by)
  values (p_store, p_method, trim(p_receipt_url), nullif(trim(p_reference), ''), nullif(trim(p_notes), ''), auth.uid())
  returning id into rid;

  update public.order_items oi set remittance_id = rid
  from public.orders o
  where o.id = oi.order_id
    and oi.royalty_store_id = p_store and oi.remittance_id is null
    -- Fully paid sales only (a partly paid pre-order ready for pick up waits for its balance)
    and (o.status in ('paid', 'completed') or (o.status = 'ready_for_pickup' and coalesce(o.amount_paid, o.total) >= o.total));

  if p_store = public.main_supply_store() then
    update public.supply_request_items si set remittance_id = rid
    from public.supply_requests sr
    where sr.id = si.request_id and si.remittance_id is null and si.royalty_amount > 0
      and sr.status in ('paid', 'preparing', 'ready', 'out_for_delivery', 'completed');
  end if;

  select coalesce(sum(x.amt), 0), count(*), min(x.at), max(x.at) into total, n, first_at, last_at from (
    select oi.royalty_amount * oi.quantity as amt, o.created_at as at
    from public.order_items oi join public.orders o on o.id = oi.order_id where oi.remittance_id = rid
    union all
    select si.royalty_amount * si.quantity, coalesce(sr.paid_at, sr.created_at)
    from public.supply_request_items si join public.supply_requests sr on sr.id = si.request_id where si.remittance_id = rid
  ) x;
  if n = 0 or total <= 0 then
    raise exception 'There is no royalty from paid sales to remit yet.';
  end if;

  select coalesce(jsonb_agg(x.b order by x.b->>'product', (x.b->>'rate')::numeric), '[]'::jsonb) into parts
  from (
    select jsonb_build_object(
      'product', oi.product_name,
      'rate',    oi.royalty_percentage,
      'items',   sum(oi.quantity),
      'gross',   sum(oi.unit_price * oi.quantity),
      'royalty', sum(oi.royalty_amount * oi.quantity),
      'collab',  oi.royalty_store_id is distinct from oi.seller_id and not public.is_branch_store(oi.seller_id),
      'branch',  public.is_branch_store(oi.seller_id),
      'store',   max(sp.org_name)) as b
    from public.order_items oi
    left join public.seller_profiles sp on sp.id = oi.seller_id
    where oi.remittance_id = rid
    group by oi.product_name, oi.royalty_percentage, oi.seller_id, oi.royalty_store_id
    union all
    select jsonb_build_object(
      'product', si.name || coalesce(' (' || si.size || ')', ''),
      'rate',    si.royalty_percentage,
      'items',   sum(si.quantity),
      'gross',   sum(si.unit_price * si.quantity),
      'royalty', sum(si.royalty_amount * si.quantity),
      'collab',  false,
      'branch',  public.is_branch_store(sr.requester_store_id),
      'supply',  true,
      'store',   max(sp.org_name))
    from public.supply_request_items si
    join public.supply_requests sr on sr.id = si.request_id
    left join public.seller_profiles sp on sp.id = sr.requester_store_id
    where si.remittance_id = rid
    group by si.name, si.size, si.royalty_percentage, sr.requester_store_id
  ) x;

  update public.royalty_remittances
  set amount = total, items_count = n, period_start = first_at, period_end = last_at, breakdown = parts
  where id = rid;

  select id into bao from public.dashboards where module = 'bao' limit 1;
  select org_name into store_name from public.seller_profiles where id = p_store;
  if bao is not null then
    perform public.notify_dashboard(bao, 'royalty', 'royalty', 'Royalty remittance to review',
      coalesce(store_name, 'A store') || ' remitted ₱' || to_char(total, 'FM999,999,990.00') || '.', '/bao/remittances');
  end if;
  return rid;
end;
$$;

-- BAO approves (the sales stay remitted: the store's balance resets) or rejects (they return to the balance)
create or replace function public.review_royalty_remittance(p_id uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  dash record;
begin
  if not public.module_access('bao', 'royalty') then raise exception 'Only BAO can review remittances.'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'Choose approve or reject.'; end if;

  update public.royalty_remittances
  set status = p_decision, bao_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id and status = 'pending'
  returning store_id, amount into r;
  if not found then raise exception 'This remittance was already reviewed.'; end if;

  if p_decision = 'rejected' then
    update public.order_items set remittance_id = null where remittance_id = p_id;
    if to_regclass('public.supply_request_items') is not null then
      update public.supply_request_items set remittance_id = null where remittance_id = p_id;
    end if;
  end if;

  select * into dash from public.store_dashboard_path(r.store_id);
  if dash.dashboard_id is not null then
    perform public.notify_dashboard(dash.dashboard_id, 'reports', 'royalty',
      case p_decision when 'approved' then 'Royalty remittance approved' else 'Royalty remittance rejected' end,
      '₱' || to_char(r.amount, 'FM999,999,990.00') || coalesce(' — ' || nullif(trim(p_note), ''), ''),
      dash.base || '/royalty');
  end if;
end;
$$;

-- Product notifications (from 17_notifications.sql) + the Main Supply Office hears about
-- collaboration products the moment they go live
create or replace function public.notify_product_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  dash record;
  bao uuid;
  office uuid;
  store_name text;
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status = 'pending' then
      select id into bao from public.dashboards where module = 'bao';
      if bao is not null then
        perform public.notify_dashboard(bao, 'approvals', 'product', 'Product awaiting approval', new.name, '/bao/approvals');
      end if;
    elsif tg_op = 'UPDATE' and new.status in ('approved','rejected','pulled') then
      select * into dash from public.store_dashboard_path(new.seller_id);
      if dash.dashboard_id is not null then
        perform public.notify_dashboard(dash.dashboard_id, 'products', 'product',
          case new.status when 'approved' then 'Product approved — now live' when 'rejected' then 'Product rejected by BAO' else 'Product pulled out by BAO' end,
          new.name || coalesce(' — ' || new.bao_comment, ''), dash.base || '/products');
      end if;
      if new.status = 'approved' and new.supply_office_collab then
        select id into office from public.dashboards where module = 'supply_office' limit 1;
        select org_name into store_name from public.seller_profiles where id = new.seller_id;
        if office is not null then
          perform public.notify_dashboard(office, 'products', 'product', 'Collaboration product now live',
            new.name || ' by ' || coalesce(store_name, 'an organization') || ' — its royalty is paid by the Supply Office.',
            '/supply-office/royalty');
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists notify_product_events on public.products;
create trigger notify_product_events after insert or update of status on public.products
  for each row execute procedure public.notify_product_events();

-- ── 3b. Message a store without picking a product ─────────────
-- The storefront's "Contact Seller" button opens a general chat with the store (start_conversation
-- needs a product). One general conversation per buyer and store; products can be shared inside it.
create or replace function public.start_store_conversation(p_store uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  store_name text;
  conv uuid;
begin
  if me is null then raise exception 'Sign in to message the seller.'; end if;
  select coalesce(org_name, 'the seller') into store_name
  from public.seller_profiles where id = p_store and status = 'active';
  if store_name is null then raise exception 'This store is not available.'; end if;
  if public.store_access(p_store) then raise exception 'You can''t message your own store.'; end if;

  -- unique (buyer, store, product) doesn't match rows without a product, so look it up here
  select id into conv from public.conversations where buyer_id = me and seller_id = p_store and product_id is null;
  if conv is not null then return conv; end if;

  insert into public.conversations (buyer_id, seller_id, product_id, status)
  values (me, p_store, null, 'open')
  returning id into conv;

  insert into public.conversation_messages (conversation_id, kind, content, is_read)
  values (conv, 'system', 'You are now chatting with ' || store_name || '.', true);
  return conv;
end;
$$;
grant execute on function public.start_store_conversation(uuid) to authenticated;

-- ── 3c. Log every login-email change (Verification Admin → Activity Logs) ──
-- Store accounts (Seller, Supply Office and its branches) change their email instantly; other users
-- confirm it from the new address first. Either way this records the change the moment it actually
-- happens. Logging never blocks the change itself.
create or replace function public.log_email_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    begin
      insert into public.verification_audit_log (user_id, action, reason)
      select new.id, 'email_changed', coalesce(old.email, '—') || ' → ' || coalesce(new.email, '—')
      where exists (select 1 from public.profiles where id = new.id);
    exception when others then
      raise warning 'Email change not logged for %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;
drop trigger if exists log_email_change on auth.users;
create trigger log_email_change after update of email on auth.users
  for each row execute procedure public.log_email_change();

-- ── 3d. Official Campus → College → Program catalog ─────────────────────
-- Profiles keep their campus / department / course columns, which now hold catalog codes
-- (lib/campus-catalog.ts): department = college code ("bulan.cict"), course = program code ("bulan.bsit").
-- Baribag Extension is part of the Main campus: shown separately only for a student's identity;
-- for stores, product restrictions and filters it counts as Main.

-- A store's college (optional: campus-wide organizations have none)
alter table public.seller_profiles add column if not exists department text;

-- Stores and branches on Baribag belong to the Main campus
update public.seller_profiles set campus = 'sorsogon_city_main' where campus = 'sorsogon_city_baribag';
update public.dashboards set campus = 'sorsogon_city_main' where campus = 'sorsogon_city_baribag';

-- Restricted products: products.allowed_roles holds role tokens (student, faculty, staff, guest) and,
-- optionally, "campus:<campus>", "college:<code>", "program:<code>". A buyer must match a role AND,
-- when places are listed, be verified with a matching campus, college or program.
create or replace function public.viewer_role_allowed(allowed text[])
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        (coalesce(p.is_identity_verified, false) and p.affiliation = any(allowed))
        or ('guest' = any(allowed) and (not coalesce(p.is_identity_verified, false) or p.affiliation = 'external'))
      )
      and (
        not exists (select 1 from unnest(allowed) t where t like '%:%')
        or (coalesce(p.is_identity_verified, false) and (
             ('campus:' || case when p.campus = 'sorsogon_city_baribag' then 'sorsogon_city_main' else p.campus end) = any(allowed)
          or ('college:' || p.department) = any(allowed)
          or ('program:' || p.course) = any(allowed)
        ))
      )
  );
$$;

-- Users can't change their own account standing; verified users change identity only through
-- re-verification — except replacing old typed-in course / department text with the official
-- catalog entry (a catalog code looks like "bulan.bsit"), which keeps them verified and is
-- still recorded in profile_change_log.
create or replace function public.guard_profile_verification()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  code_re constant text := '^[a-z]+\.[a-z0-9-]+$';
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
  if coalesce(old.is_identity_verified, false) and (
       new.affiliation is distinct from old.affiliation
    or new.full_name is distinct from old.full_name
    or new.student_employee_id is distinct from old.student_employee_id
    or (new.course is distinct from old.course
        and not (coalesce(old.course, '') !~ code_re and coalesce(new.course, '') ~ code_re))
    or (new.department is distinct from old.department
        and not (coalesce(old.department, '') !~ code_re and coalesce(new.department, '') ~ code_re))
  ) then
    raise exception 'Changing your name, I.D. number, course or department requires re-verification';
  end if;
  return new;
end;
$$;

-- One-time match of old typed-in values to the catalog (only when exactly one entry fits;
-- Main and Baribag count as one campus). Generated from lib/campus-catalog.ts.
create temp table if not exists _catalog_colleges (code text, campus text, keys text[]);
create temp table if not exists _catalog_programs (code text, college text, campus text, keys text[]);
truncate _catalog_colleges;
truncate _catalog_programs;
insert into _catalog_colleges (code, campus, keys) values
  ('main.coted', 'sorsogon_city_main', array['coted','collegeofteachereducation','collegeofteachereducationcoted','cotedcollegeofteachereducation']),
  ('main.chs', 'sorsogon_city_main', array['chs','collegeofhealthsciences','collegeofhealthscienceschs','chscollegeofhealthsciences']),
  ('main.cot', 'sorsogon_city_main', array['cot','collegeoftechnology','collegeoftechnologycot','cotcollegeoftechnology']),
  ('main.cbm', 'sorsogon_city_main', array['cbm','collegeofbusinessandmanagement','collegeofbusinessandmanagementcbm','cbmcollegeofbusinessandmanagement']),
  ('main.cs', 'sorsogon_city_main', array['cs','collegeofscience','collegeofsciencecs','cscollegeofscience']),
  ('main.sgs', 'sorsogon_city_main', array['sgs','schoolofgraduatestudies','schoolofgraduatestudiessgs','sgsschoolofgraduatestudies']),
  ('baribag.cea', 'sorsogon_city_baribag', array['cea','collegeofengineeringandarchitecture','collegeofengineeringandarchitecturecea','ceacollegeofengineeringandarchitecture']),
  ('bulan.cict', 'bulan', array['cict','collegeofinformationandcommunicationstechnology','collegeofinformationandcommunicationstechnologycict','cictcollegeofinformationandcommunicationstechnology']),
  ('bulan.cbme', 'bulan', array['cbme','collegeofbusinessmanagementandeducation','collegeofbusinessmanagementandeducationcbme','cbmecollegeofbusinessmanagementandeducation']),
  ('castilla.ca', 'castilla', array['ca','collegeofagriculture','collegeofagricultureca','cacollegeofagriculture']),
  ('magallanes.cfms', 'magallanes', array['cfms','collegeoffisheriesandmarinesciences','collegeoffisheriesandmarinesciencescfms','cfmscollegeoffisheriesandmarinesciences']),
  ('magallanes.coed', 'magallanes', array['coed','collegeofeducation','collegeofeducationcoed','coedcollegeofeducation']);
insert into _catalog_programs (code, college, campus, keys) values
  ('main.beed', 'main.coted', 'sorsogon_city_main', array['beed','bachelorofelementaryeducation','bachelorofelementaryeducationbeed','belementaryeducation']),
  ('main.bcaed', 'main.coted', 'sorsogon_city_main', array['bcaed','bachelorofcultureandartseducation','bachelorofcultureandartseducationbcaed','bcultureandartseducation']),
  ('main.bped', 'main.coted', 'sorsogon_city_main', array['bped','bachelorofphysicaleducation','bachelorofphysicaleducationbped','bphysicaleducation']),
  ('main.bsed-english', 'main.coted', 'sorsogon_city_main', array['bsedenglish','bachelorofsecondaryeducationmajorinenglish','bachelorofsecondaryeducationmajorinenglishbsedenglish','bsecondaryeducationmajorinenglish','bachelorofsecondaryeducationenglish']),
  ('main.bsed-math', 'main.coted', 'sorsogon_city_main', array['bsedmath','bachelorofsecondaryeducationmajorinmathematics','bachelorofsecondaryeducationmajorinmathematicsbsedmath','bsecondaryeducationmajorinmathematics','bachelorofsecondaryeducationmathematics']),
  ('main.bsed-science', 'main.coted', 'sorsogon_city_main', array['bsedscience','bachelorofsecondaryeducationmajorinscience','bachelorofsecondaryeducationmajorinsciencebsedscience','bsecondaryeducationmajorinscience','bachelorofsecondaryeducationscience']),
  ('main.bsed-filipino', 'main.coted', 'sorsogon_city_main', array['bsedfilipino','bachelorofsecondaryeducationmajorinfilipino','bachelorofsecondaryeducationmajorinfilipinobsedfilipino','bsecondaryeducationmajorinfilipino','bachelorofsecondaryeducationfilipino']),
  ('main.bsed-socstud', 'main.coted', 'sorsogon_city_main', array['bsedsocialstudies','bachelorofsecondaryeducationmajorinsocialstudies','bachelorofsecondaryeducationmajorinsocialstudiesbsedsocialstudies','bsecondaryeducationmajorinsocialstudies','bachelorofsecondaryeducationsocialstudies']),
  ('main.bs-midwifery', 'main.coted', 'sorsogon_city_main', array['bsmidwifery','bachelorofscienceinmidwifery','bachelorofscienceinmidwiferybsmidwifery']),
  ('main.bsn', 'main.chs', 'sorsogon_city_main', array['bsn','bachelorofscienceinnursing','bachelorofscienceinnursingbsn','bsnursing']),
  ('main.btvte', 'main.cot', 'sorsogon_city_main', array['btvte','bacheloroftechnicalvocationalteachereducation','bacheloroftechnicalvocationalteachereducationbtvte','btechnicalvocationalteachereducation']),
  ('main.bt-drafting', 'main.cot', 'sorsogon_city_main', array['btdrafting','bacheloroftechnologymajorinarchitecturaldrafting','bacheloroftechnologymajorinarchitecturaldraftingbtdrafting','btechnologymajorinarchitecturaldrafting','bacheloroftechnologyarchitecturaldrafting']),
  ('main.bt-automotive', 'main.cot', 'sorsogon_city_main', array['btautomotive','bacheloroftechnologymajorinautomotivetechnology','bacheloroftechnologymajorinautomotivetechnologybtautomotive','btechnologymajorinautomotivetechnology','bacheloroftechnologyautomotivetechnology']),
  ('main.bt-civil', 'main.cot', 'sorsogon_city_main', array['btcivil','bacheloroftechnologymajorinciviltechnology','bacheloroftechnologymajorinciviltechnologybtcivil','btechnologymajorinciviltechnology','bacheloroftechnologyciviltechnology']),
  ('main.bt-electrical', 'main.cot', 'sorsogon_city_main', array['btelectrical','bacheloroftechnologymajorinelectricaltechnology','bacheloroftechnologymajorinelectricaltechnologybtelectrical','btechnologymajorinelectricaltechnology','bacheloroftechnologyelectricaltechnology']),
  ('main.bt-electronics', 'main.cot', 'sorsogon_city_main', array['btelectronics','bacheloroftechnologymajorinelectronicstechnology','bacheloroftechnologymajorinelectronicstechnologybtelectronics','btechnologymajorinelectronicstechnology','bacheloroftechnologyelectronicstechnology']),
  ('main.bt-garment', 'main.cot', 'sorsogon_city_main', array['btgarment','bacheloroftechnologymajoringarmenttechnology','bacheloroftechnologymajoringarmenttechnologybtgarment','btechnologymajoringarmenttechnology','bacheloroftechnologygarmenttechnology']),
  ('main.bt-mechanical', 'main.cot', 'sorsogon_city_main', array['btmechanical','bacheloroftechnologymajorinmechanicaltechnology','bacheloroftechnologymajorinmechanicaltechnologybtmechanical','btechnologymajorinmechanicaltechnology','bacheloroftechnologymechanicaltechnology']),
  ('main.bt-welding', 'main.cot', 'sorsogon_city_main', array['btwelding','bacheloroftechnologymajorinweldingfabrication','bacheloroftechnologymajorinweldingfabricationbtwelding','btechnologymajorinweldingfabrication','bacheloroftechnologyweldingfabrication']),
  ('main.bsa', 'main.cbm', 'sorsogon_city_main', array['bsa','bachelorofscienceinaccountancy','bachelorofscienceinaccountancybsa','bsaccountancy']),
  ('main.bs-entrep', 'main.cbm', 'sorsogon_city_main', array['bsentrep','bachelorofscienceinentrepreneurship','bachelorofscienceinentrepreneurshipbsentrep','bsentrepreneurship']),
  ('main.bstm', 'main.cbm', 'sorsogon_city_main', array['bstm','bachelorofscienceintourismmanagement','bachelorofscienceintourismmanagementbstm','bstourismmanagement']),
  ('main.bshm', 'main.cbm', 'sorsogon_city_main', array['bshm','bachelorofscienceinhospitalitymanagement','bachelorofscienceinhospitalitymanagementbshm','bshospitalitymanagement']),
  ('main.bs-bio', 'main.cs', 'sorsogon_city_main', array['bsbiology','bachelorofscienceinbiology','bachelorofscienceinbiologybsbiology']),
  ('main.dpa', 'main.sgs', 'sorsogon_city_main', array['dpa','doctorofpublicadministration','doctorofpublicadministrationdpa']),
  ('main.edd-elm', 'main.sgs', 'sorsogon_city_main', array['eddelm','doctorofeducationmajorineducationalleadershipandmanagement','doctorofeducationmajorineducationalleadershipandmanagementeddelm','doctorofeducationeducationalleadershipandmanagement']),
  ('main.phd-langed', 'main.sgs', 'sorsogon_city_main', array['phdlanguageed','doctorofphilosophymajorinlanguageeducation','doctorofphilosophymajorinlanguageeducationphdlanguageed','doctorofphilosophylanguageeducation']),
  ('main.phd-filipino', 'main.sgs', 'sorsogon_city_main', array['phdfilipino','doctorofphilosophymajorinfilipino','doctorofphilosophymajorinfilipinophdfilipino','doctorofphilosophyfilipino']),
  ('main.phd-mathed', 'main.sgs', 'sorsogon_city_main', array['phdmathed','doctorofphilosophymajorinmathematicseducation','doctorofphilosophymajorinmathematicseducationphdmathed','doctorofphilosophymathematicseducation']),
  ('main.maed-math', 'main.sgs', 'sorsogon_city_main', array['maedmath','masterofartsineducationmajorinmathematics','masterofartsineducationmajorinmathematicsmaedmath','masterofartsineducationmathematics']),
  ('main.maed-english', 'main.sgs', 'sorsogon_city_main', array['maedenglish','masterofartsineducationmajorinenglish','masterofartsineducationmajorinenglishmaedenglish','masterofartsineducationenglish']),
  ('main.maed-filipino', 'main.sgs', 'sorsogon_city_main', array['maedfilipino','masterofartsineducationmajorinfilipino','masterofartsineducationmajorinfilipinomaedfilipino','masterofartsineducationfilipino']),
  ('main.maed-science', 'main.sgs', 'sorsogon_city_main', array['maedscienceed','masterofartsineducationmajorinscienceeducation','masterofartsineducationmajorinscienceeducationmaedscienceed','masterofartsineducationscienceeducation']),
  ('main.mat-tech', 'main.sgs', 'sorsogon_city_main', array['mattechnologyed','masterofartsinteachingmajorintechnologyeducation','masterofartsinteachingmajorintechnologyeducationmattechnologyed','masterofartsinteachingtechnologyeducation']),
  ('main.mat-the', 'main.sgs', 'sorsogon_city_main', array['matthe','masterofartsinteachingmajorintechnologyandhomeeconomics','masterofartsinteachingmajorintechnologyandhomeeconomicsmatthe','masterofartsinteachingtechnologyandhomeeconomics']),
  ('main.mpa', 'main.sgs', 'sorsogon_city_main', array['mpa','masterofpublicadministration','masterofpublicadministrationmpa']),
  ('main.mam', 'main.sgs', 'sorsogon_city_main', array['mam','masterofartsinmanagement','masterofartsinmanagementmam']),
  ('baribag.bs-archi', 'baribag.cea', 'sorsogon_city_baribag', array['bsarchi','bachelorofscienceinarchitecture','bachelorofscienceinarchitecturebsarchi','bsarchitecture']),
  ('baribag.bsce', 'baribag.cea', 'sorsogon_city_baribag', array['bsce','bachelorofscienceincivilengineering','bachelorofscienceincivilengineeringbsce','bscivilengineering']),
  ('baribag.bsee', 'baribag.cea', 'sorsogon_city_baribag', array['bsee','bachelorofscienceinelectricalengineering','bachelorofscienceinelectricalengineeringbsee','bselectricalengineering']),
  ('baribag.bsece', 'baribag.cea', 'sorsogon_city_baribag', array['bsece','bachelorofscienceinelectronicsengineering','bachelorofscienceinelectronicsengineeringbsece','bselectronicsengineering']),
  ('baribag.bsme', 'baribag.cea', 'sorsogon_city_baribag', array['bsme','bachelorofscienceinmechanicalengineering','bachelorofscienceinmechanicalengineeringbsme','bsmechanicalengineering']),
  ('bulan.bscs', 'bulan.cict', 'bulan', array['bscs','bachelorofscienceincomputerscience','bachelorofscienceincomputersciencebscs','bscomputerscience']),
  ('bulan.bsit', 'bulan.cict', 'bulan', array['bsit','bachelorofscienceininformationtechnology','bachelorofscienceininformationtechnologybsit','bsinformationtechnology']),
  ('bulan.bsis', 'bulan.cict', 'bulan', array['bsis','bachelorofscienceininformationsystems','bachelorofscienceininformationsystemsbsis','bsinformationsystems']),
  ('bulan.bsais', 'bulan.cict', 'bulan', array['bsais','bachelorofscienceinaccountinginformationsystem','bachelorofscienceinaccountinginformationsystembsais','bsaccountinginformationsystem']),
  ('bulan.bsa', 'bulan.cbme', 'bulan', array['bsa','bachelorofscienceinaccountancy','bachelorofscienceinaccountancybsa','bsaccountancy']),
  ('bulan.bpa', 'bulan.cbme', 'bulan', array['bpa','bachelorinpublicadministration','bachelorinpublicadministrationbpa']),
  ('bulan.bsed', 'bulan.cbme', 'bulan', array['bsed','bachelorofsecondaryeducation','bachelorofsecondaryeducationbsed','bsecondaryeducation']),
  ('castilla.bsa-crop', 'castilla.ca', 'castilla', array['bsacropscience','bachelorofscienceinagriculturemajorincropscience','bachelorofscienceinagriculturemajorincropsciencebsacropscience','bsagriculturemajorincropscience','bachelorofscienceinagriculturecropscience','bsagriculturecropscience']),
  ('castilla.bsa-animal', 'castilla.ca', 'castilla', array['bsaanimalscience','bachelorofscienceinagriculturemajorinanimalscience','bachelorofscienceinagriculturemajorinanimalsciencebsaanimalscience','bsagriculturemajorinanimalscience','bachelorofscienceinagricultureanimalscience','bsagricultureanimalscience']),
  ('castilla.bsa-aged', 'castilla.ca', 'castilla', array['bsaagrieducation','bachelorofscienceinagriculturemajorinagriculturaleducation','bachelorofscienceinagriculturemajorinagriculturaleducationbsaagrieducation','bsagriculturemajorinagriculturaleducation','bachelorofscienceinagricultureagriculturaleducation','bsagricultureagriculturaleducation']),
  ('castilla.bsab', 'castilla.ca', 'castilla', array['bsab','bachelorofscienceinagribusiness','bachelorofscienceinagribusinessbsab','bsagribusiness']),
  ('castilla.bsabe', 'castilla.ca', 'castilla', array['bsabe','bachelorofscienceinagriculturalandbiosystemsengineering','bachelorofscienceinagriculturalandbiosystemsengineeringbsabe','bsagriculturalandbiosystemsengineering']),
  ('magallanes.bsfi', 'magallanes.cfms', 'magallanes', array['bsfi','bachelorofscienceinfisheries','bachelorofscienceinfisheriesbsfi','bsfisheries']),
  ('magallanes.bs-marbio', 'magallanes.cfms', 'magallanes', array['bsmarinebiology','bachelorofscienceinmarinebiology','bachelorofscienceinmarinebiologybsmarinebiology']),
  ('magallanes.bs-entrep-fish', 'magallanes.cfms', 'magallanes', array['bsentrepfisheriesbusiness','bachelorofscienceinentrepreneurshipfisheriesbusiness','bachelorofscienceinentrepreneurshipfisheriesbusinessbsentrepfisheriesbusiness','bsentrepreneurshipfisheriesbusiness']),
  ('magallanes.beed', 'magallanes.coed', 'magallanes', array['beed','bachelorofelementaryeducation','bachelorofelementaryeducationbeed','belementaryeducation']),
  ('magallanes.bsed-science', 'magallanes.coed', 'magallanes', array['bsedsciences','bachelorofsecondaryeducationmajorinsciences','bachelorofsecondaryeducationmajorinsciencesbsedsciences','bsecondaryeducationmajorinsciences','bachelorofsecondaryeducationsciences']);

create or replace function pg_temp.norm(t text) returns text language sql immutable as
  $$ select lower(regexp_replace(coalesce(t, ''), '[^a-zA-Z0-9]', '', 'g')) $$;
create or replace function pg_temp.same_campus(a text, b text) returns boolean language sql immutable as
  $$ select a is null or b is null
            or replace(a, 'sorsogon_city_baribag', 'sorsogon_city_main') = replace(b, 'sorsogon_city_baribag', 'sorsogon_city_main') $$;

-- Programs (and the campus that goes with them)
with m as (
  select p.id, min(c.code) as code, min(c.campus) as campus
  from public.profiles p
  join _catalog_programs c on pg_temp.norm(p.course) = any(c.keys) and pg_temp.same_campus(p.campus, c.campus)
  where p.course is not null and p.course !~ '^[a-z]+\.[a-z0-9-]+$'
  group by p.id having count(*) = 1
)
update public.profiles p set course = m.code, campus = m.campus from m where p.id = m.id;

-- Colleges: typed name/abbreviation, or the college of the matched program
with m as (
  select p.id, min(c.code) as code, min(c.campus) as campus
  from public.profiles p
  join _catalog_colleges c on pg_temp.norm(p.department) = any(c.keys) and pg_temp.same_campus(p.campus, c.campus)
  where p.department is not null and p.department !~ '^[a-z]+\.[a-z0-9-]+$'
  group by p.id having count(*) = 1
)
update public.profiles p set department = m.code, campus = m.campus from m where p.id = m.id;
update public.profiles p set department = c.college
from _catalog_programs c
where c.code = p.course and (p.department is null or p.department !~ '^[a-z]+\.[a-z0-9-]+$');

-- Verification requests (shown to the Verification Admin) — matched within the applicant's campus
with m as (
  select r.id, min(c.code) as code
  from public.verification_requests r
  join public.profiles p on p.id = r.user_id
  join _catalog_programs c on pg_temp.norm(r.course) = any(c.keys) and pg_temp.same_campus(p.campus, c.campus)
  where r.course is not null and r.course !~ '^[a-z]+\.[a-z0-9-]+$'
  group by r.id having count(*) = 1
)
update public.verification_requests r set course = m.code from m where r.id = m.id;
with m as (
  select r.id, min(c.code) as code
  from public.verification_requests r
  join public.profiles p on p.id = r.user_id
  join _catalog_colleges c on pg_temp.norm(r.department) = any(c.keys) and pg_temp.same_campus(p.campus, c.campus)
  where r.department is not null and r.department !~ '^[a-z]+\.[a-z0-9-]+$'
  group by r.id having count(*) = 1
)
update public.verification_requests r set department = m.code from m where r.id = m.id;

-- Supply Office branches that serve one department
with m as (
  select d.id, min(c.code) as code
  from public.dashboards d
  join _catalog_colleges c on pg_temp.norm(d.department) = any(c.keys) and pg_temp.same_campus(d.campus, c.campus)
  where d.department is not null and d.department !~ '^[a-z]+\.[a-z0-9-]+$'
  group by d.id having count(*) = 1
)
update public.dashboards d set department = m.code from m where d.id = m.id;

-- Everyone whose identity still isn't on the official list is asked (once) to update it
insert into public.notifications (user_id, kind, title, body, href)
select p.id, 'info', 'Update your campus, college and course',
       'SorSU''s official list of campuses, colleges and programs is now used for your identity and for items limited to a campus, college or program. Please choose yours in My Account.',
       '/marketplace/account'
from public.profiles p
where p.affiliation in ('student', 'faculty', 'staff')
  and not (
    p.campus in ('sorsogon_city_main', 'sorsogon_city_baribag', 'bulan', 'castilla', 'magallanes')
    and exists (select 1 from _catalog_colleges c where c.code = p.department and c.campus = p.campus)
    and (p.affiliation <> 'student' or exists (select 1 from _catalog_programs c where c.code = p.course and c.college = p.department))
  )
  and not exists (select 1 from public.notifications n where n.user_id = p.id and n.title = 'Update your campus, college and course');

-- ── 3e. Number badges on the menus ─────────────────────────────────────────
-- What's new or waiting for this dashboard (or this buyer). Keys are the page paths under the
-- dashboard (e.g. "orders" → /seller/orders). The menu asks once per page, after the page shows.
-- Each count is skipped (left out) if its table isn't there yet.
create or replace function public.nav_badges(p_dashboard uuid)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  d record;
  out jsonb := '{}'::jsonb;
  n integer;
begin
  select dd.id, dd.module, dd.store_id into d
  from public.dashboards dd join public.dashboard_members m on m.dashboard_id = dd.id
  where dd.id = p_dashboard and m.user_id = auth.uid();
  if d.id is null then return out; end if;

  if d.module in ('seller', 'supply_office', 'cashier') and d.store_id is not null then
    -- New orders waiting for the store
    begin
      select count(*) into n from public.orders where seller_id = d.store_id and status = 'pending';
      out := out || jsonb_build_object('orders', n);
    exception when others then null; end;
    -- Paid pre-orders on the waitlist (to mark ready)
    begin
      select count(*) into n from public.orders where seller_id = d.store_id and is_preorder and status in ('paid', 'partially_paid');
      out := out || jsonb_build_object('preorders', n);
    exception when others then null; end;
    -- Buyer conversations with unread messages
    begin
      select count(distinct c.id) into n from public.conversations c
      join public.conversation_messages cm on cm.conversation_id = c.id
      where c.seller_id = d.store_id and not cm.is_read and not cm.from_store and cm.kind <> 'system';
      out := out || jsonb_build_object('messages', n);
    exception when others then null; end;
    -- Organizations / branches: supply requests waiting for them (changes, payment, pick-up)
    if d.module in ('seller', 'cashier') then
      begin
        select count(*) into n from public.supply_requests
        where requester_store_id = d.store_id and status in ('changes_requested', 'approved', 'ready');
        out := out || jsonb_build_object('supply-requests', n);
      exception when others then null; end;
    end if;
    -- Main Supply Office: special orders to review / payments to check, and branch requests
    if d.module = 'supply_office' then
      begin
        select count(*) into n from public.supply_requests where status in ('submitted', 'payment_review');
        out := out || jsonb_build_object('special-orders', n);
      exception when others then null; end;
      begin
        select count(*) into n from public.branch_stock_requests where status = 'pending';
        out := out || jsonb_build_object('branch-inventory', n);
      exception when others then null; end;
    end if;
  elsif d.module = 'bao' then
    begin
      select count(*) into n from public.products where status = 'pending';
      out := out || jsonb_build_object('approvals', n);
    exception when others then null; end;
    begin
      select count(*) into n from public.royalty_remittances where status = 'pending';
      out := out || jsonb_build_object('remittances', n);
    exception when others then null; end;
    begin
      select count(*) into n from public.sales_reports where status = 'submitted';
      out := out || jsonb_build_object('reports', n);
    exception when others then null; end;
  elsif d.module = 'verification' then
    begin
      select count(*) into n from public.verification_requests where status in ('pending', 'under_review');
      out := out || jsonb_build_object('queue', n);
    exception when others then null; end;
    begin
      select count(*) into n from public.account_reports where status = 'open';
      out := out || jsonb_build_object('reports', n);
    exception when others then null; end;
  end if;
  return out;
end;
$$;
grant execute on function public.nav_badges(uuid) to authenticated;

-- Buyers: orders to pick up (or to choose a pick-up day for) and conversations with unread replies
create or replace function public.buyer_badges()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  out jsonb := '{}'::jsonb;
  n integer;
begin
  if auth.uid() is null then return out; end if;
  begin
    select count(*) into n from public.orders where buyer_id = auth.uid() and status = 'ready_for_pickup';
    out := out || jsonb_build_object('orders', n);
  exception when others then null; end;
  begin
    select count(distinct c.id) into n from public.conversations c
    join public.conversation_messages cm on cm.conversation_id = c.id
    where c.buyer_id = auth.uid() and not cm.is_read and cm.from_store and cm.kind <> 'system';
    out := out || jsonb_build_object('messages', n);
  exception when others then null; end;
  return out;
end;
$$;
grant execute on function public.buyer_badges() to authenticated;

-- ── 4. Faster security checks for every policy ───────────────

-- Rewrites one policy expression (temporary helper, gone when this run ends)
create or replace function pg_temp.fast_policy_expr(e text)
returns text language plpgsql immutable as $$
begin
  if e is null then return null; end if;

  -- auth.uid() / auth.role(): once per query (skip ones already wrapped in a SELECT)
  e := regexp_replace(e, '(?<!SELECT )auth\.(uid|role)\(\)', '(select auth.\1())', 'g');

  -- Helpers that only look at the signed-in user
  e := regexp_replace(e,
    '(?<!SELECT )(?<![[:alnum:]_.])(public\.)?(is_staff|is_admin|is_verification_admin|is_verification_main|account_in_good_standing)\(\)',
    '(select public.\2())', 'g');

  -- module_access('<module>'[, '<perm>']) with fixed arguments
  e := regexp_replace(e,
    '(?<!SELECT )(?<![[:alnum:]_.])(public\.)?module_access\((''[a-z_]+''::text(, (''[a-z_]+''|NULL)::text)?)\)',
    '(select public.module_access(\2))', 'g');

  -- store_access(<column>[, '<perm>']) → one list of the user's stores. Left alone under NOT,
  -- where "unknown" (a NULL column) would behave differently from false.
  if e !~* 'not\s+\(?\s*(public\.)?store_access' then
    e := regexp_replace(e,
      '(?<![[:alnum:]_.])(public\.)?store_access\(([a-z_][[:alnum:]_.]*)\)',
      '(\2 in (select public.my_store_ids()))', 'g');
    e := regexp_replace(e,
      '(?<![[:alnum:]_.])(public\.)?store_access\(([a-z_][[:alnum:]_.]*), (''[a-z_]+''::text)\)',
      '(\2 in (select public.my_store_ids(\3)))', 'g');
  end if;
  return e;
end;
$$;

do $$
declare
  p record;
  new_using text;
  new_check text;
  changed int := 0;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
  loop
    new_using := pg_temp.fast_policy_expr(p.qual);
    new_check := pg_temp.fast_policy_expr(p.with_check);
    if new_using is distinct from p.qual or new_check is distinct from p.with_check then
      begin
        if new_using is distinct from p.qual then
          execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, new_using);
        end if;
        if new_check is distinct from p.with_check then
          execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, new_check);
        end if;
        changed := changed + 1;
      exception when others then
        raise notice 'Skipped "%" on %.%: %', p.policyname, p.schemaname, p.tablename, sqlerrm;
      end;
    end if;
  end loop;
  raise notice 'Policies sped up: %', changed;
end $$;

-- Fresh planner statistics for the new indexes
analyze public.products;
analyze public.order_items;
analyze public.orders;
analyze public.seller_profiles;
analyze public.dashboards;
analyze public.dashboard_members;
analyze public.profiles;

notify pgrst, 'reload schema';

-- Check: policies that still run a check per row (should only list row-specific ones, such as
-- conversation_role(conversation_id) or viewer_role_allowed(allowed_roles))
select tablename, policyname, coalesce(qual, with_check) as rule
from pg_policies
where schemaname in ('public', 'storage')
  and (
    (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(?<!SELECT )auth\.uid\(\)'
    or (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(?<![[:alnum:]_.])(public\.)?store_access\([a-z_]'
  )
order by tablename, policyname;
