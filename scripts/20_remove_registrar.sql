-- ============================================================
-- UniMerch — Remove every Registrar leftover from the database
-- There is no Registrar in UniMerch. The old demo account registrar@unimerch.sorsu.edu.ph
-- ("Registrar Officer") was carried into the Cashier dashboard by earlier migrations, so
-- logging in with it opened a "Registrar" dashboard. This removes it for good.
-- Safe to re-run. Paste the WHOLE file into the Supabase SQL Editor and click Run.
-- ============================================================

-- 1. Registrar accounts: the old demo login, any profile still named/role "registrar".
drop table if exists pg_temp.registrar_accounts;
create temporary table registrar_accounts as
select u.id
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) like 'registrar%'
   or p.role = 'registrar'
   or p.full_name ilike '%registrar%';

-- 2. They lose every dashboard membership (no more "Registrar" dashboard on login).
delete from public.dashboard_members where user_id in (select id from registrar_accounts);

-- 3. Delete the accounts. If an account is still referenced (e.g. it created records),
--    it is banned and renamed instead so it can never log in to a dashboard again.
do $$
declare r record;
begin
  for r in select id from registrar_accounts loop
    begin
      delete from auth.users where id = r.id;
    exception when others then
      update public.profiles
      set role = 'buyer', full_name = 'Removed account', account_status = 'banned'
      where id = r.id;
      update auth.users set banned_until = 'infinity' where id = r.id;
    end;
  end loop;
end $$;

-- 4. Any dashboard still named "Registrar" is removed (members go with it).
--    Cashier branches were already renamed by 19_cashier_branches.sql.
update public.seller_profiles set status = 'suspended'
where id in (select store_id from public.dashboards where name ilike '%registrar%' and store_id is not null);
delete from public.dashboards where name ilike '%registrar%';

-- 5. Stores still called "Registrar" are hidden from the marketplace.
update public.seller_profiles set status = 'suspended' where org_name ilike '%registrar%';

-- 6. No "registrar" role value anywhere.
update public.profiles set role = 'buyer' where role = 'registrar';
drop policy if exists "registrar inserts seller profiles" on public.seller_profiles;

notify pgrst, 'reload schema';

-- Check: both should return no rows.
select u.email, p.full_name from auth.users u left join public.profiles p on p.id = u.id
where lower(u.email) like 'registrar%' and u.banned_until is null;
select module, name from public.dashboards where name ilike '%registrar%';
