-- Replace the "registrar" role with "cashier" (seller-type staff role).
-- Identity verification is now handled by the "admin" role.
update public.profiles set role = 'cashier' where role = 'registrar';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('buyer','seller','bao','supply_office','cashier','admin'));

drop policy if exists "registrar inserts seller profiles" on public.seller_profiles;
drop policy if exists "admin inserts seller profiles" on public.seller_profiles;
create policy "admin inserts seller profiles"
  on public.seller_profiles for insert to authenticated
  with check (
    auth.uid() = id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
