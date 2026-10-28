-- ============================================================
-- UniMerch — Cashier branches are renamed "Supply Office" branches
-- Run in Supabase SQL Editor AFTER 30_guest_restriction.sql. Paste and run the WHOLE file. Safe to re-run.
--
-- Display names only: "Cashier — Bulan Campus" → "Supply Office — Bulan Campus", and the branch
-- stores "University Cashier — …" → "University Supply Office — …". Features are unchanged, and
-- the internal module key stays 'cashier'.
-- ============================================================

-- Branch dashboards
update public.dashboards
set name = replace(name, 'Cashier', 'Supply Office')
where module = 'cashier' and name like '%Cashier%';

-- Branch stores (storefront name, category, description)
update public.seller_profiles sp
set org_name    = replace(replace(sp.org_name, 'University Cashier', 'University Supply Office'), 'Cashier', 'Supply Office'),
    category    = case when sp.category = 'University Cashier' then 'University Supply Office' else sp.category end,
    description = case when sp.description = 'Official university cashier store' then 'Official university supply office store' else sp.description end
from public.dashboards d
where d.module = 'cashier' and d.store_id = sp.id
  and (sp.org_name like '%Cashier%' or sp.category = 'University Cashier' or sp.description = 'Official university cashier store');

-- New branches get a "University Supply Office" store
create or replace function public.ensure_dashboard_store()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.module in ('seller','cashier') and new.store_id is null then
    insert into public.seller_profiles (org_name, status, created_by, campus, category)
    values (new.name, 'active', auth.uid(), new.campus, case when new.module = 'cashier' then 'University Supply Office' end)
    returning id into new.store_id;
  end if;
  return new;
end;
$$;

-- ── Branches are supplied by the Main Supply Office ───────────────────────
-- Branches sell. The Main Supply Office adds their stock (restock requests, or directly) and takes
-- back damaged / defective items (return reports). Royalty on branch sales is owed by the Main
-- office (scripts/32). Branches can't add stock themselves (app/store-actions.ts).
create table if not exists public.branch_stock_requests (
  id                 uuid primary key default gen_random_uuid(),
  branch_store_id    uuid not null references public.seller_profiles(id) on delete cascade,
  kind               text not null check (kind in ('restock', 'return')),
  product_id         uuid references public.products(id) on delete set null,
  variant_id         uuid references public.product_variants(id) on delete set null,
  product_name       text not null default '',
  quantity           integer not null check (quantity > 0),
  reason             text check (reason is null or reason in ('damaged', 'defective', 'other')),
  note               text,
  photo_url          text,
  status             text not null default 'pending' check (status in ('pending', 'fulfilled', 'partial', 'approved', 'declined')),
  fulfilled_quantity integer,
  main_note          text,
  created_by         uuid default auth.uid() references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  reviewed_by        uuid references auth.users(id) on delete set null,
  reviewed_at        timestamptz
);
-- The product's photo, so both sides recognise the item at a glance
alter table public.branch_stock_requests add column if not exists product_image_url text;
create index if not exists branch_stock_requests_store_idx on public.branch_stock_requests(branch_store_id, created_at desc);
create index if not exists branch_stock_requests_pending_idx on public.branch_stock_requests(created_at) where status = 'pending';

alter table public.branch_stock_requests enable row level security;
drop policy if exists "branch and main office read stock requests" on public.branch_stock_requests;
create policy "branch and main office read stock requests" on public.branch_stock_requests for select
  using (public.store_access(branch_store_id, 'inventory') or public.module_access('supply_office', 'inventory'));
drop policy if exists "branches send stock requests" on public.branch_stock_requests;
create policy "branches send stock requests" on public.branch_stock_requests for insert
  with check (public.store_access(branch_store_id, 'inventory') and status = 'pending');
drop policy if exists "branches withdraw pending requests" on public.branch_stock_requests;
create policy "branches withdraw pending requests" on public.branch_stock_requests for delete
  using (public.store_access(branch_store_id, 'inventory') and status = 'pending');

-- A new request: checked against the branch's own product, named, and sent to the Main office
create or replace function public.branch_request_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pname text;
  vname text;
  vstock integer;
  pstock integer;
  pimg text;
  vimg text;
  office record;
begin
  if not exists (select 1 from public.dashboards where store_id = new.branch_store_id and module = 'cashier') then
    raise exception 'Only Supply Office branches send stock requests.';
  end if;
  select name, stock, image_url into pname, pstock, pimg from public.products where id = new.product_id and seller_id = new.branch_store_id;
  if pname is null then raise exception 'Choose one of your branch''s products.'; end if;
  if new.variant_id is not null then
    select name, stock, image_url into vname, vstock, vimg from public.product_variants where id = new.variant_id and product_id = new.product_id;
    if vname is null then raise exception 'That size was not found.'; end if;
  end if;
  if new.kind = 'return' then
    if new.reason is null then raise exception 'Choose why the items go back: damaged, defective or other.'; end if;
    if new.quantity > coalesce(vstock, pstock, 0) then
      raise exception 'Only % in stock — you can''t return %.', coalesce(vstock, pstock, 0), new.quantity;
    end if;
  else
    new.reason := null;
  end if;
  new.product_name := pname || coalesce(' (' || vname || ')', '');
  new.product_image_url := coalesce(vimg, pimg);
  new.status := 'pending';
  new.created_by := auth.uid();

  select d.id into office from public.dashboards d where d.module = 'supply_office' limit 1;
  if office.id is not null then
    perform public.notify_dashboard(office.id, 'inventory', 'inventory',
      case new.kind when 'restock' then 'Restock request' else 'Damaged / defective items reported' end,
      coalesce((select org_name from public.seller_profiles where id = new.branch_store_id), 'A branch') || ': '
        || new.quantity || ' × ' || new.product_name,
      '/supply-office/branch-inventory');
  end if;
  return new;
