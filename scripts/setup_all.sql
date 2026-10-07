-- ============================================================
-- UniMerch — COMPLETE DATABASE SETUP (all scripts, in order)
-- Paste this WHOLE file into the Supabase SQL Editor and click Run.
-- Safe to re-run: every step checks what already exists.
-- Generated from scripts 00, 1–5, 7–13, 15, 17–20 and 22–29. Afterwards run 14_appoint_verification_admin.sql
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
-- Pre-order flow:
--   1. Buyer checks out a pre-order: no upfront payment, uploads a photo of their I.D. and picks a
--      pick-up date within the shop's window (3–7 days).                     orders.status = pending
--   2. The shop checks the I.D.: approve → "For Pick Up" (ready_for_pickup); reject → cancelled.
--   3. Buyer pays at the counter on pick-up → completed.
--   4. Not picked up by the end of the pick-up date → the order is discarded (cancelled) and the
--      shop's penalty (default ₱10) is charged to the buyer. While a penalty with a shop is unpaid,
--      the buyer can't order from that shop. It's paid at the shop's counter or online (receipt),
--      and the shop clears it.
--
--   • seller_profiles.claim_window_days  — now 3–7 days: how far ahead a buyer may set the pick-up date
--   • seller_profiles.preorder_penalty   — the shop's penalty for unclaimed pre-orders (₱10 default)
--   • orders.pickup_date / buyer_id_path / id_status — buyer's chosen date, I.D. photo, shop's check
--   • buyer_penalties                    — penalty charges (unpaid → pending_review → paid / waived)
--   • storage bucket preorder-ids        — private: the buyer and that shop's staff only
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

-- ── Discard overdue pre-orders and charge the penalty ────────────────────
-- An approved pre-order ("For Pick Up") that isn't picked up by the end of the pick-up date is
-- cancelled (stock goes back) and the shop's penalty is charged. One the shop never confirmed
-- (I.D. still pending) is cancelled without a penalty — the delay wasn't the buyer's.
create or replace function public.expire_overdue_preorders()
returns integer language plpgsql security definer set search_path = public as $$
declare
  o record;
  n integer := 0;
  fee numeric;
  shop text;
begin
  for o in
    select id, buyer_id, seller_id, status from public.orders
    where pickup_date is not null and pickup_deadline is not null and pickup_deadline < now()
      and status in ('pending', 'ready_for_pickup')
    for update skip locked
  loop
    update public.orders set status = 'cancelled' where id = o.id;
    if o.status = 'ready_for_pickup' then
      select preorder_penalty, org_name into fee, shop from public.seller_profiles where id = o.seller_id;
      if coalesce(fee, 0) > 0 then
        insert into public.buyer_penalties (buyer_id, store_id, order_id, amount)
        values (o.buyer_id, o.seller_id, o.id, fee)
        on conflict (order_id) do nothing;
        perform public.notify_user(o.buyer_id, 'order', 'Pre-order not picked up',
          format('Your pre-order from %s was discarded and a ₱%s penalty was added. Pay it to order from this shop again.', coalesce(shop, 'the shop'), fee),
          '/marketplace/account#penalties');
      end if;
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;
grant execute on function public.expire_overdue_preorders() to authenticated;

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

notify pgrst, 'reload schema';

-- Check
select (select count(*) from public.buyer_penalties) as penalties,
       (select count(*) from public.orders where pickup_date is not null) as preorders_with_pickup_date,
       exists (select 1 from storage.buckets where id = 'preorder-ids') as id_bucket;
