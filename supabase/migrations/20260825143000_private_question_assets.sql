insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'question-assets',
  'question-assets',
  false,
  1048576,
  array['image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Intentionally no storage.objects policies. Assets remain deny-by-default
-- until the application serves short-lived signed URLs after checking a
-- customer's bank entitlement on the server.
