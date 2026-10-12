-- ============================================================
-- UniMerch — speed-up (indexes, faster row-level security) + royalty remittance
-- Run in Supabase SQL Editor AFTER 31_supply_office_branches.sql. Paste and run the WHOLE file. Safe to re-run.
-- Nothing is deleted. Section 3 adds the royalty remittance feature (see its notes); the rest only adds
-- indexes and rewrites how the security policies are evaluated (same rules, same results).
--
-- 1. Indexes for the queries the app runs most (marketplace listing, order lines, banners, chats).
--    order_items had none at all, yet every order permission check looks rows up by order_id.
-- 2. Security policies called functions such as auth.uid(), module_access('bao') and
--    store_access(seller_id) once PER ROW. On the products table every marketplace page ran a
--    dashboard lookup for every product. The policies are rewritten so each check runs ONCE per
--    query (Supabase advisor lint 0003 "auth_rls_initplan"):
--      auth.uid()                     → (select auth.uid())
--      is_staff() / is_admin() / …    → (select public.is_staff())
--      module_access('bao')           → (select public.module_access('bao'))
--      store_access(seller_id, 'x')   → seller_id in (select public.my_store_ids('x'))
--
-- If you re-run an older script that recreates policies, run this one again afterwards.
-- ============================================================

-- ── 1. Indexes ───────────────────────────────────────────────

-- Marketplace home, search and category pages: newest approved products
create index if not exists products_approved_created_idx on public.products (created_at desc) where status = 'approved';
create index if not exists products_approved_category_idx on public.products (category, created_at desc) where status = 'approved';

-- Order lines: permission checks (by order), store dashboards (by store), product history
create index if not exists order_items_order_idx   on public.order_items (order_id);
create index if not exists order_items_seller_idx  on public.order_items (seller_id);
create index if not exists order_items_product_idx on public.order_items (product_id);

-- "Near me" campus filter, banners per store, product chat, dashboards by module
create index if not exists seller_profiles_campus_idx  on public.seller_profiles (campus);
create index if not exists store_banners_seller_idx    on public.store_banners (seller_id);
create index if not exists product_messages_product_idx on public.product_messages (product_id, created_at);
create index if not exists dashboards_module_idx       on public.dashboards (module);
create index if not exists dashboard_members_dashboard_idx on public.dashboard_members (dashboard_id);

-- ── 2. Helper: the signed-in user's stores (used by the policies below) ──

-- The stores the signed-in user may act for (optionally: with permission p_perm).
-- Same rule as store_access(), but returned as one list so a policy can check it once per query.
create or replace function public.my_store_ids(p_perm text default null)
returns setof uuid language sql security definer set search_path = public stable as $$
  select d.store_id
  from public.dashboards d
  join public.dashboard_members m on m.dashboard_id = d.id
  where m.user_id = auth.uid() and d.store_id is not null
    and (m.is_main or p_perm is null or p_perm = any(m.permissions));
$$;

