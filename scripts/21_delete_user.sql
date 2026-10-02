-- ============================================================
-- UniMerch — Let the Verification Admin delete a user
-- Deleting an account removes the user from auth.users; everything they own
-- (profile, orders, cart, wishlist, messages, requests, memberships, notifications)
-- is already "on delete cascade". Columns that only *point at* a person — who
-- reviewed a request, who took an admin action, who created a store — had no
-- delete rule, so they blocked the delete. This switches every such column to
-- "on delete set null": the record stays, it just no longer names the deleted user.
-- Safe to re-run. Paste the WHOLE file into the Supabase SQL Editor and click Run.
-- ============================================================

do $$
declare
  r record;
begin
  for r in
    select c.conname, c.conrelid::regclass as tbl, a.attname as col, c.confrelid::regclass as ref
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_namespace n on n.oid = (select relnamespace from pg_class where oid = c.conrelid)
    where c.contype = 'f'
      and n.nspname = 'public'
      and c.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
      and array_length(c.conkey, 1) = 1
      and c.confdeltype in ('a', 'r')   -- no action / restrict
      and not a.attnotnull              -- nullable, so "set null" is possible
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references %s(id) on delete set null',
                   r.tbl, r.conname, r.col, r.ref);
    raise notice 'on delete set null: %.%', r.tbl, r.col;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Check: should return no rows (any row left is a NOT NULL column that still blocks deletes).
select c.conrelid::regclass as table_name, a.attname as column_name
from pg_constraint c
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where c.contype = 'f'
  and n.nspname = 'public'
  and c.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
  and c.confdeltype in ('a', 'r');
