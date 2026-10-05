-- ============================================================
-- UniMerch — Reviews, seller banners, synced carts
-- Run in Supabase SQL Editor AFTER 25_phone_verification.sql. Paste and run the WHOLE file. Safe to re-run.
--
--   • product_reviews  — verified reviews: only buyers with a COMPLETED order containing the product
--                        can rate it (1–5 + comment); product and store averages update automatically
--   • store_banners    — promotional banners stores upload for the homepage carousel, shown only
--                        between starts_at and ends_at; BAO can take any banner down
--   • user_carts       — the signed-in user's cart, synced live across their devices
-- ============================================================

-- ── Reviews ─────────────────────────────────────────────────────────────────
create table if not exists public.product_reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  seller_id   uuid not null references public.seller_profiles(id) on delete cascade,
  buyer_id    uuid not null references public.profiles(id) on delete cascade,
  order_id    uuid not null references public.orders(id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  comment     text check (comment is null or length(comment) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (order_id, product_id)
);
create index if not exists product_reviews_product_idx on public.product_reviews(product_id, created_at desc);
create index if not exists product_reviews_seller_idx on public.product_reviews(seller_id);

alter table public.products add column if not exists rating_avg numeric(3,2) not null default 0;
alter table public.products add column if not exists rating_count integer not null default 0;
alter table public.seller_profiles add column if not exists rating numeric(3,2) default 0;
alter table public.seller_profiles add column if not exists rating_count integer default 0;

-- The buyer must have a completed order from this store that contains the product.
create or replace function public.can_review(p_order uuid, p_product uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.orders o join public.order_items oi on oi.order_id = o.id
    where o.id = p_order and o.buyer_id = auth.uid() and o.status = 'completed' and oi.product_id = p_product
  );
$$;

alter table public.product_reviews enable row level security;

drop policy if exists "reviews are public" on public.product_reviews;
create policy "reviews are public" on public.product_reviews for select using (true);

drop policy if exists "verified buyers review" on public.product_reviews;
create policy "verified buyers review" on public.product_reviews for insert
  with check (buyer_id = auth.uid() and public.can_review(order_id, product_id)
    and seller_id = (select p.seller_id from public.products p where p.id = product_id));

drop policy if exists "buyers edit own reviews" on public.product_reviews;
create policy "buyers edit own reviews" on public.product_reviews for update
  using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());

drop policy if exists "buyers delete own reviews" on public.product_reviews;
create policy "buyers delete own reviews" on public.product_reviews for delete using (buyer_id = auth.uid());

drop policy if exists "bao removes reviews" on public.product_reviews;
create policy "bao removes reviews" on public.product_reviews for delete using (public.module_access('bao'));

-- Buyers can't move a review to another product/order/store when editing
create or replace function public.guard_review_update()
returns trigger language plpgsql as $$
begin
  new.product_id := old.product_id; new.seller_id := old.seller_id;
  new.buyer_id := old.buyer_id; new.order_id := old.order_id;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists guard_review_update on public.product_reviews;
create trigger guard_review_update before update on public.product_reviews
  for each row execute procedure public.guard_review_update();

create or replace function public.refresh_ratings()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p uuid := coalesce(new.product_id, old.product_id);
  s uuid := coalesce(new.seller_id, old.seller_id);
begin
  update public.products set
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.product_reviews where product_id = p), 0),
    rating_count = (select count(*) from public.product_reviews where product_id = p)
  where id = p;
  update public.seller_profiles set
    rating = coalesce((select round(avg(rating)::numeric, 2) from public.product_reviews where seller_id = s), 0),
    rating_count = (select count(*) from public.product_reviews where seller_id = s)
  where id = s;
  return null;
end;
$$;
drop trigger if exists refresh_ratings on public.product_reviews;
create trigger refresh_ratings after insert or update of rating or delete on public.product_reviews
  for each row execute procedure public.refresh_ratings();

-- Tell the store about new reviews
create or replace function public.notify_new_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  dash record;
  pname text;
begin
  select name into pname from public.products where id = new.product_id;
  select * into dash from public.store_dashboard_path(new.seller_id);
  if dash.dashboard_id is not null then
    perform public.notify_dashboard(dash.dashboard_id, 'products', 'product',
      'New ' || new.rating || '★ review', coalesce(pname, 'A product') || coalesce(' — ' || left(new.comment, 100), ''),
      '/marketplace/product/' || new.product_id || '#reviews');
  end if;
  return new;
end;
$$;
drop trigger if exists notify_new_review on public.product_reviews;
create trigger notify_new_review after insert on public.product_reviews
  for each row execute procedure public.notify_new_review();

