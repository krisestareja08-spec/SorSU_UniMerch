-- ============================================================
-- UniMerch — Seller Storefront module
-- Run in Supabase SQL Editor AFTER 10_dashboards.sql. Paste and run the WHOLE file. Safe to re-run.
--
--   • branding columns     — logo, banner and theme (accent / layout / banner / tagline)
--                            for future storefront customization
--   • auto storefront      — every Seller Dashboard gets its store (storefront) automatically
--   • indexes              — fast per-seller product listing for thousands of sellers
-- ============================================================

alter table public.seller_profiles add column if not exists logo_url   text;
alter table public.seller_profiles add column if not exists banner_url text;
alter table public.seller_profiles add column if not exists theme      jsonb not null default '{}'::jsonb;
alter table public.seller_profiles add column if not exists rating       numeric(3,2) not null default 0;
alter table public.seller_profiles add column if not exists rating_count integer      not null default 0;

-- Storefront listing: products of one seller, approved, newest first (+ category filter)
create index if not exists products_storefront_idx on public.products (seller_id, status, created_at desc);
create index if not exists products_storefront_category_idx on public.products (seller_id, category) where status = 'approved';
create index if not exists seller_follows_seller_idx on public.seller_follows (seller_id);

-- A Seller Dashboard created without a store automatically gets its storefront.
create or replace function public.ensure_dashboard_store()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.module = 'seller' and new.store_id is null then
    insert into public.seller_profiles (org_name, status, created_by)
    values (new.name, 'active', auth.uid())
    returning id into new.store_id;
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_dashboard_store on public.dashboards;
create trigger ensure_dashboard_store before insert on public.dashboards for each row execute procedure public.ensure_dashboard_store();

-- Storefronts are public pages: anyone (signed in or not) can read store records.
drop policy if exists "anyone reads seller profiles" on public.seller_profiles;
create policy "anyone reads seller profiles" on public.seller_profiles for select using (true);
