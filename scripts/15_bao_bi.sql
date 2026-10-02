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

notify pgrst, 'reload schema';
