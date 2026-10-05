-- ============================================================
-- UniMerch — Buyer ↔ seller messaging about a product ("Message Seller")
-- Run in Supabase SQL Editor AFTER 23_order_chat.sql. Paste and run the WHOLE file. Safe to re-run.
--
--   • conversations              — one per buyer + store + product; status open / pending / closed
--   • conversation_messages      — text, photo, product card (upsell) or system note; with read receipts
--   • notification_preferences   — per-user switches for order and message notifications
--   • chat-images bucket         — photos sent in chat
--
-- Lifecycle: buyer writes → pending (waiting for the store) · store replies → open ·
--            the buyer orders the product, either side closes it, or 14 days pass → closed.
--            Any new message reopens a closed conversation.
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.conversations (
  id               uuid primary key default gen_random_uuid(),
  buyer_id         uuid not null references public.profiles(id) on delete cascade,
  seller_id        uuid not null references public.seller_profiles(id) on delete cascade,  -- the store
  product_id       uuid references public.products(id) on delete set null,
  status           text not null default 'open' check (status in ('open','pending','closed')),
  closed_reason    text check (closed_reason in ('purchase','inactive','buyer','seller')),
  last_message     text,
  last_message_at  timestamptz not null default now(),
  last_from_store  boolean,
  created_at       timestamptz not null default now(),
  unique (buyer_id, seller_id, product_id)
);
create index if not exists conversations_buyer_idx on public.conversations(buyer_id, last_message_at desc);
create index if not exists conversations_seller_idx on public.conversations(seller_id, last_message_at desc);

create table if not exists public.conversation_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  sender_id        uuid references auth.users(id) on delete set null,     -- null for system notes
  from_store       boolean not null default false,
  kind             text not null default 'text' check (kind in ('text','image','product','system')),
  content          text check (content is null or length(content) <= 2000),
  image_url        text,
  product_id       uuid references public.products(id) on delete set null, -- product card (kind = 'product')
  is_read          boolean not null default false,
  created_at       timestamptz not null default now(),
  check (kind <> 'text'    or length(trim(coalesce(content, ''))) > 0),
  check (kind <> 'image'   or image_url is not null),
  check (kind <> 'product' or product_id is not null)
);
create index if not exists conversation_messages_conv_idx on public.conversation_messages(conversation_id, created_at);
create index if not exists conversation_messages_unread_idx on public.conversation_messages(conversation_id) where not is_read;

create table if not exists public.notification_preferences (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  order_updates  boolean not null default true,
  messages       boolean not null default true,
  updated_at     timestamptz not null default now()
);

-- Columns from 11_storefront.sql / 13_orders_pickup.sql that the inbox functions read (no-ops if present)
alter table public.seller_profiles add column if not exists logo_url text;
alter table public.orders add column if not exists seller_id uuid references public.seller_profiles(id) on delete set null;

-- ── Notifications inbox (also created by 17_notifications.sql; repeated so this file works on its own) ──
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null default 'info',
  title       text not null,
  body        text,
  href        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(user_id) where read_at is null;
alter table public.notifications enable row level security;

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications
  for select using (user_id = auth.uid());
drop policy if exists "users mark own notifications read" on public.notifications;
create policy "users mark own notifications read" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users delete own notifications" on public.notifications;
create policy "users delete own notifications" on public.notifications
  for delete using (user_id = auth.uid());

create or replace function public.store_dashboard_path(p_store uuid)
returns table (dashboard_id uuid, base text)
language sql security definer set search_path = public stable as $$
  select d.id, case d.module when 'cashier' then '/cashier' when 'supply_office' then '/supply-office' else '/seller' end
  from public.dashboards d where d.store_id = p_store limit 1;
$$;

-- ── Access helpers ──────────────────────────────────────────────────────────
-- 'buyer', 'store' (staff with the Messages permission) or null for the signed-in user.
create or replace function public.conversation_role(p_conv uuid)
returns text language sql security definer set search_path = public stable as $$
  select case
    when c.buyer_id = auth.uid() then 'buyer'
    when public.store_access(c.seller_id, 'messages') then 'store'
  end
  from public.conversations c where c.id = p_conv;
