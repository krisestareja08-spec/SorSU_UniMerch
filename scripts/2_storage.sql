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

-- Storage upload policies
drop policy if exists "authenticated can upload product images" on storage.objects;
drop policy if exists "product images are public"              on storage.objects;
drop policy if exists "authenticated can upload receipts"      on storage.objects;
drop policy if exists "receipts are public"                    on storage.objects;

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
