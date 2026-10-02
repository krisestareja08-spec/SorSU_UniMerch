-- ============================================================
-- UniMerch — BAO flags sellers for violations
-- Run in Supabase SQL Editor AFTER 17_notifications.sql. Paste and run the WHOLE file. Safe to re-run.
--
--   • store_violations — BAO records a violation against a store (optionally for one product)
--   • the store's dashboard members are notified automatically
-- ============================================================

create table if not exists public.store_violations (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.seller_profiles(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,
  product_name text,
  severity    text not null default 'warning' check (severity in ('warning','serious')),
  reason      text not null,
  flagged_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists store_violations_store_idx on public.store_violations(store_id, created_at desc);

alter table public.store_violations enable row level security;

drop policy if exists "bao manages violations" on public.store_violations;
create policy "bao manages violations" on public.store_violations
  for all using (public.module_access('bao')) with check (public.module_access('bao') and flagged_by = auth.uid());

drop policy if exists "stores read own violations" on public.store_violations;
create policy "stores read own violations" on public.store_violations
  for select using (public.store_access(store_id));

-- Notify the store when BAO flags it
create or replace function public.notify_store_violation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  dash record;
begin
  select * into dash from public.store_dashboard_path(new.store_id);
  if dash.dashboard_id is not null then
    perform public.notify_dashboard(dash.dashboard_id, null, 'violation',
      case new.severity when 'serious' then 'Serious violation flagged by BAO' else 'Violation warning from BAO' end,
      coalesce(new.product_name || ': ', '') || new.reason, dash.base || '/products');
  end if;
  return new;
end;
$$;

drop trigger if exists notify_store_violation on public.store_violations;
create trigger notify_store_violation after insert on public.store_violations for each row execute procedure public.notify_store_violation();

notify pgrst, 'reload schema';
