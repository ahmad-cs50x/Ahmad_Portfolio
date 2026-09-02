-- ============================================================
-- 004 — Add recorded_at to files table + increase attachment limit
-- ============================================================

-- Add recorded_at column to files table for audio/video recordings
alter table public.files add column if not exists recorded_at timestamptz;

-- The message_attachments table already supports multiple files per message
-- via the composite primary key (message_id, file_id).
-- The upload API will be updated to handle multiple files.