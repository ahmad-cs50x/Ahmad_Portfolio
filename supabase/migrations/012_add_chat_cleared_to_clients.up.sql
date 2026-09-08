-- Add chat_cleared_at timestamp to clients table
-- This tracks when a client has cleared their chat history
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS chat_cleared_at TIMESTAMPTZ;

-- Create index for performance when checking cleared status
CREATE INDEX IF NOT EXISTS idx_clients_chat_cleared ON clients(chat_cleared_at) WHERE chat_cleared_at IS NOT NULL;