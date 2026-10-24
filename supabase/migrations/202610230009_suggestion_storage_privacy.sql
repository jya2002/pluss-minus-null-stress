-- Do not expose upload directories (which contain account UUIDs) through
-- public Storage listings. Public image URLs continue to serve shared images.
-- No files are deleted, moved or made private. Other buckets are unchanged.
alter policy asset_read on storage.objects using (
 bucket_id in ('event-images','avatars')
 or (bucket_id='suggestion-images' and
     ((storage.foldername(name))[1]=auth.uid()::text or private.is_staff()))
);
