-- ============================================================
-- 010 ? Telegram Cloud Storage mirror columns
--
-- Replaces the Google Drive mirror (009). storage_provider may now be
-- 'backblaze-b2' or 'telegram'. Each mirrored object records Telegram
-- file_id (for retrieval) and message_id (for deletion of the channel post).
-- ============================================================

-- Remove the unused Google Drive columns (no Drive upload ever happened).
alter table public.files drop column if exists drive_file_id;
alter table public.messages drop column if exists body_drive_file_id;

-- Telegram mirror ids for file binaries.
alter table public.files add column if not exists tg_file_id text;
alter table public.files add column if not exists tg_message_id text;

-- Telegram mirror ids for message text bodies.
alter table public.messages add column if not exists body_tg_file_id text;
alter table public.messages add column if not exists body_tg_message_id text;
