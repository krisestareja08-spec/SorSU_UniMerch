-- ============================================================
-- UniMerch — Cashier branches (one Cashier dashboard + store per campus / department)
-- Run in Supabase SQL Editor AFTER setup_all.sql. Paste and run the WHOLE file. Safe to re-run.
--
-- The university has a cashier office per campus branch. Each branch is its own dashboard with
-- its own store (a secondary seller of uniforms and university merchandise), scoped to:
--   • campus       — serves the whole campus branch
--   • department   — serves one department of a campus
--   • centralized  — serves the university centrally (still tied to a campus location)
-- The Verification Admin creates branches. The existing Cashier becomes "Cashier — Bulan Campus".
-- ============================================================

-- Branch identity on the dashboard
alter table public.dashboards add column if not exists campus     text;
alter table public.dashboards add column if not exists scope      text;
alter table public.dashboards add column if not exists department text;
alter table public.dashboards drop constraint if exists dashboards_scope_check;
alter table public.dashboards add constraint dashboards_scope_check
  check (scope is null or scope in ('campus','department','centralized')) not valid;
alter table public.dashboards drop constraint if exists dashboards_cashier_campus_check;
alter table public.dashboards add constraint dashboards_cashier_campus_check
  check (module <> 'cashier' or campus is not null) not valid;

-- Cashier is no longer a single dashboard: many branches, like seller organizations
drop index if exists public.dashboards_single_module;
create unique index if not exists dashboards_single_module on public.dashboards(module)
  where module not in ('seller','cashier');

-- ── The existing Cashier becomes the Bulan Campus branch ───────────────────
update public.dashboards
set name = 'Cashier — Bulan Campus', campus = 'bulan', scope = 'campus'
where module = 'cashier' and campus is null;

update public.seller_profiles sp
set org_name = 'University Cashier — Bulan Campus', campus = 'bulan', category = coalesce(sp.category, 'University Cashier')
from public.dashboards d
where d.module = 'cashier' and d.store_id = sp.id and d.campus = 'bulan' and sp.org_name = 'University Cashier';

-- ── A new Cashier branch automatically gets its store (storefront) ─────────
create or replace function public.ensure_dashboard_store()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.module in ('seller','cashier') and new.store_id is null then
    insert into public.seller_profiles (org_name, status, created_by, campus, category)
    values (new.name, 'active', auth.uid(), new.campus, case when new.module = 'cashier' then 'University Cashier' end)
    returning id into new.store_id;
  end if;
  return new;
end;
$$;

-- ── The Verification Admin (Cashier Branches page) can create and staff branches ──
drop policy if exists "verification admin manages dashboards" on public.dashboards;
create policy "verification admin manages dashboards" on public.dashboards
  for all using (public.module_access('verification', 'organizations') or public.module_access('verification', 'cashiers'))
  with check (public.module_access('verification', 'organizations') or public.module_access('verification', 'cashiers'));

drop policy if exists "verification admin creates stores" on public.seller_profiles;
create policy "verification admin creates stores" on public.seller_profiles
  for insert with check (public.module_access('verification', 'organizations') or public.module_access('verification', 'cashiers'));

drop policy if exists "main admin manages members" on public.dashboard_members;
create policy "main admin manages members" on public.dashboard_members
  for all using (
    public.is_dashboard_main(dashboard_id) or public.is_verification_main()
    or public.module_access('verification', 'organizations') or public.module_access('verification', 'dashboards')
    or public.module_access('verification', 'cashiers')
  )
  with check (
    public.is_dashboard_main(dashboard_id) or public.is_verification_main()
    or public.module_access('verification', 'organizations') or public.module_access('verification', 'dashboards')
    or public.module_access('verification', 'cashiers')
  );

create or replace function public.find_user_by_email(p_email text)
returns table (id uuid, full_name text)
language sql security definer set search_path = public, auth stable as $$
  select u.id, p.full_name
  from auth.users u left join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(p_email))
    and (
      exists (select 1 from public.dashboard_members m where m.user_id = auth.uid() and m.is_main)
      or public.module_access('verification', 'organizations')
      or public.module_access('verification', 'dashboards')
      or public.module_access('verification', 'cashiers')
    )
  limit 1;
$$;
grant execute on function public.find_user_by_email(text) to authenticated;

notify pgrst, 'reload schema';

-- Check: every Cashier branch
select d.name, d.campus, d.scope, d.department, sp.org_name as store
from public.dashboards d left join public.seller_profiles sp on sp.id = d.store_id
where d.module = 'cashier' order by d.campus, d.name;
