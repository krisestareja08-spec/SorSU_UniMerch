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