-- ── 3. Royalty: remittance to BAO, rate changes, Supply Office collaborations ──
--
-- How royalty works: BAO sets one rate (bao_settings.global_royalty_percentage). A product with the
-- official university logo carries that rate; buyers pay the listed price and, per unit sold,
-- round(price × rate ÷ 100, 2) goes to BAO (taken from the store's earnings).
--   • Each royalty sale line records its rate and the store that OWES it (royalty_store_id): the
--     selling store, or the Main Supply Office for products made in collaboration with it.
--   • A store remits the royalty of its PAID sales (paid / ready for pickup / completed) with a
--     receipt; BAO approves (those sales leave the balance, which resets) or rejects (they return).
--   • When BAO changes the rate, every logo listing and every sale not yet remitted moves to the
--     new rate. Sales inside a remittance (waiting or approved) keep the rate they were remitted at.

-- Products made with the Main Supply Office: the Supply Office pays the royalty, not the seller
alter table public.products add column if not exists supply_office_collab boolean not null default false;

create table if not exists public.royalty_remittances (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references public.seller_profiles(id) on delete cascade,  -- the paying store
  amount           numeric(12,2) not null default 0,
  items_count      integer not null default 0,
  period_start     timestamptz,                         -- first and last sale included
  period_end       timestamptz,
  breakdown        jsonb not null default '[]'::jsonb,  -- per product and rate: product, rate, items, gross, royalty, collab, store
  method           text not null check (method in ('gcash','bank')),
  receipt_url      text not null,
  reference_number text,
  notes            text,
  status           text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_by     uuid references auth.users(id) on delete set null,
  reviewed_by      uuid references auth.users(id) on delete set null,
  reviewed_at      timestamptz,
  bao_note         text,
  created_at       timestamptz not null default now()
);
create index if not exists royalty_remittances_store_idx  on public.royalty_remittances (store_id, created_at desc);
create index if not exists royalty_remittances_status_idx on public.royalty_remittances (status, created_at desc);
-- At most one remittance waiting for BAO per store
create unique index if not exists royalty_remittances_one_pending on public.royalty_remittances (store_id) where status = 'pending';

alter table public.royalty_remittances enable row level security;
-- Read only: remittances are created and reviewed through the functions below
drop policy if exists "stores read own remittances" on public.royalty_remittances;
create policy "stores read own remittances" on public.royalty_remittances
  for select using (store_id in (select public.my_store_ids()));
drop policy if exists "bao reads remittances" on public.royalty_remittances;
create policy "bao reads remittances" on public.royalty_remittances
  for select using ((select public.module_access('bao')));

-- Sale lines: the rate used, the store that owes the royalty, the remittance that paid it
alter table public.order_items add column if not exists royalty_percentage numeric(5,2);
alter table public.order_items add column if not exists royalty_store_id   uuid;
alter table public.order_items add column if not exists remittance_id      uuid references public.royalty_remittances(id) on delete set null;
create index if not exists order_items_royalty_open_idx on public.order_items (royalty_store_id) where remittance_id is null;
create index if not exists order_items_remittance_idx   on public.order_items (remittance_id);

-- Past royalty sales: owed by the store that sold them, at the rate they were recorded with
update public.order_items oi set
  royalty_store_id   = oi.seller_id,
  royalty_percentage = coalesce(
    (select p.royalty_percentage from public.products p where p.id = oi.product_id and p.is_royalty_product),
    round(oi.royalty_amount * 100 / nullif(oi.unit_price, 0), 2))
where oi.royalty_amount > 0 and oi.royalty_store_id is null;

-- Product royalty fields always follow price and rate (also when size prices change)
create or replace function public.products_royalty_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_royalty_product then
    new.royalty_amount := round(coalesce(new.price, 0) * coalesce(new.royalty_percentage, 0) / 100, 2);
    -- Collaboration: the Supply Office pays the royalty, so the seller receives the full price
    new.final_price := new.price - case when new.supply_office_collab then 0 else new.royalty_amount end;
  else
    new.royalty_amount := 0;
    new.final_price := new.price;
  end if;
  return new;
end;
$$;
drop trigger if exists products_royalty_fields on public.products;
create trigger products_royalty_fields
  before insert or update of price, royalty_percentage, is_royalty_product, supply_office_collab on public.products
  for each row execute procedure public.products_royalty_fields();

-- Each new sale line of a logo product: record its rate and who owes the royalty
create or replace function public.order_items_royalty_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  new.remittance_id := null;  -- only submit_royalty_remittance() attaches lines to a remittance
  select is_royalty_product, royalty_percentage, supply_office_collab into p
  from public.products where id = new.product_id;
  if coalesce(p.is_royalty_product, false) then
    new.royalty_percentage := p.royalty_percentage;
    new.royalty_store_id := new.seller_id;
    if p.supply_office_collab then
      new.royalty_store_id := coalesce(
        (select store_id from public.dashboards where module = 'supply_office' and store_id is not null limit 1),
        new.seller_id);
    end if;
  else
    new.royalty_store_id := null;
  end if;
  return new;
end;
$$;
drop trigger if exists order_items_royalty_owner on public.order_items;
create trigger order_items_royalty_owner before insert on public.order_items
  for each row execute procedure public.order_items_royalty_owner();

-- BAO changes the rate → every logo listing and every sale not yet remitted uses the new rate
create or replace function public.apply_royalty_rate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.global_royalty_percentage is distinct from old.global_royalty_percentage then
    update public.products set royalty_percentage = new.global_royalty_percentage
    where is_royalty_product and royalty_percentage is distinct from new.global_royalty_percentage;

    update public.order_items set
      royalty_percentage = new.global_royalty_percentage,
      royalty_amount     = round(unit_price * new.global_royalty_percentage / 100, 2)
    where royalty_store_id is not null and remittance_id is null;
  end if;
  return new;
end;
$$;
drop trigger if exists apply_royalty_rate on public.bao_settings;
create trigger apply_royalty_rate after update on public.bao_settings
  for each row execute procedure public.apply_royalty_rate();

-- A store's royalty sales that are not remitted yet (or waiting in its pending remittance).
-- A function because the Supply Office owes royalty on other stores' orders, which it can't read.
create or replace function public.royalty_lines(p_store uuid)
returns table (
  item_id uuid, order_id uuid, ordered_at timestamptz, order_status text, product_name text,
  quantity integer, unit_price numeric, royalty_percentage numeric, royalty_amount numeric,
  origin_store uuid, origin_name text, collab boolean, remittance_id uuid
)
language plpgsql security definer set search_path = public stable as $$
#variable_conflict use_column
begin
  if not public.store_access(p_store, 'reports') then
    raise exception 'You don''t have access to this store''s royalty.';
  end if;
  return query
    select oi.id, oi.order_id, o.created_at, o.status, oi.product_name,
           oi.quantity, oi.unit_price, oi.royalty_percentage, oi.royalty_amount,
           oi.seller_id, sp.org_name, oi.royalty_store_id is distinct from oi.seller_id, oi.remittance_id
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    left join public.seller_profiles sp on sp.id = oi.seller_id
    left join public.royalty_remittances r on r.id = oi.remittance_id
    where oi.royalty_store_id = p_store
      and o.status <> 'cancelled'
      and (oi.remittance_id is null or r.status = 'pending')
    order by o.created_at desc;
end;
$$;

-- A store remits the royalty of all its paid, not-yet-remitted sales (amount computed here, never sent)
create or replace function public.submit_royalty_remittance(
  p_store uuid, p_method text, p_receipt_url text, p_reference text default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  rid uuid;
  total numeric;
  n integer;
  first_at timestamptz;
  last_at timestamptz;
  parts jsonb;
  bao uuid;
  store_name text;
begin
  if not public.store_access(p_store, 'reports') then
    raise exception 'You don''t have access to this store''s royalty.';
  end if;
  if p_method not in ('gcash', 'bank') then raise exception 'Choose GCash or bank transfer.'; end if;
  if coalesce(trim(p_receipt_url), '') = '' then raise exception 'Upload the payment receipt.'; end if;
  if exists (select 1 from public.royalty_remittances where store_id = p_store and status = 'pending') then
    raise exception 'A remittance is already waiting for BAO''s review.';
  end if;

  insert into public.royalty_remittances (store_id, method, receipt_url, reference_number, notes, submitted_by)
  values (p_store, p_method, trim(p_receipt_url), nullif(trim(p_reference), ''), nullif(trim(p_notes), ''), auth.uid())
  returning id into rid;

  update public.order_items oi set remittance_id = rid
  from public.orders o
  where o.id = oi.order_id
    and oi.royalty_store_id = p_store and oi.remittance_id is null
    and o.status in ('paid', 'ready_for_pickup', 'completed');

  select coalesce(sum(oi.royalty_amount * oi.quantity), 0), count(*), min(o.created_at), max(o.created_at)
  into total, n, first_at, last_at
  from public.order_items oi join public.orders o on o.id = oi.order_id
  where oi.remittance_id = rid;
  if n = 0 or total <= 0 then
    raise exception 'There is no royalty from paid sales to remit yet.';
  end if;

  select coalesce(jsonb_agg(x.b order by x.b->>'product', (x.b->>'rate')::numeric), '[]'::jsonb) into parts
  from (
    select jsonb_build_object(
      'product', oi.product_name,
      'rate',    oi.royalty_percentage,
      'items',   sum(oi.quantity),
      'gross',   sum(oi.unit_price * oi.quantity),
      'royalty', sum(oi.royalty_amount * oi.quantity),
      'collab',  oi.royalty_store_id is distinct from oi.seller_id,
      'store',   max(sp.org_name)) as b
    from public.order_items oi
    left join public.seller_profiles sp on sp.id = oi.seller_id
    where oi.remittance_id = rid
    group by oi.product_name, oi.royalty_percentage, oi.seller_id, oi.royalty_store_id
  ) x;

  update public.royalty_remittances
  set amount = total, items_count = n, period_start = first_at, period_end = last_at, breakdown = parts
  where id = rid;

  select id into bao from public.dashboards where module = 'bao' limit 1;
  select org_name into store_name from public.seller_profiles where id = p_store;
  if bao is not null then
    perform public.notify_dashboard(bao, 'royalty', 'royalty', 'Royalty remittance to review',
      coalesce(store_name, 'A store') || ' remitted ₱' || to_char(total, 'FM999,999,990.00') || '.', '/bao/remittances');
  end if;
  return rid;
end;
$$;

-- BAO approves (the sales stay remitted: the store's balance resets) or rejects (they return to the balance)
create or replace function public.review_royalty_remittance(p_id uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  dash record;
begin
  if not public.module_access('bao', 'royalty') then raise exception 'Only BAO can review remittances.'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'Choose approve or reject.'; end if;

  update public.royalty_remittances
  set status = p_decision, bao_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id and status = 'pending'
  returning store_id, amount into r;
  if not found then raise exception 'This remittance was already reviewed.'; end if;

  if p_decision = 'rejected' then
    update public.order_items set remittance_id = null where remittance_id = p_id;
  end if;

  select * into dash from public.store_dashboard_path(r.store_id);
  if dash.dashboard_id is not null then
    perform public.notify_dashboard(dash.dashboard_id, 'reports', 'royalty',
      case p_decision when 'approved' then 'Royalty remittance approved' else 'Royalty remittance rejected' end,
      '₱' || to_char(r.amount, 'FM999,999,990.00') || coalesce(' — ' || nullif(trim(p_note), ''), ''),
      dash.base || '/royalty');
  end if;
end;
$$;

-- Product notifications (from 17_notifications.sql) + the Main Supply Office hears about
-- collaboration products the moment they go live
create or replace function public.notify_product_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  dash record;
  bao uuid;
  office uuid;
  store_name text;
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status = 'pending' then
      select id into bao from public.dashboards where module = 'bao';
      if bao is not null then
        perform public.notify_dashboard(bao, 'approvals', 'product', 'Product awaiting approval', new.name, '/bao/approvals');
      end if;
    elsif tg_op = 'UPDATE' and new.status in ('approved','rejected','pulled') then
      select * into dash from public.store_dashboard_path(new.seller_id);
      if dash.dashboard_id is not null then
        perform public.notify_dashboard(dash.dashboard_id, 'products', 'product',
          case new.status when 'approved' then 'Product approved — now live' when 'rejected' then 'Product rejected by BAO' else 'Product pulled out by BAO' end,
          new.name || coalesce(' — ' || new.bao_comment, ''), dash.base || '/products');
      end if;
      if new.status = 'approved' and new.supply_office_collab then
        select id into office from public.dashboards where module = 'supply_office' limit 1;
        select org_name into store_name from public.seller_profiles where id = new.seller_id;
        if office is not null then
          perform public.notify_dashboard(office, 'products', 'product', 'Collaboration product now live',
            new.name || ' by ' || coalesce(store_name, 'an organization') || ' — its royalty is paid by the Supply Office.',
            '/supply-office/royalty');
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists notify_product_events on public.products;
create trigger notify_product_events after insert or update of status on public.products
  for each row execute procedure public.notify_product_events();

-- ── 3b. Message a store without picking a product ─────────────
-- The storefront's "Contact Seller" button opens a general chat with the store (start_conversation
-- needs a product). One general conversation per buyer and store; products can be shared inside it.
create or replace function public.start_store_conversation(p_store uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  store_name text;
  conv uuid;
begin
  if me is null then raise exception 'Sign in to message the seller.'; end if;
  select coalesce(org_name, 'the seller') into store_name
  from public.seller_profiles where id = p_store and status = 'active';
  if store_name is null then raise exception 'This store is not available.'; end if;
  if public.store_access(p_store) then raise exception 'You can''t message your own store.'; end if;

  -- unique (buyer, store, product) doesn't match rows without a product, so look it up here
  select id into conv from public.conversations where buyer_id = me and seller_id = p_store and product_id is null;
  if conv is not null then return conv; end if;

  insert into public.conversations (buyer_id, seller_id, product_id, status)
  values (me, p_store, null, 'open')
  returning id into conv;

  insert into public.conversation_messages (conversation_id, kind, content, is_read)
  values (conv, 'system', 'You are now chatting with ' || store_name || '.', true);
  return conv;
end;
$$;
grant execute on function public.start_store_conversation(uuid) to authenticated;

-- ── 4. Faster security checks for every policy ───────────────

-- Rewrites one policy expression (temporary helper, gone when this run ends)
create or replace function pg_temp.fast_policy_expr(e text)
returns text language plpgsql immutable as $$
begin
  if e is null then return null; end if;

  -- auth.uid() / auth.role(): once per query (skip ones already wrapped in a SELECT)
  e := regexp_replace(e, '(?<!SELECT )auth\.(uid|role)\(\)', '(select auth.\1())', 'g');

  -- Helpers that only look at the signed-in user
  e := regexp_replace(e,
    '(?<!SELECT )(?<![[:alnum:]_.])(public\.)?(is_staff|is_admin|is_verification_admin|is_verification_main|account_in_good_standing)\(\)',
    '(select public.\2())', 'g');

  -- module_access('<module>'[, '<perm>']) with fixed arguments
  e := regexp_replace(e,
    '(?<!SELECT )(?<![[:alnum:]_.])(public\.)?module_access\((''[a-z_]+''::text(, (''[a-z_]+''|NULL)::text)?)\)',
    '(select public.module_access(\2))', 'g');

  -- store_access(<column>[, '<perm>']) → one list of the user's stores. Left alone under NOT,
  -- where "unknown" (a NULL column) would behave differently from false.
  if e !~* 'not\s+\(?\s*(public\.)?store_access' then
    e := regexp_replace(e,
      '(?<![[:alnum:]_.])(public\.)?store_access\(([a-z_][[:alnum:]_.]*)\)',
      '(\2 in (select public.my_store_ids()))', 'g');
    e := regexp_replace(e,
      '(?<![[:alnum:]_.])(public\.)?store_access\(([a-z_][[:alnum:]_.]*), (''[a-z_]+''::text)\)',
      '(\2 in (select public.my_store_ids(\3)))', 'g');
  end if;
  return e;
end;
$$;

do $$
declare
  p record;
  new_using text;
  new_check text;
  changed int := 0;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
  loop
    new_using := pg_temp.fast_policy_expr(p.qual);
    new_check := pg_temp.fast_policy_expr(p.with_check);
    if new_using is distinct from p.qual or new_check is distinct from p.with_check then
      begin
        if new_using is distinct from p.qual then
          execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, new_using);
        end if;
        if new_check is distinct from p.with_check then
          execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, new_check);
        end if;
        changed := changed + 1;
      exception when others then
        raise notice 'Skipped "%" on %.%: %', p.policyname, p.schemaname, p.tablename, sqlerrm;
      end;
    end if;
  end loop;
  raise notice 'Policies sped up: %', changed;
end $$;

-- Fresh planner statistics for the new indexes
analyze public.products;
analyze public.order_items;
analyze public.orders;
analyze public.seller_profiles;
analyze public.dashboards;
analyze public.dashboard_members;
analyze public.profiles;

notify pgrst, 'reload schema';

-- Check: policies that still run a check per row (should only list row-specific ones, such as
-- conversation_role(conversation_id) or viewer_role_allowed(allowed_roles))
select tablename, policyname, coalesce(qual, with_check) as rule
from pg_policies
where schemaname in ('public', 'storage')
  and (
    (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(?<!SELECT )auth\.uid\(\)'
    or (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(?<![[:alnum:]_.])(public\.)?store_access\([a-z_]'
  )
order by tablename, policyname;
