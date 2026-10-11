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

notify pgrst, 'reload schema';

-- Check: every Supply Office branch and its store
select d.name as branch, sp.org_name as store, sp.category
from public.dashboards d left join public.seller_profiles sp on sp.id = d.store_id
where d.module = 'cashier' order by d.campus, d.name;
