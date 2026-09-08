# Migration: Add is_deleted column to messages table

## Manual Migration (Required)

Since the automated migration script cannot connect to the database without the SUPABASE_DB_PASSWORD, please run the following SQL manually in your Supabase Dashboard:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/rnvzihxvzxvzwrdaalja
2. Navigate to **SQL Editor**
3. Run this SQL:

```sql
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_messages_is_deleted ON messages(is_deleted);
```

## What This Does

- Adds an `is_deleted` column to the `messages` table
- Messages marked as deleted will show a "Deleted" tag in the admin panel
- The message content is preserved but hidden from regular users
- Admins can see which messages were deleted by users

## After Running Migration

The application will automatically:
1. Mark messages as `is_deleted = true` when users delete them
2. Show "Deleted" tag for deleted messages in admin inbox
3. Preserve message history for audit purposes