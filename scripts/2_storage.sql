-- ============================================================
-- UniMerch — STEP 2: Run AFTER step 1.
-- Creates Storage buckets via Supabase Dashboard OR this SQL.
-- If this step errors, create the buckets manually in
-- Dashboard → Storage → New Bucket instead.
-- ============================================================

-- Buckets (may require superuser; skip if you create them manually)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('order-receipts', 'order-receipts', true)
on conflict (id) do nothing;

-- Verification documents (school ID / COR) — private, contains PII
insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

-- Security-definer helper (redefined here too so this script works standalone)
create or replace function public.is_staff()
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','bao','supply_office')
  );
$$;

-- Storage upload policies
drop policy if exists "authenticated can upload product images" on storage.objects;
drop policy if exists "product images are public"              on storage.objects;
drop policy if exists "authenticated can upload receipts"      on storage.objects;
drop policy if exists "receipts are public"                    on storage.objects;
drop policy if exists "users upload own verification docs"     on storage.objects;
drop policy if exists "users read own verification docs"       on storage.objects;
drop policy if exists "staff read verification docs"           on storage.objects;

create policy "authenticated can upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.role() = 'authenticated');

create policy "product images are public"
  on storage.objects for select using (bucket_id = 'product-images');

create policy "authenticated can upload receipts"
  on storage.objects for insert
  with check (bucket_id = 'order-receipts' and auth.role() = 'authenticated');

create policy "receipts are public"
  on storage.objects for select using (bucket_id = 'order-receipts');

-- Verification docs are namespaced by uploader's user id: "<user_id>/<file>"
create policy "users upload own verification docs"
  on storage.objects for insert
  with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users read own verification docs"
  on storage.objects for select
  using (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "staff read verification docs"
  on storage.objects for select
  using (bucket_id = 'verification-docs' and public.is_staff());