-- Reviews show the buyer's first name + initial only
create or replace function public.product_review_list(p_product uuid, p_limit int default 20, p_offset int default 0)
returns table (id uuid, rating smallint, comment text, created_at timestamptz, reviewer text, mine boolean)
language sql security definer set search_path = public stable as $$
  select r.id, r.rating, r.comment, r.created_at,
         coalesce(split_part(trim(b.full_name), ' ', 1) || ' ' || left(split_part(trim(b.full_name), ' ', array_length(string_to_array(trim(b.full_name), ' '), 1)), 1) || '.', 'Buyer'),
         r.buyer_id = auth.uid()
  from public.product_reviews r left join public.profiles b on b.id = r.buyer_id
  where r.product_id = p_product
  order by r.created_at desc
  limit least(p_limit, 50) offset p_offset;
$$;

-- Units sold per product (completed orders), for "popular" sorting
alter table public.products add column if not exists sold_count integer not null default 0;
create or replace function public.refresh_sold_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and 'completed' in (new.status, old.status) then
    update public.products p set sold_count = (
      select coalesce(sum(oi.quantity), 0) from public.order_items oi join public.orders o on o.id = oi.order_id
      where oi.product_id = p.id and o.status = 'completed')
    where p.id in (select product_id from public.order_items where order_id = new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists refresh_sold_count on public.orders;
create trigger refresh_sold_count after update of status on public.orders
  for each row execute procedure public.refresh_sold_count();

update public.products p set sold_count = s.qty
from (select oi.product_id, sum(oi.quantity)::int qty from public.order_items oi join public.orders o on o.id = oi.order_id
      where o.status = 'completed' group by oi.product_id) s
where s.product_id = p.id and p.sold_count <> s.qty;

-- ── Seller banners ──────────────────────────────────────────────────────────
create table if not exists public.store_banners (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references public.seller_profiles(id) on delete cascade,
  title       text not null check (length(trim(title)) between 1 and 80),
  subtitle    text check (subtitle is null or length(subtitle) <= 160),
  image_url   text,
  link_url    text check (link_url is null or link_url ~ '^/'),   -- in-app links only
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at <= starts_at + interval '90 days')
);
create index if not exists store_banners_active_idx on public.store_banners(starts_at, ends_at);

alter table public.store_banners enable row level security;

drop policy if exists "running banners are public" on public.store_banners;
create policy "running banners are public" on public.store_banners for select
  using (now() between starts_at and ends_at
         and exists (select 1 from public.seller_profiles s where s.id = seller_id and coalesce(s.status, 'active') = 'active'));

drop policy if exists "stores manage own banners" on public.store_banners;
create policy "stores manage own banners" on public.store_banners for all
  using (public.store_access(seller_id, 'storefront')) with check (public.store_access(seller_id, 'storefront'));

drop policy if exists "bao reviews banners" on public.store_banners;
create policy "bao reviews banners" on public.store_banners for select using (public.module_access('bao'));
drop policy if exists "bao removes banners" on public.store_banners;
create policy "bao removes banners" on public.store_banners for delete using (public.module_access('bao'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-banners', 'store-banners', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Files live under "<store id>/…" and only that store's staff may upload or remove them
drop policy if exists "stores upload banners" on storage.objects;
create policy "stores upload banners" on storage.objects for insert
  with check (bucket_id = 'store-banners' and public.store_access(((storage.foldername(name))[1])::uuid, 'storefront'));
drop policy if exists "stores delete banners" on storage.objects;
create policy "stores delete banners" on storage.objects for delete
  using (bucket_id = 'store-banners' and public.store_access(((storage.foldername(name))[1])::uuid, 'storefront'));
drop policy if exists "banner images are public" on storage.objects;
create policy "banner images are public" on storage.objects for select using (bucket_id = 'store-banners');

-- ── Cart synced across devices ──────────────────────────────────────────────
create table if not exists public.user_carts (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  items       jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 100),
  device      text,            -- which browser saved it last (so it ignores its own echo)
  updated_at  timestamptz not null default now()
);
alter table public.user_carts enable row level security;
drop policy if exists "users own their cart" on public.user_carts;
create policy "users own their cart" on public.user_carts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Realtime ────────────────────────────────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.user_carts;
exception when duplicate_object or undefined_object then null; end $$;
do $$ begin
  if to_regclass('public.notifications') is not null then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception when duplicate_object or undefined_object then null; end $$;

notify pgrst, 'reload schema';
