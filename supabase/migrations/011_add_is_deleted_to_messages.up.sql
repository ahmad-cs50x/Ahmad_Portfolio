-- Migration to add is_deleted column to messages table
-- Run this in Supabase SQL Editor

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_messages_is_deleted ON messages(is_deleted);