$$;

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.notification_preferences enable row level security;

-- Conversations are created and changed only through the functions below.
drop policy if exists "conversation participants read" on public.conversations;
create policy "conversation participants read" on public.conversations for select
  using (buyer_id = auth.uid() or public.store_access(seller_id, 'messages'));

drop policy if exists "conversation participants read messages" on public.conversation_messages;
create policy "conversation participants read messages" on public.conversation_messages for select
  using (public.conversation_role(conversation_id) is not null);

drop policy if exists "conversation participants send" on public.conversation_messages;
create policy "conversation participants send" on public.conversation_messages for insert with check (
  sender_id = auth.uid() and kind <> 'system' and not is_read and (
    (not from_store and public.conversation_role(conversation_id) = 'buyer')
    or (from_store and public.conversation_role(conversation_id) = 'store')
  )
);

drop policy if exists "users manage own notification preferences" on public.notification_preferences;
create policy "users manage own notification preferences" on public.notification_preferences for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Notification preferences (applied to every notification helper) ─────────
create or replace function public.wants_notification(p_user uuid, p_kind text)
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((
    select case p_kind when 'message' then np.messages when 'order' then np.order_updates else true end
    from public.notification_preferences np where np.user_id = p_user
  ), true);
$$;

create or replace function public.notify_user(p_user uuid, p_kind text, p_title text, p_body text, p_href text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, href)
  select p_user, p_kind, p_title, p_body, p_href
  where p_user is not null and p_user is distinct from auth.uid()   -- don't notify people about their own actions
    and public.wants_notification(p_user, p_kind);
$$;

create or replace function public.notify_dashboard(p_dashboard uuid, p_perm text, p_kind text, p_title text, p_body text, p_href text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, href)
  select m.user_id, p_kind, p_title, p_body, p_href
  from public.dashboard_members m
  where m.dashboard_id = p_dashboard
    and (m.is_main or p_perm is null or p_perm = any(m.permissions))
    and m.user_id is distinct from auth.uid()
    and public.wants_notification(m.user_id, p_kind);
$$;

