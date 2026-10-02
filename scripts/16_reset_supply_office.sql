-- ============================================================
-- UniMerch — RESET the Supply Office store's data (start fresh with real data)
--
-- ⚠ PERMANENT. Deletes, for the University Supply Office store ONLY:
--     • its products (and their stock movement history)
--     • its sales reports
--     • orders that contain ONLY Supply Office items (test orders), with their status history
-- Keeps: the Supply Office dashboard, its members, its storefront settings (name, pickup location,
--        QR codes), every other store's data, and all user accounts.
--
-- Paste the WHOLE file into the Supabase SQL Editor and click Run.
-- ============================================================

do $$
declare
  store uuid;
  n_orders int; n_products int; n_reports int;
begin
  select store_id into store from public.dashboards where module = 'supply_office';
  if store is null then
    raise notice 'No Supply Office store found — nothing to reset.';
    return;
  end if;

  -- Orders made up only of Supply Office items (orders mixed with other stores are kept)
  with only_supply as (
    select order_id from public.order_items
    group by order_id
    having bool_and(seller_id = store)
  )
  delete from public.orders where id in (select order_id from only_supply);
  get diagnostics n_orders = row_count;

  delete from public.order_items where seller_id = store;   -- leftover lines in mixed orders

  if to_regclass('public.inventory_movements') is not null then
    delete from public.inventory_movements where store_id = store;
  end if;

  if to_regclass('public.sales_reports') is not null then
    delete from public.sales_reports where store_id = store;
    get diagnostics n_reports = row_count;
  end if;

  delete from public.products where seller_id = store;
  get diagnostics n_products = row_count;

  raise notice 'Supply Office reset: % orders, % products, % sales reports deleted.', n_orders, n_products, coalesce(n_reports, 0);
end;
$$;
