-- ============================================================
-- UniMerch — Storage for verification documents (I.D. / COR)
-- Run in Supabase SQL Editor after 7_verification_apply.sql. Safe to re-run.
-- If the bucket insert errors, create it manually:
--   Dashboard → Storage → New bucket → name "verification-docs", Public OFF
-- ============================================================

insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

-- Files are stored as "<user_id>/<file>", so users can only touch their own folder.
drop policy if exists "users upload own verification docs" on storage.objects;
create policy "users upload own verification docs"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users read own verification docs" on storage.objects;
create policy "users read own verification docs"
  on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);

-- Verification Admin / BAO can open any uploaded document (signed links on /admin)
drop policy if exists "staff read verification docs" on storage.objects;
create policy "staff read verification docs"
  on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and public.is_staff());
