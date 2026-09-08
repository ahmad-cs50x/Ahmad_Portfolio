-- Migrate down: remove the added fields and indexes
DROP INDEX IF EXISTS idx_messages_client_id;
DROP INDEX IF EXISTS idx_messages_client_message_id;
DROP INDEX IF EXISTS idx_messages_status;
DROP INDEX IF EXISTS idx_messages_sent_at;
DROP INDEX IF EXISTS idx_messages_client_id_status;

ALTER TABLE messages
  DROP COLUMN IF EXISTS client_message_id,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS sent_at,
  DROP COLUMN IF EXISTS read_at,
  DROP COLUMN IF EXISTS telegram_file_id,
  DROP COLUMN IF EXISTS telegram_file_unique_id,
  DROP COLUMN IF EXISTS telegram_file_name,
  DROP COLUMN IF EXISTS telegram_file_mimetype,
  DROP COLUMN IF EXISTS telegram_file_size,
  DROP COLUMN IF EXISTS telegram_message_id,
  DROP COLUMN IF EXISTS attachment_type,
  DROP COLUMN IF EXISTS media_duration,
  DROP COLUMN IF EXISTS media_width,
  DROP COLUMN IF EXISTS media_height;