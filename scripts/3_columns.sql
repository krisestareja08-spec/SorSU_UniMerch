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
  check (status in ('pending','paid','partially_paid','ready_for_pickup','completed','cancelled'));

-- Seller profile payment columns
alter table public.seller_profiles add column if not exists gcash_qr_url         text;
alter table public.seller_profiles add column if not exists bank_qr_url          text;
alter table public.seller_profiles add column if not exists bank_account_name    text;
alter table public.seller_profiles add column if not exists bank_account_number  text;
alter table public.seller_profiles add column if not exists gcash_number         text;