end;
$$;
drop trigger if exists branch_request_rules on public.branch_stock_requests;
create trigger branch_request_rules before insert on public.branch_stock_requests
  for each row execute procedure public.branch_request_rules();
update public.branch_stock_requests r
set product_image_url = coalesce((select image_url from public.product_variants where id = r.variant_id),
                                 (select image_url from public.products where id = r.product_id))
where r.product_image_url is null;

-- Stock change on a branch product / size, recorded as an inventory movement
create or replace function public.branch_stock_change(p_store uuid, p_product uuid, p_variant uuid, p_delta integer, p_reason text, p_note text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  label text;
  after_stock integer;
  now_stock integer;
begin
  select coalesce((select stock from public.product_variants where id = p_variant and product_id = p_product),
                  (select stock from public.products where id = p_product and seller_id = p_store))
    into now_stock;
  if now_stock is null then raise exception 'That product was not found in the branch.'; end if;
  if now_stock + p_delta < 0 then raise exception 'Only % in stock.', now_stock; end if;
  if p_variant is not null then
    update public.product_variants v set stock = v.stock + p_delta, updated_at = now()
    where v.id = p_variant and v.product_id = p_product returning v.stock into after_stock;
    select p.name || ' (' || v.name || ')' into label from public.products p join public.product_variants v on v.product_id = p.id where v.id = p_variant;
  else
    update public.products p set stock = p.stock + p_delta, updated_at = now()
    where p.id = p_product and p.seller_id = p_store returning p.stock into after_stock;
    select name into label from public.products where id = p_product;
  end if;
  insert into public.inventory_movements (store_id, product_id, variant_id, product_name, change, reason, note, created_by)
  values (p_store, p_product, p_variant, label, p_delta, p_reason, p_note, auth.uid());
  return after_stock;
end;
$$;
revoke all on function public.branch_stock_change(uuid, uuid, uuid, integer, text, text) from public, anon, authenticated;

-- The Main office fulfils / declines a restock, or approves / declines a return
create or replace function public.review_branch_request(p_id uuid, p_decision text, p_quantity integer default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.branch_stock_requests;
  qty integer;
  current_stock integer;
  dash uuid;
  title text;
begin
  if not public.module_access('supply_office', 'inventory') then
    raise exception 'Only the Main Supply Office reviews branch requests.';
  end if;
  select * into r from public.branch_stock_requests where id = p_id and status = 'pending' for update;
  if not found then raise exception 'This request was already reviewed.'; end if;

  if p_decision = 'decline' then
    update public.branch_stock_requests set status = 'declined', main_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
    title := case r.kind when 'restock' then 'Restock request declined' else 'Return report declined' end;
  elsif r.kind = 'restock' and p_decision = 'fulfil' then
    qty := coalesce(p_quantity, r.quantity);
    if qty < 1 then raise exception 'Enter how many units you''re sending.'; end if;
    perform public.branch_stock_change(r.branch_store_id, r.product_id, r.variant_id, qty, 'restock',
      'From Main Supply Office' || coalesce(': ' || nullif(trim(p_note), ''), ''));
    update public.branch_stock_requests
    set status = case when qty >= r.quantity then 'fulfilled' else 'partial' end, fulfilled_quantity = qty,
        main_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_id;
    title := 'Restock sent: ' || qty || ' × ' || r.product_name;
  elsif r.kind = 'return' and p_decision = 'approve' then
    select coalesce((select stock from public.product_variants where id = r.variant_id), (select stock from public.products where id = r.product_id), 0)
      into current_stock;
    qty := least(coalesce(p_quantity, r.quantity), current_stock);
    if qty > 0 then
      perform public.branch_stock_change(r.branch_store_id, r.product_id, r.variant_id, -qty, 'adjustment',
        'Returned to Main Supply Office: ' || r.reason || coalesce(' — ' || nullif(trim(r.note), ''), ''));
    end if;
    update public.branch_stock_requests
    set status = 'approved', fulfilled_quantity = qty, main_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_id;
    title := 'Return approved: ' || qty || ' × ' || r.product_name;
  else
    raise exception 'Choose fulfil or decline for restocks, approve or decline for returns.';
  end if;

  select id into dash from public.dashboards where store_id = r.branch_store_id and module = 'cashier' limit 1;
  if dash is not null then
    perform public.notify_dashboard(dash, 'inventory', 'inventory', title, coalesce(nullif(trim(p_note), ''), r.product_name), '/cashier/inventory');
  end if;
end;
$$;
grant execute on function public.review_branch_request(uuid, text, integer, text) to authenticated;

-- The Main office adds to, removes from or counts a branch's stock directly
create or replace function public.main_adjust_branch_stock(p_store uuid, p_product uuid, p_variant uuid, p_mode text, p_quantity integer, p_note text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  before_stock integer;
  delta integer;
begin
  if not public.module_access('supply_office', 'inventory') then raise exception 'Only the Main Supply Office manages branch stock.'; end if;
  if not exists (select 1 from public.dashboards where store_id = p_store and module = 'cashier') then raise exception 'That store is not a Supply Office branch.'; end if;
  if not exists (select 1 from public.products where id = p_product and seller_id = p_store) then raise exception 'That product is not in this branch.'; end if;
  select coalesce((select stock from public.product_variants where id = p_variant and product_id = p_product), (select stock from public.products where id = p_product))
    into before_stock;
  delta := case p_mode when 'add' then p_quantity when 'remove' then -p_quantity when 'set' then p_quantity - before_stock end;
  if delta is null then raise exception 'Choose add, remove or set.'; end if;
  if p_quantity < 0 or (p_mode <> 'set' and p_quantity < 1) then raise exception 'Enter a valid number of units.'; end if;
  if delta = 0 then return before_stock; end if;
  return public.branch_stock_change(p_store, p_product, p_variant, delta,
    case when p_mode = 'add' then 'restock' else 'adjustment' end,
    coalesce(nullif(trim(p_note), ''), case p_mode when 'add' then 'Added by Main Supply Office' when 'set' then 'Stock count by Main Supply Office' else 'Removed by Main Supply Office' end));
end;
$$;
grant execute on function public.main_adjust_branch_stock(uuid, uuid, uuid, text, integer, text) to authenticated;

-- What the Main office sees of its branches: the branches, and each branch's products and sizes
create or replace function public.supply_branches()
returns table (store_id uuid, name text, campus text)
language sql security definer set search_path = public stable as $$
  select d.store_id, d.name, d.campus from public.dashboards d
  where d.module = 'cashier' and d.store_id is not null and public.module_access('supply_office', 'inventory')
  order by d.name;
$$;
grant execute on function public.supply_branches() to authenticated;

create or replace function public.branch_inventory(p_store uuid)
returns table (product_id uuid, product_name text, image_url text, product_status text, product_stock integer,
               variant_id uuid, variant_name text, variant_stock integer)
language sql security definer set search_path = public stable as $$
  select p.id, p.name, p.image_url, p.status, p.stock, v.id, v.name, v.stock
  from public.products p
  left join public.product_variants v on v.product_id = p.id
  where p.seller_id = p_store and public.module_access('supply_office', 'inventory')
    and exists (select 1 from public.dashboards where store_id = p_store and module = 'cashier')
  order by p.name, v.position, v.name;
$$;
grant execute on function public.branch_inventory(uuid) to authenticated;

-- ── Supply requests: special orders to the Main Supply Office ──────────────
-- Organizations and Supply Office branches order from the Main Supply Office: big orders for an
-- event (existing catalog items, modified ones, or a new design such as a uniform) and stock for an
-- organization's collaboration products (collab stock only comes from here).
--   submitted → (changes_requested ↔ submitted) → approved (quote: items + royalty per unit × qty,
--   + delivery fee) → payment_review (receipt) → paid → preparing → ready (walk-in pick-up) or
--   out_for_delivery → completed.  Also declined / cancelled.
-- Completed: collab stock is added to the organization's product; new / modified designs marked
-- "list on the marketplace" become product drafts (photos, sizes, delivered units as stock) that the
-- requester prices and submits to BAO as usual. Royalty collected here is remitted by the Main
-- office (scripts/32). Each request has a chat between the requester and the Main office.
create table if not exists public.supply_requests (
  id                 uuid primary key default gen_random_uuid(),
  requester_store_id uuid not null references public.seller_profiles(id) on delete cascade,
  requester_module   text not null check (requester_module in ('seller', 'cashier')),
  title              text not null check (char_length(trim(title)) between 1 and 150),
  description        text,
  link_url           text,
  attachments        jsonb not null default '[]'::jsonb,   -- [{url | path, name, kind: image | document}]
  needed_by          date,
  fulfilment         text not null default 'pickup' check (fulfilment in ('pickup', 'delivery')),
  delivery_address   text,
  status             text not null default 'submitted' check (status in (
                       'submitted', 'changes_requested', 'approved', 'payment_review', 'paid', 'preparing',
                       'ready', 'out_for_delivery', 'completed', 'declined', 'cancelled')),
  items_total        numeric(12,2),
  royalty_total      numeric(12,2),
  delivery_fee       numeric(12,2) not null default 0,
  total              numeric(12,2),
  royalty_percentage numeric(5,2),
  main_note          text,
  payment_method     text check (payment_method is null or payment_method in ('cash', 'gcash', 'bank')),
  receipt_url        text,
  reference_number   text,
  quoted_at          timestamptz,
  paid_at            timestamptz,
  scheduled_date     date,
  completed_at       timestamptz,
  created_by         uuid default auth.uid() references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists supply_requests_store_idx on public.supply_requests(requester_store_id, created_at desc);
create index if not exists supply_requests_status_idx on public.supply_requests(status, created_at desc);

create table if not exists public.supply_request_items (
  id                  uuid primary key default gen_random_uuid(),
  request_id          uuid not null references public.supply_requests(id) on delete cascade,
  kind                text not null check (kind in ('catalog', 'modified', 'custom', 'collab_stock')),
  product_id          uuid references public.products(id) on delete set null,
  variant_id          uuid references public.product_variants(id) on delete set null,
  design_group        text,                 -- sizes of one design share it (one listing per design)
  name                text not null,
  size                text,
  quantity            integer not null check (quantity > 0),
  notes               text,
  uses_logo           boolean not null default false,
  list_on_marketplace boolean not null default false,
  unit_price          numeric(12,2),
  royalty_percentage  numeric(5,2),
  royalty_amount      numeric(12,2) not null default 0,   -- per unit
  created_product_id  uuid references public.products(id) on delete set null,
  position            integer not null default 0
);
alter table public.supply_request_items add column if not exists image_url text;   -- product / size photo, or the design's first image
create index if not exists supply_request_items_request_idx on public.supply_request_items(request_id, position);

create table if not exists public.supply_request_messages (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.supply_requests(id) on delete cascade,
  sender_id  uuid default auth.uid() references auth.users(id) on delete set null,
  from_main  boolean not null default false,
  message    text not null check (char_length(trim(message)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists supply_request_messages_idx on public.supply_request_messages(request_id, created_at);

-- Who is looking at a request: the requester's store staff, or the Main Supply Office
create or replace function public.supply_request_role(p_request uuid)
returns text language sql security definer set search_path = public stable as $$
  select case
    when public.store_access(r.requester_store_id, 'supply') then 'requester'
    when public.module_access('supply_office', 'supply') then 'main'
  end
  from public.supply_requests r where r.id = p_request;
$$;
grant execute on function public.supply_request_role(uuid) to authenticated;

alter table public.supply_requests enable row level security;
alter table public.supply_request_items enable row level security;
alter table public.supply_request_messages enable row level security;
drop policy if exists "supply requests readable by requester and main office" on public.supply_requests;
create policy "supply requests readable by requester and main office" on public.supply_requests for select
  using (public.store_access(requester_store_id, 'supply') or public.module_access('supply_office', 'supply'));
drop policy if exists "supply request items readable" on public.supply_request_items;
create policy "supply request items readable" on public.supply_request_items for select
  using (public.supply_request_role(request_id) is not null);
drop policy if exists "supply request chat readable" on public.supply_request_messages;
create policy "supply request chat readable" on public.supply_request_messages for select
  using (public.supply_request_role(request_id) is not null);
drop policy if exists "supply request chat send" on public.supply_request_messages;
create policy "supply request chat send" on public.supply_request_messages for insert
  with check (public.supply_request_role(request_id) is not null);

-- Supply request notifications: the other side hears about every step and message
create or replace function public.notify_supply_request(p_request uuid, p_to text, p_title text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.supply_requests;
  dash record;
  office uuid;
begin
  select * into r from public.supply_requests where id = p_request;
  if not found then return; end if;
  if p_to = 'main' then
    select id into office from public.dashboards where module = 'supply_office' limit 1;
    if office is not null then
      perform public.notify_dashboard(office, 'supply', 'supply', p_title, p_body, '/supply-office/special-orders/' || r.id);
    end if;
  else
    select * into dash from public.store_dashboard_path(r.requester_store_id);
    if dash.dashboard_id is not null then
      perform public.notify_dashboard(dash.dashboard_id, 'supply', 'supply', p_title, p_body, dash.base || '/supply-requests/' || r.id);
    end if;
  end if;
end;
$$;
revoke all on function public.notify_supply_request(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.supply_message_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  role text := public.supply_request_role(new.request_id);
  r public.supply_requests;
begin
  if role is null then raise exception 'You can''t message about this request.'; end if;
  new.sender_id := auth.uid();
  new.from_main := role = 'main';
  select * into r from public.supply_requests where id = new.request_id;
  perform public.notify_supply_request(new.request_id, case when new.from_main then 'requester' else 'main' end,
    case when new.from_main then 'Main Supply Office replied' else 'New message on a supply request' end,
    r.title || ': ' || left(new.message, 120));
  return new;
end;
$$;
drop trigger if exists supply_message_rules on public.supply_request_messages;
create trigger supply_message_rules before insert on public.supply_request_messages
  for each row execute procedure public.supply_message_rules();

-- Send (or, after "changes requested", resend) a request with its items
create or replace function public.submit_supply_request(p_store uuid, p_payload jsonb, p_request uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  rid uuid := p_request;
  mod text;
  main_store uuid;
  it jsonb;
  pos integer := 0;
  k text;
  a jsonb;
  pid uuid; pname text; pprice numeric; plogo boolean; pseller uuid; pcollab boolean; pstatus text; pimg text;
  vid uuid; vname text; vprice numeric; vimg text;
  first_img text;
begin
  if not public.store_access(p_store, 'supply') then raise exception 'You don''t have access to this store''s supply requests.'; end if;
  select module into mod from public.dashboards where store_id = p_store and module in ('seller', 'cashier') limit 1;
  if mod is null then raise exception 'Only organizations and Supply Office branches send supply requests.'; end if;
  select store_id into main_store from public.dashboards where module = 'supply_office' and store_id is not null limit 1;
  if coalesce(trim(p_payload->>'title'), '') = '' then raise exception 'Give the request a title, e.g. Foundation Day shirts.'; end if;
  if jsonb_array_length(coalesce(p_payload->'items', '[]'::jsonb)) = 0 then raise exception 'Add at least one item.'; end if;
  if jsonb_array_length(p_payload->'items') > 100 then raise exception 'Keep a request under 100 lines.'; end if;
  for a in select * from jsonb_array_elements(coalesce(p_payload->'attachments', '[]'::jsonb)) loop
    if a ? 'path' and (a->>'path') not like p_store::text || '/%' then raise exception 'Upload the files again.'; end if;
    if first_img is null and a->>'kind' = 'image' and a ? 'url' then first_img := a->>'url'; end if;
  end loop;

  if rid is null then
    insert into public.supply_requests (requester_store_id, requester_module, title)
    values (p_store, mod, trim(p_payload->>'title')) returning id into rid;
  else
    perform 1 from public.supply_requests where id = rid and requester_store_id = p_store and status in ('submitted', 'changes_requested') for update;
    if not found then raise exception 'This request can''t be edited any more.'; end if;
    delete from public.supply_request_items where request_id = rid;
  end if;
  update public.supply_requests set
    title = left(trim(p_payload->>'title'), 150),
    description = nullif(trim(p_payload->>'description'), ''),
    link_url = nullif(trim(p_payload->>'link_url'), ''),
    attachments = coalesce(p_payload->'attachments', '[]'::jsonb),
    needed_by = nullif(p_payload->>'needed_by', '')::date,
    fulfilment = case when p_payload->>'fulfilment' = 'delivery' then 'delivery' else 'pickup' end,
    delivery_address = case when p_payload->>'fulfilment' = 'delivery' then nullif(trim(p_payload->>'delivery_address'), '') end,
    status = 'submitted', updated_at = now()
  where id = rid;
  if (select fulfilment from public.supply_requests where id = rid) = 'delivery'
     and (select delivery_address from public.supply_requests where id = rid) is null then
    raise exception 'Add where it should be delivered.';
  end if;

  for it in select * from jsonb_array_elements(p_payload->'items') loop
    pos := pos + 1;
    k := it->>'kind';
    if k not in ('catalog', 'modified', 'custom', 'collab_stock') then raise exception 'Unknown item type.'; end if;
    if coalesce((it->>'quantity')::integer, 0) < 1 then raise exception 'Every item needs a quantity of 1 or more.'; end if;
    pid := null; pname := null; pprice := null; plogo := false; pseller := null; pcollab := false; pstatus := null; pimg := null;
    vid := null; vname := null; vprice := null; vimg := null;
    if k in ('catalog', 'modified', 'collab_stock') then
      select id, name, price, is_royalty_product, seller_id, supply_office_collab, status, image_url
        into pid, pname, pprice, plogo, pseller, pcollab, pstatus, pimg
      from public.products where id = nullif(it->>'product_id', '')::uuid;
      if pid is null then raise exception 'One of the products is no longer available.'; end if;
      if k = 'collab_stock' then
        if pseller <> p_store or not pcollab then raise exception 'Order stock only for your own collaboration products.'; end if;
      elsif pseller is distinct from main_store or pstatus <> 'approved' then
        raise exception 'Pick items from the Main Supply Office''s products.';
      end if;
      if nullif(it->>'variant_id', '') is not null then
        select id, name, price, image_url into vid, vname, vprice, vimg from public.product_variants where id = (it->>'variant_id')::uuid and product_id = pid;
        if vid is null then raise exception 'A size of % is no longer available.', pname; end if;
      end if;
    elsif coalesce(trim(it->>'name'), '') = '' then
      raise exception 'Name every new design.';
    end if;
    insert into public.supply_request_items (request_id, kind, product_id, variant_id, design_group, name, size, quantity, notes,
                                             uses_logo, list_on_marketplace, unit_price, position, image_url)
    values (rid, k, pid, vid, nullif(it->>'design_group', ''),
            case when k = 'custom' then left(trim(it->>'name'), 150) else pname end,
            coalesce(vname, nullif(trim(it->>'size'), '')),
            (it->>'quantity')::integer,
            nullif(trim(it->>'notes'), ''),
            case when k = 'custom' then coalesce((it->>'uses_logo')::boolean, false) else coalesce(plogo, false) end,
            k in ('custom', 'modified') and coalesce((it->>'list_on_marketplace')::boolean, false),
            -- Catalog items start at the catalog price; the Main office prices the rest in its quote
            case when k = 'catalog' then coalesce(vprice, pprice) end,
            pos,
            case when k = 'custom' then first_img else coalesce(vimg, pimg) end);
  end loop;

  perform public.notify_supply_request(rid, 'main',
    case when p_request is null then 'New supply request' else 'Supply request updated' end,
    coalesce((select org_name from public.seller_profiles where id = p_store), 'A store') || ': ' || trim(p_payload->>'title'));
  return rid;
end;
$$;
grant execute on function public.submit_supply_request(uuid, jsonb, uuid) to authenticated;

-- The Main office reviews: approve with a quote, ask for changes, or decline
create or replace function public.review_supply_request(p_id uuid, p_decision text, p_note text default null,
                                                        p_prices jsonb default '[]'::jsonb, p_delivery_fee numeric default 0)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.supply_requests;
  rate numeric;
  pr jsonb;
  missing integer;
begin
  if not public.module_access('supply_office', 'supply') then raise exception 'Only the Main Supply Office reviews supply requests.'; end if;
  select * into r from public.supply_requests where id = p_id for update;
  if not found then raise exception 'Request not found.'; end if;

  if p_decision = 'approve' then
    if r.status <> 'submitted' then raise exception 'Only a request waiting for review can be approved.'; end if;
    for pr in select * from jsonb_array_elements(coalesce(p_prices, '[]'::jsonb)) loop
      if (pr->>'unit_price')::numeric < 0 then raise exception 'Prices can''t be negative.'; end if;
      update public.supply_request_items set unit_price = round((pr->>'unit_price')::numeric, 2)
      where id = (pr->>'id')::uuid and request_id = p_id;
    end loop;
    select count(*) into missing from public.supply_request_items where request_id = p_id and unit_price is null;
    if missing > 0 then raise exception 'Set a price for every item.'; end if;
    if coalesce(p_delivery_fee, 0) < 0 then raise exception 'The delivery fee can''t be negative.'; end if;
    -- Royalty: per unit of every logo item, times the units requested
    select coalesce(global_royalty_percentage, 0) into rate from public.bao_settings where id = 1;
    rate := coalesce(rate, 0);
    update public.supply_request_items set
      royalty_percentage = case when uses_logo then rate end,
      royalty_amount     = case when uses_logo then round(unit_price * rate / 100, 2) else 0 end
    where request_id = p_id;
    update public.supply_requests set
      items_total   = (select sum(unit_price * quantity) from public.supply_request_items where request_id = p_id),
      royalty_total = (select sum(royalty_amount * quantity) from public.supply_request_items where request_id = p_id),
      delivery_fee  = case when r.fulfilment = 'delivery' then coalesce(p_delivery_fee, 0) else 0 end,
      royalty_percentage = rate,
      status = 'approved', quoted_at = now(), main_note = nullif(trim(p_note), ''), updated_at = now()
    where id = p_id;
    update public.supply_requests set total = items_total + royalty_total + delivery_fee where id = p_id;
    perform public.notify_supply_request(p_id, 'requester', 'Supply request approved — please pay',
      r.title || ': ₱' || to_char((select total from public.supply_requests where id = p_id), 'FM999,999,990.00') || ' including royalty.');
  elsif p_decision = 'changes' then
    if r.status <> 'submitted' then raise exception 'Only a request waiting for review can be sent back.'; end if;
    if coalesce(trim(p_note), '') = '' then raise exception 'Tell them what to change.'; end if;
    update public.supply_requests set status = 'changes_requested', main_note = trim(p_note), updated_at = now() where id = p_id;
    perform public.notify_supply_request(p_id, 'requester', 'Changes requested on your supply request', r.title || ': ' || trim(p_note));
  elsif p_decision = 'decline' then
    if r.status not in ('submitted', 'changes_requested', 'approved') then raise exception 'This request can''t be declined now.'; end if;
    update public.supply_requests set status = 'declined', main_note = nullif(trim(p_note), ''), updated_at = now() where id = p_id;
    perform public.notify_supply_request(p_id, 'requester', 'Supply request declined', r.title || coalesce(': ' || nullif(trim(p_note), ''), ''));
  else
    raise exception 'Choose approve, changes or decline.';
  end if;
end;
$$;
grant execute on function public.review_supply_request(uuid, text, text, jsonb, numeric) to authenticated;

-- The requester pays the quote: online with a receipt, or at the Main office counter
create or replace function public.pay_supply_request(p_id uuid, p_method text, p_receipt_url text default null, p_reference text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.supply_requests;
begin
  select * into r from public.supply_requests where id = p_id for update;
  if not found or not public.store_access(r.requester_store_id, 'supply') then raise exception 'Request not found.'; end if;
  if r.status <> 'approved' then raise exception 'This request isn''t waiting for payment.'; end if;
  if p_method not in ('cash', 'gcash', 'bank') then raise exception 'Choose how you''re paying.'; end if;
  if p_method <> 'cash' and coalesce(trim(p_receipt_url), '') = '' then raise exception 'Upload the payment receipt.'; end if;
  update public.supply_requests set
    payment_method = p_method,
    receipt_url = case when p_method = 'cash' then null else trim(p_receipt_url) end,
    reference_number = nullif(trim(p_reference), ''),
    status = case when p_method = 'cash' then 'approved' else 'payment_review' end,
    updated_at = now()
  where id = p_id;
  perform public.notify_supply_request(p_id, 'main',
    case when p_method = 'cash' then 'Supply request: paying at the counter' else 'Supply request payment to check' end,
    r.title || ': ₱' || to_char(r.total, 'FM999,999,990.00'));
end;
$$;
grant execute on function public.pay_supply_request(uuid, text, text, text) to authenticated;

-- The requester withdraws a request that isn't paid yet
create or replace function public.cancel_supply_request(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.supply_requests;
begin
  select * into r from public.supply_requests where id = p_id for update;
  if not found or not public.store_access(r.requester_store_id, 'supply') then raise exception 'Request not found.'; end if;
  if r.status not in ('submitted', 'changes_requested', 'approved') then raise exception 'A paid or closed request can''t be cancelled. Message the Main office.'; end if;
  update public.supply_requests set status = 'cancelled', updated_at = now() where id = p_id;
  perform public.notify_supply_request(p_id, 'main', 'Supply request cancelled', r.title);
end;
$$;
grant execute on function public.cancel_supply_request(uuid) to authenticated;

-- The Main office moves a paid request along. Completing it adds collab stock to the organization's
-- product and turns "list on the marketplace" designs into product drafts in the requester's store.
create or replace function public.advance_supply_request(p_id uuid, p_step text, p_date date default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.supply_requests;
  it record;
  g record;
  pid uuid;
  rate numeric;
  imgs text[];
  code text;
  label text;
begin
  if not public.module_access('supply_office', 'supply') then raise exception 'Only the Main Supply Office updates supply requests.'; end if;
  select * into r from public.supply_requests where id = p_id for update;
  if not found then raise exception 'Request not found.'; end if;
  code := upper(left(r.id::text, 8));

  if p_step = 'paid' then
    if r.status not in ('approved', 'payment_review') then raise exception 'This request isn''t waiting for payment.'; end if;
    update public.supply_requests set status = 'paid', paid_at = now(), payment_method = coalesce(payment_method, 'cash'), updated_at = now() where id = p_id;
    label := 'Payment received — your supply order is confirmed';
  elsif p_step = 'reject_payment' then
    if r.status <> 'payment_review' then raise exception 'There''s no payment to check.'; end if;
    update public.supply_requests set status = 'approved', main_note = coalesce(nullif(trim(p_note), ''), main_note), updated_at = now() where id = p_id;
    label := 'Payment not confirmed — please check and send it again';
  elsif p_step = 'preparing' then
    if r.status <> 'paid' then raise exception 'Mark it paid first.'; end if;
    update public.supply_requests set status = 'preparing', scheduled_date = coalesce(p_date, scheduled_date), updated_at = now() where id = p_id;
    label := 'Your supply order is being prepared';
  elsif p_step in ('ready', 'out_for_delivery') then
    if r.status not in ('paid', 'preparing') then raise exception 'Mark it paid first.'; end if;
    update public.supply_requests set status = p_step, scheduled_date = coalesce(p_date, scheduled_date), updated_at = now() where id = p_id;
    label := case when p_step = 'ready' then 'Supply order ready for pick-up at the Main Supply Office' else 'Supply order out for delivery' end
             || coalesce(' — ' || to_char(coalesce(p_date, r.scheduled_date), 'Dy, Mon DD'), '');
  elsif p_step = 'completed' then
    if r.status not in ('paid', 'preparing', 'ready', 'out_for_delivery') then raise exception 'Mark it paid first.'; end if;
    -- Collab stock goes into the organization's own product / size
    for it in select * from public.supply_request_items where request_id = p_id and kind = 'collab_stock' and product_id is not null loop
      if it.variant_id is not null then
        update public.product_variants set stock = stock + it.quantity, updated_at = now() where id = it.variant_id;
      else
        update public.products set stock = stock + it.quantity, updated_at = now() where id = it.product_id and seller_id = r.requester_store_id;
      end if;
      insert into public.inventory_movements (store_id, product_id, variant_id, product_name, change, reason, note, created_by)
      values (r.requester_store_id, it.product_id, it.variant_id, it.name || coalesce(' (' || it.size || ')', ''), it.quantity,
              'restock', 'Supply order #' || code || ' from Main Supply Office', auth.uid());
    end loop;
    -- New / modified designs to sell: one product draft per design, its sizes as variants
    select array_agg(a->>'url') filter (where a->>'kind' = 'image' and a ? 'url') into imgs from jsonb_array_elements(r.attachments) a;
    select coalesce(global_royalty_percentage, 0) into rate from public.bao_settings where id = 1;
    for g in
      select coalesce(design_group, id::text) as grp, min(name) as name, min(notes) as notes, bool_or(uses_logo) as logo,
             min(unit_price) as price, sum(quantity) as qty, bool_or(size is not null) as sized
      from public.supply_request_items
      where request_id = p_id and kind in ('custom', 'modified') and list_on_marketplace and created_product_id is null
      group by coalesce(design_group, id::text)
    loop
      insert into public.products (seller_id, name, description, category, price, stock, badge, image_url, images, status,
                                   has_logo, is_royalty_product, royalty_percentage, supply_office_collab)
      values (r.requester_store_id, g.name, coalesce(g.notes, r.description), 'General', coalesce(g.price, 0),
              case when g.sized then 0 else g.qty end, 'Available', imgs[1], coalesce(imgs, '{}'), 'draft',
              g.logo, g.logo, case when g.logo then coalesce(rate, 0) else 0 end, r.requester_module = 'seller')
      returning id into pid;
      insert into public.product_variants (product_id, name, size, price, stock, position)
      select pid, size, size, coalesce(min(unit_price), 0), sum(quantity), min(position)
      from public.supply_request_items
      where request_id = p_id and coalesce(design_group, id::text) = g.grp and size is not null
      group by size;
      update public.supply_request_items set created_product_id = pid
      where request_id = p_id and coalesce(design_group, id::text) = g.grp;
    end loop;
    update public.supply_requests set status = 'completed', completed_at = now(), updated_at = now() where id = p_id;
    label := case when r.fulfilment = 'delivery' then 'Supply order delivered' else 'Supply order picked up' end;
  else
    raise exception 'Unknown step.';
  end if;
  if nullif(trim(p_note), '') is not null and p_step <> 'reject_payment' then
    update public.supply_requests set main_note = trim(p_note) where id = p_id;
  end if;
  perform public.notify_supply_request(p_id, 'requester', label, r.title || coalesce(' — ' || nullif(trim(p_note), ''), ''));
end;
$$;
grant execute on function public.advance_supply_request(uuid, text, date, text) to authenticated;

-- Photos for lines sent before photos were saved
update public.supply_request_items si
set image_url = coalesce((select image_url from public.product_variants where id = si.variant_id),
                         (select image_url from public.products where id = si.product_id))
where si.image_url is null and si.product_id is not null;
update public.supply_request_items si
set image_url = (select a->>'url' from public.supply_requests r, jsonb_array_elements(r.attachments) a
                 where r.id = si.request_id and a->>'kind' = 'image' and a ? 'url' limit 1)
where si.image_url is null and si.kind = 'custom';

-- Private files of a request (proposal documents): the requester uploads, both sides can read
insert into storage.buckets (id, name, public, file_size_limit)
values ('supply-requests', 'supply-requests', false, 20971520)
on conflict (id) do update set public = false;
drop policy if exists "supply request files upload" on storage.objects;
create policy "supply request files upload" on storage.objects for insert
  with check (bucket_id = 'supply-requests' and public.store_access(((storage.foldername(name))[1])::uuid, 'supply'));
drop policy if exists "supply request files read" on storage.objects;
create policy "supply request files read" on storage.objects for select
  using (bucket_id = 'supply-requests' and (
    public.store_access(((storage.foldername(name))[1])::uuid, 'supply') or public.module_access('supply_office', 'supply')));

-- ── Collaboration stock, from the Main Supply Office's side ───────────────
-- (the collaboration flag itself is created in 32_performance.sql; added here too so this runs first)
alter table public.products add column if not exists supply_office_collab boolean not null default false;
-- The Main office sees every organization's collaboration products and their stock, sends a stock
-- order (already quoted: cost + royalty per logo unit × units; the organization pays, the stock is
-- added when it's completed) and can correct the count or take out damaged units.
create or replace function public.collab_inventory()
returns table (store_id uuid, store_name text, product_id uuid, product_name text, image_url text, product_status text,
               price numeric, logo boolean, product_stock integer, variant_id uuid, variant_name text, variant_price numeric, variant_stock integer)
language sql security definer set search_path = public stable as $$
  select p.seller_id, sp.org_name, p.id, p.name, p.image_url, p.status, p.price, p.is_royalty_product, p.stock, v.id, v.name, v.price, v.stock
  from public.products p
  join public.seller_profiles sp on sp.id = p.seller_id
  left join public.product_variants v on v.product_id = p.id
  where p.supply_office_collab and p.status <> 'draft'
    and (public.module_access('supply_office', 'inventory') or public.module_access('supply_office', 'supply'))
  order by sp.org_name, p.name, v.position, v.name;
$$;
grant execute on function public.collab_inventory() to authenticated;

create or replace function public.send_collab_stock_order(p_product uuid, p_lines jsonb, p_note text default null,
                                                          p_fulfilment text default 'pickup', p_address text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  p record;
  ln jsonb;
  vid uuid;
  vname text;
  rid uuid;
  rate numeric;
  pos integer := 0;
begin
  if not (public.module_access('supply_office', 'inventory') or public.module_access('supply_office', 'supply')) then
    raise exception 'Only the Main Supply Office sends stock orders.';
  end if;
  select pr.id, pr.name, pr.seller_id, pr.is_royalty_product, pr.image_url into p
  from public.products pr where pr.id = p_product and pr.supply_office_collab;
  if p.id is null then raise exception 'That isn''t a collaboration product.'; end if;
  if not exists (select 1 from public.dashboards where store_id = p.seller_id and module = 'seller') then
    raise exception 'Collaboration products belong to organizations.';
  end if;
  if jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) = 0 then raise exception 'Enter the units to send.'; end if;
  if p_fulfilment = 'delivery' and coalesce(trim(p_address), '') = '' then raise exception 'Add where it should be delivered.'; end if;
  select coalesce(global_royalty_percentage, 0) into rate from public.bao_settings where id = 1;
  rate := coalesce(rate, 0);

  insert into public.supply_requests (requester_store_id, requester_module, title, description, fulfilment, delivery_address, status, main_note, quoted_at)
  values (p.seller_id, 'seller', left('Stock for ' || p.name, 150), 'Stock order sent by the Main Supply Office.',
          case when p_fulfilment = 'delivery' then 'delivery' else 'pickup' end,
          case when p_fulfilment = 'delivery' then trim(p_address) end,
          'approved', nullif(trim(p_note), ''), now())
  returning id into rid;

  for ln in select * from jsonb_array_elements(p_lines) loop
    if coalesce((ln->>'quantity')::integer, 0) < 1 then continue; end if;
    if coalesce((ln->>'unit_price')::numeric, -1) < 0 then raise exception 'Set the price per unit.'; end if;
    vid := null; vname := null;
    if nullif(ln->>'variant_id', '') is not null then
      select pv.id, pv.name into vid, vname from public.product_variants pv where pv.id = (ln->>'variant_id')::uuid and pv.product_id = p.id;
      if vid is null then raise exception 'A size of % was not found.', p.name; end if;
    end if;
    pos := pos + 1;
    insert into public.supply_request_items (request_id, kind, product_id, variant_id, design_group, name, size, quantity,
                                             uses_logo, unit_price, royalty_percentage, royalty_amount, position, image_url)
    values (rid, 'collab_stock', p.id, vid, p.id::text, p.name, vname, (ln->>'quantity')::integer,
            coalesce(p.is_royalty_product, false), round((ln->>'unit_price')::numeric, 2),
            case when p.is_royalty_product then rate end,
            case when p.is_royalty_product then round((ln->>'unit_price')::numeric * rate / 100, 2) else 0 end, pos,
            coalesce((select image_url from public.product_variants where id = vid), p.image_url));
  end loop;
  if pos = 0 then raise exception 'Enter the units to send.'; end if;

  update public.supply_requests set
    items_total   = (select sum(unit_price * quantity) from public.supply_request_items where request_id = rid),
    royalty_total = (select sum(royalty_amount * quantity) from public.supply_request_items where request_id = rid),
    delivery_fee = 0, royalty_percentage = rate
  where id = rid;
  update public.supply_requests set total = items_total + royalty_total where id = rid;
  perform public.notify_supply_request(rid, 'requester', 'Stock order from the Main Supply Office — please pay',
    p.name || ': ₱' || to_char((select total from public.supply_requests where id = rid), 'FM999,999,990.00') || ' including royalty.');
  return rid;
end;
$$;
grant execute on function public.send_collab_stock_order(uuid, jsonb, text, text, text) to authenticated;

-- Corrections only: take out damaged units, or set the counted total
create or replace function public.main_adjust_collab_stock(p_product uuid, p_variant uuid, p_mode text, p_quantity integer, p_note text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  store uuid;
  before_stock integer;
  after_stock integer;
  delta integer;
  dash record;
  pname text;
begin
  if not (public.module_access('supply_office', 'inventory') or public.module_access('supply_office', 'supply')) then
    raise exception 'Only the Main Supply Office corrects collaboration stock.';
  end if;
  select seller_id, name into store, pname from public.products where id = p_product and supply_office_collab;
  if store is null then raise exception 'That isn''t a collaboration product.'; end if;
  select coalesce((select stock from public.product_variants where id = p_variant and product_id = p_product),
                  (select stock from public.products where id = p_product)) into before_stock;
  if p_mode = 'remove' then
    if coalesce(p_quantity, 0) < 1 then raise exception 'Enter how many units to take out.'; end if;
    delta := -p_quantity;
  elsif p_mode = 'set' then
    if coalesce(p_quantity, -1) < 0 then raise exception 'The counted total can''t be negative.'; end if;
    delta := p_quantity - before_stock;
  else
    raise exception 'New stock is sent as a stock order. Here you can only take units out or set the count.';
  end if;
  if delta = 0 then return before_stock; end if;
  after_stock := public.branch_stock_change(store, p_product, p_variant, delta, 'adjustment',
    'Main Supply Office: ' || coalesce(nullif(trim(p_note), ''), case when p_mode = 'set' then 'stock count' else 'damaged / taken out' end));
  select * into dash from public.store_dashboard_path(store);
  if dash.dashboard_id is not null then
    perform public.notify_dashboard(dash.dashboard_id, 'inventory', 'inventory', 'Stock corrected by the Main Supply Office',
      pname || ': ' || before_stock || ' → ' || after_stock || coalesce(' — ' || nullif(trim(p_note), ''), ''), dash.base || '/inventory');
  end if;
  return after_stock;
end;
$$;
grant execute on function public.main_adjust_collab_stock(uuid, uuid, text, integer, text) to authenticated;

notify pgrst, 'reload schema';

-- Check: every Supply Office branch and its store
select d.name as branch, sp.org_name as store, sp.category
from public.dashboards d left join public.seller_profiles sp on sp.id = d.store_id
where d.module = 'cashier' order by d.campus, d.name;
