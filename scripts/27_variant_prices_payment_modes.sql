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
