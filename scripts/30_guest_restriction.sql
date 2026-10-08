-- ============================================================
-- UniMerch — "Guest" option for restricted products (replaces "Alumni")
-- Run in Supabase SQL Editor AFTER 29_preorder_id_penalties.sql. Paste and run the WHOLE file. Safe to re-run.
--
-- A restricted product lists who may see and buy it (products.allowed_roles):
--   • student / faculty / staff — a VERIFIED university member with that affiliation
--   • guest                     — any signed-in user who is NOT a verified university member
--                                 (external accounts, and members whose verification isn't approved)
-- "alumni" is no longer offered; products restricted to alumni now allow guests instead.
-- ============================================================

create or replace function public.viewer_role_allowed(allowed text[])
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (
      (coalesce(is_identity_verified, false) and affiliation = any(allowed))
      or ('guest' = any(allowed) and (not coalesce(is_identity_verified, false) or affiliation = 'external'))
    )
  );
$$;

-- Existing products restricted to alumni → guests
update public.products
set allowed_roles = array(select distinct case when r = 'alumni' then 'guest' else r end from unnest(allowed_roles) as r)
where 'alumni' = any(allowed_roles);

notify pgrst, 'reload schema';

-- Check: restricted products and who they allow
select name, allowed_roles from public.products where is_restricted order by name;
