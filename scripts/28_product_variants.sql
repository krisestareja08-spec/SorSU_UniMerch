-- ============================================================
-- UniMerch — Product variants (sizes): each size is its own purchasable option
-- Run in Supabase SQL Editor AFTER 27_variant_prices_payment_modes.sql. Paste and run the WHOLE file. Safe to re-run.
--
--   • product_variants — one row per size (and optional colour) of a product, each with its own
--                        price, stock, SKU and optional image. Buyers pick one; the cart, checkout,
--                        orders and stock all work on that exact variant.
--   • products.price / price_max / stock / variations are kept in sync automatically:
--       price = lowest variant price, price_max = highest, stock = total of all variants,
--       variations = the variant names (so lists, cards and search keep working)
--   • order_items.variant_id — the exact variant bought; a sale takes stock from that variant and
--     a cancelled order puts it back
--   • Existing products with sizes are converted: each size becomes a variant with its size price
--     (from scripts/27) or the product price, and the product's stock is split across its sizes —
--     sellers should check those numbers once.
-- ============================================================

create table if not exists public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  name        text not null,                 -- what the buyer picks, e.g. "M" or "M / Maroon"
  size        text,
  color       text,
  price       numeric(10,2) not null check (price >= 0),
  stock       integer not null default 0 check (stock >= 0),
  sku         text,
  image_url   text,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (product_id, name)
);
create index if not exists product_variants_product_idx on public.product_variants(product_id, position);

alter table public.products            add column if not exists price_max  numeric(10,2);
alter table public.order_items         add column if not exists variant_id uuid references public.product_variants(id) on delete set null;
alter table public.inventory_movements add column if not exists variant_id uuid references public.product_variants(id) on delete set null;

-- ── Who can see / change variants ──────────────────────────────────────────
alter table public.product_variants enable row level security;

-- Visible exactly when the product itself is visible to this viewer (products RLS applies)
drop policy if exists "variants follow their product" on public.product_variants;
create policy "variants follow their product" on public.product_variants for select
  using (exists (select 1 from public.products p where p.id = product_id));

-- The store's members with Products (prices, sizes) or Inventory (stock) permission
drop policy if exists "store manages variants" on public.product_variants;
create policy "store manages variants" on public.product_variants for all
  using (exists (select 1 from public.products p where p.id = product_id
                 and (public.store_access(p.seller_id, 'products') or public.store_access(p.seller_id, 'inventory'))))
  with check (exists (select 1 from public.products p where p.id = product_id
                 and (public.store_access(p.seller_id, 'products') or public.store_access(p.seller_id, 'inventory'))));

-- ── Keep the product's price range, total stock and size list in sync ─────
create or replace function public.sync_product_from_variants()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p set
    price      = v.min_price,
    price_max  = v.max_price,
    stock      = v.total_stock,
    variations = v.names,
    updated_at = now()
  from (
    select min(price) as min_price, max(price) as max_price, sum(stock)::int as total_stock,
           jsonb_agg(name order by position, created_at) as names
    from public.product_variants where product_id = pid
  ) v
  where p.id = pid and v.min_price is not null;   -- last variant removed: leave the product as it is
  return null;
end;
$$;

drop trigger if exists sync_product_from_variants on public.product_variants;
create trigger sync_product_from_variants after insert or update or delete on public.product_variants
  for each row execute procedure public.sync_product_from_variants();

-- ── Sales take stock from the exact variant; cancellations put it back ────
create or replace function public.stock_out_on_sale()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.variant_id is not null then
    -- the variant sync trigger then updates the product's total stock
    update public.product_variants set stock = greatest(stock - new.quantity, 0), updated_at = now() where id = new.variant_id;
  elsif new.product_id is not null then
    update public.products set stock = greatest(stock - new.quantity, 0), updated_at = now() where id = new.product_id;
  end if;
  if new.product_id is not null and exists (select 1 from public.seller_profiles where id = new.seller_id) then
    insert into public.inventory_movements (store_id, product_id, variant_id, product_name, change, reason, order_id, created_by)
    values (new.seller_id, new.product_id, new.variant_id,
            new.product_name || coalesce(' (' || new.variant || ')', ''), -new.quantity, 'sale', new.order_id, auth.uid());
  end if;
  return new;
end;
$$;

create or replace function public.stock_back_on_cancel()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  item record;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
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

drop trigger if exists stock_out_on_sale on public.order_items;
create trigger stock_out_on_sale after insert on public.order_items for each row execute procedure public.stock_out_on_sale();
drop trigger if exists stock_back_on_cancel on public.orders;
create trigger stock_back_on_cancel after update on public.orders for each row execute procedure public.stock_back_on_cancel();

-- ── Convert existing products that have sizes ─────────────────────────────
do $$
declare
  has_prices boolean := exists (select 1 from information_schema.columns
                                where table_schema = 'public' and table_name = 'products' and column_name = 'variant_prices');
  p record;
  n int;
  i int;
  size_name text;
  size_price numeric;
begin
  for p in
    select * from public.products pr
    where (case when jsonb_typeof(pr.variations) = 'array' then jsonb_array_length(pr.variations) else 0 end) > 0
      and not exists (select 1 from public.product_variants v where v.product_id = pr.id)
  loop
    n := jsonb_array_length(p.variations);
    for i in 0 .. n - 1 loop
      size_name := p.variations ->> i;
      continue when size_name is null or btrim(size_name) = '';
      size_price := null;
      if has_prices then
        execute 'select (variant_prices ->> $1)::numeric from public.products where id = $2' into size_price using size_name, p.id;
      end if;
      insert into public.product_variants (product_id, name, size, price, stock, position)
      values (p.id, size_name, size_name, coalesce(size_price, p.price),
              -- split the product's stock across its sizes; the first size takes the remainder
              (p.stock / n) + case when i = 0 then p.stock % n else 0 end, i)
      on conflict (product_id, name) do nothing;
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Check: products with variants, and their price range / total stock
select p.name, p.price as lowest, p.price_max as highest, p.stock as total_stock, count(v.*) as variants
from public.products p join public.product_variants v on v.product_id = p.id
group by p.id order by p.name;