-- ── Start (or reopen) a conversation from a product page ────────────────────
create or replace function public.start_conversation(p_product uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  prod record;
  store_name text;
  conv uuid;
begin
  if me is null then raise exception 'Sign in to message the seller.'; end if;
  select id, seller_id, name into prod from public.products where id = p_product and status = 'approved';
  if prod.id is null then raise exception 'This product is no longer available.'; end if;
  if public.store_access(prod.seller_id) then raise exception 'You can''t message your own store.'; end if;

  select id into conv from public.conversations where buyer_id = me and seller_id = prod.seller_id and product_id = p_product;
  if conv is not null then return conv; end if;

  select coalesce(org_name, 'the seller') into store_name from public.seller_profiles where id = prod.seller_id;
  insert into public.conversations (buyer_id, seller_id, product_id, status)
  values (me, prod.seller_id, p_product, 'open')
  on conflict (buyer_id, seller_id, product_id) do nothing
  returning id into conv;
  if conv is null then  -- created by a parallel request
    select id into conv from public.conversations where buyer_id = me and seller_id = prod.seller_id and product_id = p_product;
    return conv;
  end if;

  insert into public.conversation_messages (conversation_id, kind, content, is_read)
  values (conv, 'system', 'You are now discussing ' || prod.name || ' with ' || store_name || '.', true);
  return conv;
end;
$$;

-- Marks the other side's messages as read (read receipts).
create or replace function public.mark_conversation_read(p_conv uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r text := public.conversation_role(p_conv);
begin
  if r is null then return; end if;
  update public.conversation_messages
  set is_read = true
  where conversation_id = p_conv and not is_read and kind <> 'system' and from_store = (r = 'buyer');
end;
$$;

-- Either side can close or reopen a conversation.
create or replace function public.set_conversation_status(p_conv uuid, p_close boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  r text := public.conversation_role(p_conv);
begin
  if r is null then raise exception 'Conversation not found.'; end if;
  update public.conversations
  set status = case when p_close then 'closed' else 'open' end,
      closed_reason = case when p_close then case r when 'store' then 'seller' else 'buyer' end end
  where id = p_conv and (status = 'closed') is distinct from p_close;
  if found then
    insert into public.conversation_messages (conversation_id, kind, content, is_read)
    values (p_conv, 'system', 'Conversation ' || case when p_close then 'closed' else 'reopened' end
      || ' by the ' || case r when 'store' then 'seller' else 'buyer' end || '.', true);
  end if;
end;
$$;

-- Closes conversations with no messages for 14 days. Called when an inbox loads (and daily by pg_cron if available).
create or replace function public.close_inactive_conversations()
returns void language plpgsql security definer set search_path = public as $$
declare
  c record;
begin
  for c in
    update public.conversations set status = 'closed', closed_reason = 'inactive'
    where status <> 'closed' and last_message_at < now() - interval '14 days'
    returning id
  loop
    insert into public.conversation_messages (conversation_id, kind, content, is_read)
    values (c.id, 'system', 'Conversation closed after 14 days without messages.', true);
  end loop;
end;
$$;

do $$ begin
  perform cron.schedule('close-inactive-conversations', '0 3 * * *', 'select public.close_inactive_conversations()');
exception when others then null;  -- pg_cron not enabled: inboxes close stale conversations when they load
end $$;

-- ── Inbox + conversation details (also returns the other side's name, which RLS would hide) ──
create or replace function public.list_conversations(p_store uuid default null)
returns table (
  id uuid, status text, closed_reason text, last_message text, last_message_at timestamptz, last_from_store boolean,
  product_id uuid, product_name text, product_image text, product_price numeric,
  seller_id uuid, store_name text, store_logo text,
  buyer_id uuid, buyer_name text, unread integer
) language sql security definer set search_path = public stable as $$
  select c.id, c.status, c.closed_reason, c.last_message, c.last_message_at, c.last_from_store,
         p.id, p.name, p.image_url, p.price,
         c.seller_id, s.org_name, s.logo_url,
         c.buyer_id, coalesce(nullif(trim(b.full_name), ''), 'Buyer'),
         (select count(*)::int from public.conversation_messages m
          where m.conversation_id = c.id and not m.is_read and m.kind <> 'system'
            and m.from_store = (p_store is null))
  from public.conversations c
  left join public.products p on p.id = c.product_id
  left join public.seller_profiles s on s.id = c.seller_id
  left join public.profiles b on b.id = c.buyer_id
  where case when p_store is null then c.buyer_id = auth.uid()
             else c.seller_id = p_store and public.store_access(p_store, 'messages') end
  order by c.last_message_at desc
  limit 200;
$$;

create or replace function public.conversation_details(p_conv uuid)
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'id', c.id, 'status', c.status, 'closed_reason', c.closed_reason, 'role', public.conversation_role(c.id),
    'product', case when p.id is null then null else jsonb_build_object(
      'id', p.id, 'name', p.name, 'price', p.price, 'image_url', p.image_url, 'badge', p.badge,
      'stock', p.stock, 'variations', coalesce(to_jsonb(p.variations), '[]'::jsonb), 'available', p.status = 'approved') end,
    'store', jsonb_build_object('id', s.id, 'name', s.org_name, 'logo_url', s.logo_url),
    'buyer', jsonb_build_object('id', b.id, 'name', coalesce(nullif(trim(b.full_name), ''), 'Buyer'),
      'verified', b.is_identity_verified, 'affiliation', b.affiliation, 'campus', b.campus,
      'course', b.course, 'department', b.department,
      'orders_with_store', (select count(*) from public.orders o where o.buyer_id = b.id and o.seller_id = c.seller_id and o.status = 'completed'))
  )
  from public.conversations c
  left join public.products p on p.id = c.product_id
  left join public.seller_profiles s on s.id = c.seller_id
  left join public.profiles b on b.id = c.buyer_id
  where c.id = p_conv and public.conversation_role(c.id) is not null;
$$;

-- Total unread messages for the header badge (buyer side) or a store's inbox.
create or replace function public.unread_message_count(p_store uuid default null)
returns integer language sql security definer set search_path = public stable as $$
  select count(*)::int
  from public.conversation_messages m
  join public.conversations c on c.id = m.conversation_id
  where not m.is_read and m.kind <> 'system'
    and case when p_store is null then c.buyer_id = auth.uid() and m.from_store
             else c.seller_id = p_store and not m.from_store and public.store_access(p_store, 'messages') end;
$$;

-- ── On every message: validate, update the conversation, notify the other side ──
create or replace function public.before_conversation_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Product cards may only show the conversation store's own products
  if new.kind = 'product' and not exists (
    select 1 from public.products p join public.conversations c on c.seller_id = p.seller_id
    where p.id = new.product_id and c.id = new.conversation_id
  ) then
    raise exception 'You can only share your own store''s products.';
  end if;
  return new;
end;
$$;

drop trigger if exists before_conversation_message on public.conversation_messages;
create trigger before_conversation_message before insert on public.conversation_messages
  for each row execute procedure public.before_conversation_message();

create or replace function public.after_conversation_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c record;
  dash record;
  preview text;
  product_name text;
begin
  if new.kind = 'system' then return new; end if;
  select * into c from public.conversations where id = new.conversation_id;
  select name into product_name from public.products where id = c.product_id;
  preview := case new.kind when 'image' then '📷 Photo' when 'product' then '🛍️ Shared a product' else left(new.content, 120) end;

  update public.conversations
  set last_message = preview, last_message_at = new.created_at, last_from_store = new.from_store,
      status = case when new.from_store then 'open' else 'pending' end, closed_reason = null
  where id = new.conversation_id;

  -- One unread notification per conversation: replace the previous one instead of stacking them
  if new.from_store then
    delete from public.notifications
    where user_id = c.buyer_id and kind = 'message' and read_at is null and href = '/marketplace/messages?c=' || c.id;
    perform public.notify_user(c.buyer_id, 'message', 'New reply about ' || coalesce(product_name, 'your inquiry'), preview,
      '/marketplace/messages?c=' || c.id);
  else
    select * into dash from public.store_dashboard_path(c.seller_id);
    if dash.dashboard_id is not null then
      delete from public.notifications
      where kind = 'message' and read_at is null and href = dash.base || '/messages?c=' || c.id;
      perform public.notify_dashboard(dash.dashboard_id, 'messages', 'message', 'Buyer message about ' || coalesce(product_name, 'a product'), preview,
        dash.base || '/messages?c=' || c.id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists after_conversation_message on public.conversation_messages;
create trigger after_conversation_message after insert on public.conversation_messages
  for each row execute procedure public.after_conversation_message();

-- ── Close the conversation once the buyer orders the product ────────────────
create or replace function public.close_conversation_on_purchase()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c record;
begin
  for c in
    update public.conversations conv set status = 'closed', closed_reason = 'purchase'
    from public.orders o
    where o.id = new.order_id and conv.buyer_id = o.buyer_id and conv.product_id = new.product_id and conv.status <> 'closed'
    returning conv.id
  loop
    insert into public.conversation_messages (conversation_id, kind, content, is_read)
    values (c.id, 'system', 'Order #' || upper(left(new.order_id::text, 8)) || ' placed. Conversation closed. Send a message to reopen it.', true);
  end loop;
  return new;
end;
$$;

drop trigger if exists close_conversation_on_purchase on public.order_items;
create trigger close_conversation_on_purchase after insert on public.order_items
  for each row execute procedure public.close_conversation_on_purchase();

-- ── Realtime ────────────────────────────────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.conversations;
exception when duplicate_object or undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.conversation_messages;
exception when duplicate_object or undefined_object then null; end $$;

-- ── Photos sent in chat (namespaced by sender: "<user_id>/<file>") ───────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "users upload own chat images" on storage.objects;
create policy "users upload own chat images" on storage.objects for insert
  with check (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "chat images are public" on storage.objects;
create policy "chat images are public" on storage.objects for select using (bucket_id = 'chat-images');

notify pgrst, 'reload schema';
