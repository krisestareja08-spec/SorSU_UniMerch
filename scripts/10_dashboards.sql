-- ============================================================
-- UniMerch — Dashboards are modules, users are members
-- Run in Supabase SQL Editor AFTER scripts 7, 8 and 9. Paste and run the WHOLE file.
-- Safe to re-run.
--
--   • dashboards          — Verification Admin, BAO, Supply Office, Cashier (one each;
--                           Cashier + Supply Office each own an office store)
--                           + one Seller Dashboard per organization
--   • dashboard_members   — which users manage which dashboard; one Main Admin each,
--                           secondary members get per-page permissions
--   • seller_profiles     — now the ORGANIZATION / STORE record (not a person).
--                           products.seller_id / order_items.seller_id = store id.
--   • access rules        — every rule that used profiles.role now uses membership
--   • migration           — existing admin/bao/supply/cashier/seller accounts become
--                           members (earliest account = Main Admin); roles reset to 'buyer'
-- ============================================================

create extension if not exists pgcrypto;

-- ── 1. Tables ──────────────────────────────────────────────────────────────
create table if not exists public.dashboards (
  id          uuid primary key default gen_random_uuid(),
  module      text not null check (module in ('verification','bao','supply_office','cashier','seller')),
  name        text not null,
  store_id    uuid unique references public.seller_profiles(id) on delete cascade,
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create unique index if not exists dashboards_single_module on public.dashboards(module) where module <> 'seller';

create table if not exists public.dashboard_members (
  dashboard_id uuid not null references public.dashboards(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  is_main      boolean not null default false,
  permissions  text[] not null default array[]::text[],
  added_by     uuid,
  created_at   timestamptz not null default now(),
  primary key (dashboard_id, user_id)
);
create unique index if not exists dashboard_one_main_admin on public.dashboard_members(dashboard_id) where is_main;
create index if not exists dashboard_members_user_idx on public.dashboard_members(user_id);

-- Stores are organizations, not people.
alter table public.seller_profiles alter column id set default gen_random_uuid();
alter table public.seller_profiles drop constraint if exists seller_profiles_id_fkey;
alter table public.products        drop constraint if exists products_seller_id_fkey;
alter table public.order_items     drop constraint if exists order_items_seller_id_fkey;
alter table public.seller_follows  drop constraint if exists seller_follows_seller_id_fkey;
alter table public.seller_profiles add column if not exists campus text;

-- ── 2. Access helpers ──────────────────────────────────────────────────────
create or replace function public.dashboard_access(p_dashboard uuid, p_perm text default null)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.dashboard_members m
    where m.dashboard_id = p_dashboard and m.user_id = auth.uid()
      and (m.is_main or p_perm is null or p_perm = any(m.permissions))
  );
$$;

create or replace function public.is_dashboard_main(p_dashboard uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.dashboard_members m
    where m.dashboard_id = p_dashboard and m.user_id = auth.uid() and m.is_main
  );
$$;

create or replace function public.module_access(p_module text, p_perm text default null)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.dashboards d
    join public.dashboard_members m on m.dashboard_id = d.id
    where d.module = p_module and m.user_id = auth.uid()
      and (m.is_main or p_perm is null or p_perm = any(m.permissions))
  );
$$;

create or replace function public.store_access(p_store uuid, p_perm text default null)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.dashboards d
    join public.dashboard_members m on m.dashboard_id = d.id
    where d.store_id = p_store and m.user_id = auth.uid()
      and (m.is_main or p_perm is null or p_perm = any(m.permissions))
  );
$$;

create or replace function public.is_verification_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select public.module_access('verification');
$$;

create or replace function public.is_verification_main()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.dashboards d join public.dashboard_members m on m.dashboard_id = d.id
    where d.module = 'verification' and m.user_id = auth.uid() and m.is_main
  );
$$;

-- "Staff" = members of the university management dashboards.
create or replace function public.is_staff()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.dashboards d join public.dashboard_members m on m.dashboard_id = d.id
    where d.module in ('verification','bao','supply_office') and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select public.module_access('verification') or public.module_access('bao');
$$;

-- Look up an account by email to add it to a dashboard (Main Admins / Verification Admin only).
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
    )
  limit 1;
$$;
grant execute on function public.find_user_by_email(text) to authenticated;

-- Emails of a dashboard's members (for the Members page).
create or replace function public.dashboard_member_emails(p_dashboard uuid)
returns table (user_id uuid, email text)
language sql security definer set search_path = public, auth stable as $$
  select m.user_id, u.email::text
  from public.dashboard_members m join auth.users u on u.id = m.user_id
  where m.dashboard_id = p_dashboard
    and (public.dashboard_access(p_dashboard) or public.is_verification_admin());
$$;
grant execute on function public.dashboard_member_emails(uuid) to authenticated;

-- ── 3. Rules for dashboards / members ──────────────────────────────────────
alter table public.dashboards enable row level security;
alter table public.dashboard_members enable row level security;

