insert into storage.buckets (id, name, public) values
  ('cv-uploads', 'cv-uploads', false),
  ('generated-pdfs', 'generated-pdfs', false);

-- Users can only access files under a folder named with their user id:
-- path convention: {user_id}/{filename}
create policy "cv_uploads_own" on storage.objects
  for all using (
    bucket_id = 'cv-uploads' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'cv-uploads' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "generated_pdfs_own" on storage.objects
  for all using (
    bucket_id = 'generated-pdfs' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'generated-pdfs' and (storage.foldername(name))[1] = auth.uid()::text
  );
