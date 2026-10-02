-- ============================================================
-- UniMerch — In-app notifications (the bell icon)
-- Run in Supabase SQL Editor AFTER setup_all.sql. Paste and run the WHOLE file. Safe to re-run.
--
-- Notifications are created automatically by the database when something happens:
--   buyers      → their order status changes · their verification is decided
--   stores      → a new order arrives · BAO approves / rejects / pulls a product · BAO reviews a sales report
--   Verification Admin → new verification request · a seller reports an account
--   BAO         → a product awaits approval · a store submits a sales report
-- ============================================================

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null default 'info',
  title       text not null,
  body        text,
  href        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists "users mark own notifications read" on public.notifications;
create policy "users mark own notifications read" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users delete own notifications" on public.notifications;
create policy "users delete own notifications" on public.notifications
  for delete using (user_id = auth.uid());

-- ── Helpers ─────────────────────────────────────────────────────────────────
create or replace function public.notify_user(p_user uuid, p_kind text, p_title text, p_body text, p_href text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, href)
  select p_user, p_kind, p_title, p_body, p_href
  where p_user is not null and p_user is distinct from auth.uid();   -- don't notify people about their own actions
$$;

-- Everyone on a dashboard who can use `p_perm` (Main Admins always).
create or replace function public.notify_dashboard(p_dashboard uuid, p_perm text, p_kind text, p_title text, p_body text, p_href text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, href)
  select m.user_id, p_kind, p_title, p_body, p_href
  from public.dashboard_members m
  where m.dashboard_id = p_dashboard
    and (m.is_main or p_perm is null or p_perm = any(m.permissions))
    and m.user_id is distinct from auth.uid();
$$;

create or replace function public.store_dashboard_path(p_store uuid)
returns table (dashboard_id uuid, base text)
language sql security definer set search_path = public stable as $$
  select d.id, case d.module when 'cashier' then '/cashier' when 'supply_office' then '/supply-office' else '/seller' end
  from public.dashboards d where d.store_id = p_store limit 1;
$$;

-- ── Orders ──────────────────────────────────────────────────────────────────
create or replace function public.notify_order_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  dash record;
  code text := upper(left(new.id::text, 8));
  label text;
begin
  if tg_op = 'INSERT' then
    if new.seller_id is not null then
      select * into dash from public.store_dashboard_path(new.seller_id);
      if dash.dashboard_id is not null then
        perform public.notify_dashboard(dash.dashboard_id, 'orders', 'order', 'New order #' || code,
          'A buyer placed an order worth ₱' || to_char(new.total, 'FM999,999,990.00') || '.', dash.base || '/orders');
      end if;
    end if;
  elsif new.status is distinct from old.status then
    label := case new.status
      when 'paid' then 'Payment confirmed — your items are being prepared'
      when 'partially_paid' then 'Partial payment received'
      when 'ready_for_pickup' then 'Ready for pickup'
      when 'completed' then 'Order completed'
      when 'cancelled' then 'Order cancelled'
      else 'Order updated' end;
    perform public.notify_user(new.buyer_id, 'order', label, 'Order #' || code, '/marketplace/orders/' || new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists notify_order_events on public.orders;
create trigger notify_order_events after insert or update of status on public.orders for each row execute procedure public.notify_order_events();

-- ── Verification ────────────────────────────────────────────────────────────
create or replace function public.notify_verification_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  vdash uuid;
begin
  if tg_op = 'INSERT' then
    select id into vdash from public.dashboards where module = 'verification';
    if vdash is not null then
      perform public.notify_dashboard(vdash, 'queue', 'verification', 'New verification request',
        coalesce(new.full_name, 'A user') || ' applied as ' || new.claimed_affiliation || '.', '/admin/queue/' || new.id);
    end if;
  elsif new.status is distinct from old.status and new.status in ('approved','rejected','needs_resubmission') then
    perform public.notify_user(new.user_id, 'verification',
      case new.status when 'approved' then 'You are verified!' when 'rejected' then 'Verification declined' else 'Please resubmit your documents' end,
      coalesce(new.review_reason, case new.status when 'approved' then 'Restricted items for your group are now unlocked.' else 'Open your profile for details.' end),
      '/marketplace/account');
  end if;
  return new;
end;
$$;

drop trigger if exists notify_verification_events on public.verification_requests;
create trigger notify_verification_events after insert or update of status on public.verification_requests for each row execute procedure public.notify_verification_events();

-- ── Products (approval / rejection / pull-out) ──────────────────────────────
create or replace function public.notify_product_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  dash record;
  bao uuid;
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status = 'pending' then
      select id into bao from public.dashboards where module = 'bao';
      if bao is not null then
        perform public.notify_dashboard(bao, 'approvals', 'product', 'Product awaiting approval', new.name, '/bao/approvals');
      end if;
    elsif tg_op = 'UPDATE' and new.status in ('approved','rejected','pulled') then
      select * into dash from public.store_dashboard_path(new.seller_id);
      if dash.dashboard_id is not null then
        perform public.notify_dashboard(dash.dashboard_id, 'products', 'product',
          case new.status when 'approved' then 'Product approved — now live' when 'rejected' then 'Product rejected by BAO' else 'Product pulled out by BAO' end,
          new.name || coalesce(' — ' || new.bao_comment, ''), dash.base || '/products');
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_product_events on public.products;
create trigger notify_product_events after insert or update of status on public.products for each row execute procedure public.notify_product_events();

-- ── Sales reports ───────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.sales_reports') is not null then
    execute $f$
      create or replace function public.notify_report_events()
      returns trigger language plpgsql security definer set search_path = public as $b$
      declare
        bao uuid;
        dash record;
      begin
        if tg_op = 'INSERT' then
          select id into bao from public.dashboards where module = 'bao';
          if bao is not null then
            perform public.notify_dashboard(bao, 'reports', 'report', 'New sales report',
              'Period ' || new.period_start || ' to ' || new.period_end || '.', '/bao/reports?open=' || new.id);
          end if;
        elsif new.status is distinct from old.status then
          select * into dash from public.store_dashboard_path(new.store_id);
          perform public.notify_user(new.submitted_by, 'report',
            case new.status when 'acknowledged' then 'BAO acknowledged your sales report' else 'BAO flagged your sales report' end,
            coalesce(new.bao_note, 'Period ' || new.period_start || ' to ' || new.period_end || '.'),
            coalesce(dash.base, '/seller') || '/reports');
        end if;
        return new;
      end;
      $b$;
    $f$;
    execute 'drop trigger if exists notify_report_events on public.sales_reports';
    execute 'create trigger notify_report_events after insert or update of status on public.sales_reports for each row execute procedure public.notify_report_events()';
  end if;
end;
$$;

-- ── Account reports (dummy accounts) ────────────────────────────────────────
do $$
begin
  if to_regclass('public.account_reports') is not null then
    execute $f$
      create or replace function public.notify_account_report()
      returns trigger language plpgsql security definer set search_path = public as $b$
      declare
        vdash uuid;
      begin
        select id into vdash from public.dashboards where module = 'verification';
        if vdash is not null then
          perform public.notify_dashboard(vdash, 'reports', 'report', 'Account reported by a seller',
            replace(new.reason, '_', ' ') || coalesce(' — ' || new.details, ''), '/admin/reports');
        end if;
        return new;
      end;
      $b$;
    $f$;
    execute 'drop trigger if exists notify_account_report on public.account_reports';
    execute 'create trigger notify_account_report after insert on public.account_reports for each row execute procedure public.notify_account_report()';
  end if;
end;
$$;

notify pgrst, 'reload schema';