drop policy if exists "signed-in users read dashboards" on public.dashboards;
create policy "signed-in users read dashboards" on public.dashboards
  for select using (auth.role() = 'authenticated');

drop policy if exists "verification admin manages dashboards" on public.dashboards;
create policy "verification admin manages dashboards" on public.dashboards
  for all using (public.module_access('verification', 'organizations'))
  with check (public.module_access('verification', 'organizations'));

drop policy if exists "members read dashboard members" on public.dashboard_members;
create policy "members read dashboard members" on public.dashboard_members
  for select using (
    user_id = auth.uid() or public.dashboard_access(dashboard_id) or public.is_verification_admin()
  );

drop policy if exists "main admin manages members" on public.dashboard_members;
create policy "main admin manages members" on public.dashboard_members
  for all using (
    public.is_dashboard_main(dashboard_id) or public.is_verification_main()
    or public.module_access('verification', 'organizations') or public.module_access('verification', 'dashboards')
  )
  with check (
    public.is_dashboard_main(dashboard_id) or public.is_verification_main()
    or public.module_access('verification', 'organizations') or public.module_access('verification', 'dashboards')
  );

-- Main Admins' member changes are recorded in the activity log too.
drop policy if exists "main admins log member changes" on public.verification_audit_log;
create policy "main admins log member changes" on public.verification_audit_log
  for insert with check (
    actor_id = auth.uid()
    and action in ('member_added','member_removed','member_permissions','main_admin_changed')
    and exists (select 1 from public.dashboard_members m where m.user_id = auth.uid() and m.is_main)
  );

-- Co-members of a dashboard can see each other's profiles (Members page).
drop policy if exists "dashboard co-members read profiles" on public.profiles;
create policy "dashboard co-members read profiles" on public.profiles
  for select using (
    exists (
      select 1 from public.dashboard_members a
      join public.dashboard_members b on b.dashboard_id = a.dashboard_id
      where a.user_id = auth.uid() and b.user_id = profiles.id
    )
  );

-- ── 4. Store data: membership instead of "seller_id = me" ───────────────────
drop policy if exists "sellers view own products"           on public.products;
drop policy if exists "sellers insert products"             on public.products;
drop policy if exists "sellers update own products"         on public.products;
drop policy if exists "sellers delete own pending products" on public.products;
drop policy if exists "bao can manage all products"         on public.products;
drop policy if exists "store members view products"         on public.products;
drop policy if exists "store members insert products"       on public.products;
drop policy if exists "store members update products"       on public.products;
drop policy if exists "store members delete products"       on public.products;
drop policy if exists "offices manage all products"         on public.products;

create policy "store members view products" on public.products
  for select using (public.store_access(seller_id));
create policy "store members insert products" on public.products
  for insert with check (public.store_access(seller_id, 'products'));
create policy "store members update products" on public.products
  for update using (public.store_access(seller_id, 'products'));
create policy "store members delete products" on public.products
  for delete using (public.store_access(seller_id, 'products') and status in ('pending','draft','rejected'));
create policy "offices manage all products" on public.products
  for all using (public.module_access('bao') or public.module_access('supply_office'))
  with check (public.module_access('bao') or public.module_access('supply_office'));

create or replace function public.auth_seller_has_order(p_order_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.order_items oi
    where oi.order_id = p_order_id and public.store_access(oi.seller_id, 'orders')
  );
$$;

drop policy if exists "read own order items" on public.order_items;
create policy "read own order items" on public.order_items
  for select using (public.auth_buyer_has_order(order_id) or public.store_access(seller_id, 'orders'));

drop policy if exists "product message readers" on public.product_messages;
drop policy if exists "product message senders" on public.product_messages;
create policy "product message readers" on public.product_messages
  for select using (
    auth.uid() = sender_id
    or exists (select 1 from public.products p where p.id = product_id and public.store_access(p.seller_id, 'messages'))
    or public.module_access('bao')
  );
create policy "product message senders" on public.product_messages
  for insert with check (
    auth.uid() = sender_id and (
      exists (select 1 from public.products p where p.id = product_id and public.store_access(p.seller_id, 'messages'))
      or public.module_access('bao')
    )
  );

drop policy if exists "seller updates own profile"        on public.seller_profiles;
drop policy if exists "registrar inserts seller profiles" on public.seller_profiles;
drop policy if exists "admin inserts seller profiles"     on public.seller_profiles;
drop policy if exists "store members update storefront"   on public.seller_profiles;
drop policy if exists "verification admin creates stores" on public.seller_profiles;
create policy "store members update storefront" on public.seller_profiles
  for update using (
    public.store_access(id, 'storefront') or public.module_access('verification', 'organizations') or public.module_access('bao')
  );
create policy "verification admin creates stores" on public.seller_profiles
  for insert with check (public.module_access('verification', 'organizations'));

