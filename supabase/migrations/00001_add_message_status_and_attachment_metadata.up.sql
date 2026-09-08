#!/usr/bin/env node
// migrations/add-message-status-and-attachment-metadata.sql
// Adds fields for optimistic messaging, send/read states, and Telegram attachment metadata
// to the messages table in Supabase.

-- 1. Track client-side optimistic message IDs for reconciliation
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS client_message_id TEXT UNIQUE;

-- 2. Message status tracking (sending → sent → read)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent'
    CHECK (status IN ('sending', 'sent', 'read', 'failed'));

-- 3. Timestamps for send/read tracking
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- 4. Telegram attachment metadata (when the message body IS the attachment)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS telegram_file_id TEXT,
  ADD COLUMN IF NOT EXISTS telegram_file_unique_id TEXT,
  ADD COLUMN IF NOT EXISTS telegram_file_name TEXT,
  ADD COLUMN IF NOT EXISTS telegram_file_mimetype TEXT,
  ADD COLUMN IF NOT EXISTS telegram_file_size BIGINT,
  ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT,
  ADD COLUMN IF NOT EXISTS media_duration REAL,
  ADD COLUMN IF NOT EXISTS media_width INTEGER,
  ADD COLUMN IF NOT EXISTS media_height INTEGER;

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_client_id ON messages USING HASH (client_id);
CREATE INDEX IF NOT EXISTS idx_messages_client_message_id ON messages (client_message_id) WHERE client_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages (status);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages (sent_at);
CREATE INDEX IF NOT EXISTS idx_messages_client_id_status ON messages (client_id, status);