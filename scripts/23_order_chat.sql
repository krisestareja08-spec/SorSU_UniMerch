-- ============================================================
-- UniMerch — Buyer ↔ seller chat on an order ("Chat with Seller")
-- Run in Supabase SQL Editor AFTER 22_preorder_pickup.sql. Paste and run the WHOLE file. Safe to re-run.
--
--   • order_messages — one conversation per order, between the buyer and the store's staff
--   • notifications  — a new message notifies the other side (bell icon)
-- ============================================================

create table if not exists public.order_messages (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  sender_id   uuid not null references auth.users(id) on delete cascade,
  from_store  boolean not null default false,   -- true when sent by the store's staff
  message     text not null check (length(trim(message)) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists order_messages_order_idx on public.order_messages(order_id, created_at);

alter table public.order_messages enable row level security;

drop policy if exists "order chat readers" on public.order_messages;
create policy "order chat readers" on public.order_messages for select using (
  exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid())
  or public.auth_seller_has_order(order_id)
);

-- Buyers post as themselves; store staff with the orders permission post as the store.
drop policy if exists "order chat senders" on public.order_messages;
create policy "order chat senders" on public.order_messages for insert with check (
  sender_id = auth.uid() and (
    (not from_store and exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid()))
    or (from_store and public.auth_seller_has_order(order_id))
  )
);

-- Live updates for open chat panels
do $$ begin
  alter publication supabase_realtime add table public.order_messages;
exception when duplicate_object or undefined_object then null; end $$;

-- ── Notifications ───────────────────────────────────────────────────────────
create or replace function public.notify_order_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  o record;
  dash record;
  code text := upper(left(new.order_id::text, 8));
  preview text := left(new.message, 120);
begin
  select id, buyer_id, seller_id into o from public.orders where id = new.order_id;
  if new.from_store then
    perform public.notify_user(o.buyer_id, 'message', 'New message from the seller', 'Order #' || code || ': ' || preview,
      '/marketplace/orders/' || new.order_id || '#chat');
  elsif o.seller_id is not null then
    select * into dash from public.store_dashboard_path(o.seller_id);
    if dash.dashboard_id is not null then
      perform public.notify_dashboard(dash.dashboard_id, 'orders', 'message', 'Buyer message on order #' || code, preview,
        dash.base || '/orders?chat=' || new.order_id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_order_message on public.order_messages;
create trigger notify_order_message after insert on public.order_messages for each row execute procedure public.notify_order_message();

notify pgrst, 'reload schema';