-- ── 5. Verification data: Verification Admin dashboard only ────────────────
drop policy if exists "staff manage verification requests" on public.verification_requests;
create policy "staff manage verification requests" on public.verification_requests
  for all using (public.is_verification_admin()) with check (public.is_verification_admin());

drop policy if exists "staff read verification docs" on storage.objects;
create policy "staff read verification docs" on storage.objects
  for select to authenticated
  using (bucket_id = 'verification-docs' and public.is_verification_admin());

-- Restricted products unlock by verified affiliation only.
create or replace function public.viewer_role_allowed(allowed text[])
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and coalesce(is_identity_verified, false) and affiliation = any(allowed)
  );
$$;

-- ── 6. Migrate existing role-based accounts into dashboards ─────────────────
insert into public.dashboards (module, name)
select v.module, v.name
from (values ('verification','Verification Admin'), ('bao','BAO'), ('supply_office','Supply Office'), ('cashier','Cashier')) as v(module, name)
where not exists (select 1 from public.dashboards d where d.module = v.module);

-- Cashier and Supply Office each sell through one shared office store.
do $$
declare
  office record;
  office_store uuid;
begin
  for office in select * from (values
      ('cashier', 'cashier', 'University Cashier', 'Official university cashier store'),
      ('supply_office', 'supply_office', 'University Supply Office', 'Official university supply office store')
    ) as t(module, legacy_role, store_name, store_desc)
  loop
    select store_id into office_store from public.dashboards where module = office.module;
    if office_store is null then
      insert into public.seller_profiles (org_name, description, status)
      values (office.store_name, office.store_desc, 'active')
      returning id into office_store;
      update public.dashboards set store_id = office_store where module = office.module;
    end if;

    -- products / orders previously owned by that office's staff accounts move to the office store
    update public.products    set seller_id = office_store where seller_id in (select id from public.profiles where role = office.legacy_role);
    update public.order_items set seller_id = office_store where seller_id in (select id from public.profiles where role = office.legacy_role);
  end loop;
end;
$$;

-- Office staff → members of their office dashboard
insert into public.dashboard_members (dashboard_id, user_id)
select d.id, p.id
from public.profiles p
join public.dashboards d on d.module = case p.role
  when 'admin' then 'verification' when 'bao' then 'bao'
  when 'supply_office' then 'supply_office' when 'cashier' then 'cashier' end
on conflict do nothing;

-- Sellers → one organization dashboard each (store id = their old user id, so data lines up)
insert into public.seller_profiles (id, org_name, status)
select p.id, coalesce(nullif(p.full_name, ''), 'My Shop'), 'active'
from public.profiles p
where p.role = 'seller' and not exists (select 1 from public.seller_profiles s where s.id = p.id);

insert into public.dashboards (module, name, store_id)
select 'seller', s.org_name, s.id
from public.seller_profiles s
where not exists (select 1 from public.dashboards d where d.store_id = s.id);

insert into public.dashboard_members (dashboard_id, user_id, is_main)
select d.id, p.id, true
from public.dashboards d
join public.profiles p on p.id = d.store_id
where d.module = 'seller'
  and not exists (select 1 from public.dashboard_members m where m.dashboard_id = d.id and m.is_main)
on conflict do nothing;

-- Every dashboard without a Main Admin: earliest member becomes Main Admin
update public.dashboard_members m set is_main = true
from (
  select distinct on (m2.dashboard_id) m2.dashboard_id, m2.user_id
  from public.dashboard_members m2
  join public.profiles p on p.id = m2.user_id
  where not exists (select 1 from public.dashboard_members x where x.dashboard_id = m2.dashboard_id and x.is_main)
  order by m2.dashboard_id, p.created_at
) first_member
where m.dashboard_id = first_member.dashboard_id and m.user_id = first_member.user_id;

-- Roles no longer grant access; everyone is a regular user account.
do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'log_profile_changes') then
    alter table public.profiles disable trigger log_profile_changes;
  end if;
  update public.profiles set role = 'buyer' where role is distinct from 'buyer';
  if exists (select 1 from pg_trigger where tgname = 'log_profile_changes') then
    alter table public.profiles enable trigger log_profile_changes;
  end if;
end;
$$;

-- No Registrar anywhere.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('buyer','seller','bao','supply_office','cashier','admin')) not valid;

-- ── 7. Check the result ─────────────────────────────────────────────────────
-- Shows every dashboard and its Main Admin. If "main_admin" is empty for Verification Admin,
-- appoint one:  insert into dashboard_members (dashboard_id, user_id, is_main)
--               select id, '<your user id>', true from dashboards where module = 'verification';
select d.module, d.name, p.full_name as main_admin,
       (select count(*) from public.dashboard_members x where x.dashboard_id = d.id) as members
from public.dashboards d
left join public.dashboard_members m on m.dashboard_id = d.id and m.is_main
left join public.profiles p on p.id = m.user_id
order by d.module, d.name;
