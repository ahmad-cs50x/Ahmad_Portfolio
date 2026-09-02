-- ============================================================
-- 009 �?" Google Drive mirror columns
--
-- Every file row now optionally records the Google Drive file id so the
-- same binary stored on B2 can also be mirrored to Drive. storage_provider
-- already exists and now may be 'backblaze-b2' or 'google-drive'; when B2 is
-- full/unavailable, a new file may be stored on Drive only (storage_provider
-- = 'google-drive').
-- ============================================================

alter table public.files add column if not exists drive_file_id text;

-- Message text bodies may also be mirrored to Drive; record where the object lives.
alter table public.messages add column if not exists body_storage_provider text;
alter table public.messages add column if not exists body_drive_file_id text;
