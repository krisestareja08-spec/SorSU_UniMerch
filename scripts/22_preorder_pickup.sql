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
