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
