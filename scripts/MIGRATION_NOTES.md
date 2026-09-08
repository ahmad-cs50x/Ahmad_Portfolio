# Add is_deleted column to messages table

Run this SQL in your Supabase Dashboard → SQL Editor:

```sql
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
```

After running the migration, the delete functionality will mark messages as deleted instead of permanently removing them.