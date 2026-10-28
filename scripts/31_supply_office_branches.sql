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
  office record;
begin
  if not exists (select 1 from public.dashboards where store_id = new.branch_store_id and module = 'cashier') then
    raise exception 'Only Supply Office branches send stock requests.';
  end if;
  select name, stock into pname, pstock from public.products where id = new.product_id and seller_id = new.branch_store_id;
  if pname is null then raise exception 'Choose one of your branch''s products.'; end if;
  if new.variant_id is not null then
    select name, stock into vname, vstock from public.product_variants where id = new.variant_id and product_id = new.product_id;
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

notify pgrst, 'reload schema';

-- Check: every Supply Office branch and its store
select d.name as branch, sp.org_name as store, sp.category
from public.dashboards d left join public.seller_profiles sp on sp.id = d.store_id
where d.module = 'cashier' order by d.campus, d.name;
