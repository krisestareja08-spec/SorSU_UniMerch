-- ============================================================
-- UniMerch — Which setup scripts has this database run?  (READ-ONLY: changes nothing)
-- Paste into the Supabase SQL Editor and click Run. Every row marked "MISSING" names the
-- script to run next (in number order). Scripts 6, 14, 16 and 20 are one-off data fixes and
-- aren't listed.
-- ============================================================

with checks(script, what, applied) as (values
  ('1_tables.sql',                   'orders / order_items / products tables',
     to_regclass('public.orders') is not null and to_regclass('public.products') is not null),
  ('2_storage.sql',                  'product-images + order-receipts buckets',
     (select count(*) = 2 from storage.buckets where id in ('product-images', 'order-receipts'))),
  ('3_columns.sql',                  'orders.amount_paid',
     exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'amount_paid')),
  ('4_verification_admin.sql',       'verification_requests table',
     to_regclass('public.verification_requests') is not null),
  ('5_seller_ecosystem.sql',         'products.has_logo',
     exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'has_logo')),
  ('8_verification_storage.sql',     'verification-docs bucket',
     exists (select 1 from storage.buckets where id = 'verification-docs')),
  ('9_admin_modules.sql',            'guard_profile_insert()',
     to_regprocedure('public.guard_profile_insert()') is not null),
  ('10_dashboards.sql',              'dashboards / dashboard_members tables',
     to_regclass('public.dashboards') is not null and to_regclass('public.dashboard_members') is not null),
  ('11_storefront.sql',              'seller_profiles.theme',
     exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'seller_profiles' and column_name = 'theme')),
  ('12_profile_rules.sql',           'profiles.course',
     exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'course')),
  ('13_orders_pickup.sql',           'orders.pickup_location',
     exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'pickup_location')),
  ('15_bao_bi.sql',                  'order_items.royalty_amount + sales_reports',
     exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_items' and column_name = 'royalty_amount')
     and to_regclass('public.sales_reports') is not null),
  ('17_notifications.sql',           'notifications table',
     to_regclass('public.notifications') is not null),
  ('18_store_violations.sql',        'store_violations table',
     to_regclass('public.store_violations') is not null),
  ('19_cashier_branches.sql',        'dashboards.scope',
     exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'dashboards' and column_name = 'scope')),
  ('21_delete_user.sql',             'no person-reference blocks deleting a user',
     not exists (select 1 from pg_constraint where contype = 'f' and confdeltype = 'a'
                 and confrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
                 and conrelid::regclass::text <> 'public.profiles')),
  ('22_preorder_pickup.sql',         'seller_profiles.claim_window_days',
     exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'seller_profiles' and column_name = 'claim_window_days')),
  ('23_order_chat.sql',              'order_messages table',
     to_regclass('public.order_messages') is not null),
  ('24_product_chat.sql',            'conversations table + chat-images bucket',
     to_regclass('public.conversations') is not null and exists (select 1 from storage.buckets where id = 'chat-images')),
  ('25_phone_verification.sql',      'profiles.contact_verified',
     exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'contact_verified')),
  ('26_reviews_banners_cart.sql',    'product_reviews / store_banners / user_carts',
     to_regclass('public.product_reviews') is not null and to_regclass('public.store_banners') is not null and to_regclass('public.user_carts') is not null),
  ('27_variant_prices_payment_modes.sql', 'products.variant_prices + payment_modes',
     exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'variant_prices')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'payment_modes')),
  ('28_product_variants.sql',       'product_variants table + order_items.variant_id',
     to_regclass('public.product_variants') is not null
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_items' and column_name = 'variant_id'))
)
select script,
       case when applied then 'ok' else 'MISSING' end as status,
       what as checks_for
from checks
order by applied, nullif(regexp_replace(script, '\D.*$', ''), '')::int;
