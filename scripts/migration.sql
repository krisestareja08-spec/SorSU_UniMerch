-- ============================================================
-- UniMerch Database Schema Migration
-- Run this in Supabase Dashboard → SQL Editor
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

-- ── Product Messages (BAO ↔ Seller chat per product) ─────────
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

-- ── Storage Buckets ───────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('order-receipts', 'order-receipts', true)
on conflict (id) do nothing;

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

-- Orders
drop policy if exists "buyers insert orders"    on public.orders;
drop policy if exists "buyers read own orders"  on public.orders;
drop policy if exists "sellers read own orders" on public.orders;
drop policy if exists "sellers update their orders" on public.orders;

create policy "buyers insert orders"
  on public.orders for insert with check (auth.uid() = buyer_id);

create policy "buyers read own orders"
  on public.orders for select using (auth.uid() = buyer_id);

create policy "sellers read orders with their items"
  on public.orders for select
  using (exists (select 1 from public.order_items where order_id = id and seller_id = auth.uid()));

create policy "sellers update their orders"
  on public.orders for update
  using (exists (select 1 from public.order_items where order_id = id and seller_id = auth.uid()))
  with check (status in ('pending', 'paid', 'ready_for_pickup', 'completed', 'cancelled'));

-- Alter existing orders table status constraint if already created
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending','paid','ready_for_pickup','completed','cancelled'));

-- Add student_id column to profiles if not already present
alter table public.profiles add column if not exists student_employee_id text;
alter table public.profiles add column if not exists department text;
alter table public.profiles add column if not exists contact text;
alter table public.profiles add column if not exists birthday date;
alter table public.profiles add column if not exists avatar_url text;

-- Order items
drop policy if exists "insert order items for own order" on public.order_items;
drop policy if exists "read own order items"             on public.order_items;

create policy "insert order items for own order"
  on public.order_items for insert
  with check (exists (select 1 from public.orders where id = order_id and buyer_id = auth.uid()));

create policy "read own order items"
  on public.order_items for select
  using (
    exists (select 1 from public.orders where id = order_id and buyer_id = auth.uid())
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
drop policy if exists "seller updates own profile"         on public.seller_profiles;
drop policy if exists "admin inserts seller profiles" on public.seller_profiles;

create policy "anyone reads seller profiles"
  on public.seller_profiles for select using (true);

create policy "seller updates own profile"
  on public.seller_profiles for update using (auth.uid() = id);

create policy "admin inserts seller profiles"
  on public.seller_profiles for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin')));

-- Storage policies
drop policy if exists "authenticated can upload product images" on storage.objects;
drop policy if exists "product images are public"              on storage.objects;
drop policy if exists "authenticated can upload receipts"      on storage.objects;

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
