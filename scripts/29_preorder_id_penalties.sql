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
alter table public.orders add column if not exists is_preorder boolean not null default false;
alter table public.orders add column if not exists payment_plan text;
alter table public.orders drop constraint if exists orders_payment_plan_check;
alter table public.orders add constraint orders_payment_plan_check
  check (payment_plan is null or payment_plan in ('full', 'half')) not valid;
update public.orders set is_preorder = true where not is_preorder and (pickup_date is not null or buyer_id_path is not null);
create index if not exists orders_preorder_idx on public.orders(seller_id, created_at) where is_preorder;

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
  if new.status in ('cancelled', 'refunded') and old.status not in ('cancelled', 'refunded') then
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
      when 'paid' then case when new.is_preorder then 'Payment received for your pre-order' else 'Payment confirmed — your items are being prepared' end
      when 'partially_paid' then 'Partial payment received'
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

-- ── Pre-order completion forms (made by the shop) ─────────────────────────
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
