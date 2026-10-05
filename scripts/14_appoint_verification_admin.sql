-- ============================================================
-- UniMerch — Appoint the Main Admin of a university dashboard
-- Use this when a dashboard's menu is missing (the account isn't a member of that dashboard),
-- e.g. the Verification Admin or the BAO sees a normal user page.
-- Run AFTER setup_all.sql (or 10_dashboards.sql).
--
-- Edit the list at the bottom (email → dashboard), then paste the WHOLE file into the
-- Supabase SQL Editor and click Run. Dashboards: verification | bao | supply_office | cashier (Bulan branch)
-- ============================================================

create or replace function pg_temp.appoint_main_admin(admin_email text, target_module text, display_name text)
returns text
language plpgsql as $$
declare
  admin_id uuid;
  dash_id  uuid;
begin
  select id into admin_id from auth.users where lower(email) = lower(admin_email);
  if admin_id is null then
    return format('SKIPPED %s — no account uses this email (sign up first)', admin_email);
  end if;

  insert into public.profiles (id, full_name) values (admin_id, display_name) on conflict (id) do nothing;
  update public.profiles set full_name = display_name
  where id = admin_id and (full_name is null or full_name ilike 'system admin%');

  -- Cashier has one dashboard per branch: pick the branch whose name matches (e.g. "Cashier — Bulan Campus")
  select id into dash_id from public.dashboards where module = target_module
  order by (name = display_name) desc, created_at limit 1;
  if dash_id is null then
    insert into public.dashboards (module, name) values (target_module, display_name) returning id into dash_id;
    if target_module = 'cashier' then
      update public.dashboards set campus = 'bulan', scope = 'campus' where id = dash_id;
    end if;
  end if;

  -- Only one Main Admin per dashboard: the previous one stays on as a member.
  update public.dashboard_members set is_main = false
  where dashboard_id = dash_id and is_main and user_id <> admin_id;

  insert into public.dashboard_members (dashboard_id, user_id, is_main)
  values (dash_id, admin_id, true)
  on conflict (dashboard_id, user_id) do update set is_main = true;

  return format('OK %s is Main Admin of %s', admin_email, target_module);
end;
$$;

-- ↓↓ Edit these lines (remove any you don't need) ↓↓
select pg_temp.appoint_main_admin('admin@unimerch.sorsu.edu.ph',   'verification',  'Verification Admin') as result
union all
select pg_temp.appoint_main_admin('bao@unimerch.sorsu.edu.ph',     'bao',           'BAO Officer')
union all
select pg_temp.appoint_main_admin('supply@unimerch.sorsu.edu.ph',  'supply_office', 'Supply Office Staff')
union all
select pg_temp.appoint_main_admin('cashier@unimerch.sorsu.edu.ph', 'cashier',       'Cashier — Bulan Campus');
-- Other cashier branches are created and staffed from the Verification Admin → Cashier Branches page.

-- Check: every dashboard and its Main Admin
select d.module, d.name, u.email as main_admin
from public.dashboards d
left join public.dashboard_members m on m.dashboard_id = d.id and m.is_main
left join auth.users u on u.id = m.user_id
order by d.module, d.name;
