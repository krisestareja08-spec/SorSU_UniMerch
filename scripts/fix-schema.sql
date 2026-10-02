-- ============================================================
-- UniMerch — COMPLETE SCHEMA FIX
-- Run this whole file in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Safe to run multiple times (everything uses IF NOT EXISTS / IF EXISTS).
-- It repairs everything the previous partial setup missed:
--   • products:  images, variations, tags, sku columns
--   • orders:    reference_number, buyer_note, amount_paid columns
--                + 'partially_paid' added to allowed statuses
--   • creates missing tables: profiles, cart_items, product_messages,
--     seller_profiles (with RLS + policies)
--   • ensures RLS policies on products / orders / order_items
--   • ensures storage buckets: product-images, order-receipts
-- ============================================================

create extension if not exists pgcrypto;

-- ── 1. PROFILES ────────────────────────────────────────────────
create table if not exists public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  full_name            text,
  role                 text not null default 'buyer'
                       check (role in ('buyer','seller','bao','supply_office','admin')),
  affiliation          text not null default 'external'
                       check (affiliation in ('student','faculty','staff','alumni','external')),
  verification_status  text not null default 'unverified'
                       check (verification_status in ('unverified','pending','approved','rejected')),
  is_identity_verified boolean not null default false,
  student_employee_id  text,
  department           text,
  contact              text,
  birthday             date,
  avatar_url           text,
  created_at           timestamptz not null default now()
);

alter table public.profiles add column if not exists student_employee_id text;
alter table public.profiles add column if not exists department           text;
alter table public.profiles add column if not exists contact              text;
alter table public.profiles add column if not exists birthday             date;
alter table public.profiles add column if not exists avatar_url           text;

alter table public.profiles enable row level security;

-- Security-definer helper so staff policies don't recurse on profiles
create or replace function public.is_staff()
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','bao','supply_office')
  );
$$;

drop policy if exists "profiles select own or staff" on public.profiles;
create policy "profiles select own or staff"
  on public.profiles for select
  using (auth.uid() = id or public.is_staff());

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update
  using (auth.uid() = id);

-- Lets admin/bao accounts assign roles from the Admin > Users & roles panel
create or replace function public.is_admin()
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','bao')
  );
$$;

drop policy if exists "admins manage all profiles" on public.profiles;
create policy "admins manage all profiles"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- ── 2. PRODUCTS — extra columns ────────────────────────────────
alter table public.products add column if not exists images     text[] default ARRAY[]::text[];
alter table public.products add column if not exists variations jsonb  default '[]'::jsonb;
alter table public.products add column if not exists tags       text[] default ARRAY[]::text[];
alter table public.products add column if not exists sku        text;

-- ── 3. ORDERS — extra columns + status values ──────────────────
alter table public.orders add column if not exists reference_number text;
alter table public.orders add column if not exists buyer_note       text;
alter table public.orders add column if not exists amount_paid      numeric(10,2);

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending','paid','partially_paid','ready_for_pickup','completed','cancelled'));

-- ── 4. CART ITEMS ──────────────────────────────────────────────
create table if not exists public.cart_items (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  product_id uuid        not null references public.products(id) on delete cascade,
  quantity   integer     not null default 1 check (quantity > 0),
  variant    text,
  created_at timestamptz not null default now()
);

alter table public.cart_items enable row level security;

drop policy if exists "users manage own cart" on public.cart_items;
create policy "users manage own cart"
  on public.cart_items for all
  using (auth.uid() = user_id);

-- ── 5. PRODUCT MESSAGES (BAO ↔ Seller chat) ────────────────────
create table if not exists public.product_messages (
  id         uuid        primary key default gen_random_uuid(),
  product_id uuid        not null references public.products(id) on delete cascade,
  sender_id  uuid        not null references auth.users(id) on delete cascade,
  message    text        not null,
  created_at timestamptz not null default now()
);

alter table public.product_messages enable row level security;

drop policy if exists "product message readers" on public.product_messages;
create policy "product message readers"
  on public.product_messages for select
  using (
    auth.uid() = sender_id
    or exists (select 1 from public.products where id = product_id and seller_id = auth.uid())
    or public.is_staff()
  );

drop policy if exists "product message senders" on public.product_messages;
create policy "product message senders"
  on public.product_messages for insert
  with check (
    auth.uid() = sender_id and (
      exists (select 1 from public.products where id = product_id and seller_id = auth.uid())
      or public.is_staff()
    )
  );

-- ── 6. SELLER PROFILES ─────────────────────────────────────────
create table if not exists public.seller_profiles (
  id                  uuid        primary key references auth.users(id) on delete cascade,
  org_name            text        not null,
  description         text,
  category            text,
  gcash_number        text,
  gcash_qr_url        text,
  bank_qr_url         text,
  bank_account_name   text,
  bank_account_number text,
  created_by          uuid        references auth.users(id),
  status              text        not null default 'active'
                      check (status in ('active','suspended','pending')),
  created_at          timestamptz not null default now()
);

alter table public.seller_profiles enable row level security;

drop policy if exists "anyone reads seller profiles" on public.seller_profiles;
create policy "anyone reads seller profiles"
  on public.seller_profiles for select using (true);

drop policy if exists "seller updates own profile" on public.seller_profiles;
create policy "seller updates own profile"
  on public.seller_profiles for update using (auth.uid() = id);

drop policy if exists "admin inserts seller profiles" on public.seller_profiles;
create policy "admin inserts seller profiles"
  on public.seller_profiles for insert
  with check (public.is_staff());

-- ── 7. ORDER helpers + policies (re-create if missing) ─────────
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

-- ── 8. PRODUCTS policies (re-create if missing) ────────────────
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
  using (public.is_staff());

-- ── 9. ORDERS policies (re-create if missing) ──────────────────
drop policy if exists "buyers insert orders"                 on public.orders;
drop policy if exists "buyers read own orders"               on public.orders;
drop policy if exists "sellers read orders with their items" on public.orders;
drop policy if exists "sellers update their orders"          on public.orders;

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

-- ── 10. ORDER ITEMS policies (re-create if missing) ────────────
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

-- ── 11. STORAGE buckets + policies ─────────────────────────────
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('order-receipts', 'order-receipts', true)
on conflict (id) do nothing;

drop policy if exists "authenticated can upload product images" on storage.objects;
drop policy if exists "product images are public"               on storage.objects;
drop policy if exists "authenticated can upload receipts"       on storage.objects;
drop policy if exists "receipts are public"                     on storage.objects;

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

-- ============================================================
-- Done. Re-test: seller → Add Product should now save correctly.
-- ============================================================