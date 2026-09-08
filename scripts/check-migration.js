// Quick test to verify migration was applied
const fs = require('fs');
const path = require('path');

console.log('=== Migration Status Check ===\n');

// Check if migration file exists
const migrationPath = path.join(__dirname, '../supabase/migrations/011_add_is_deleted_to_messages.up.sql');
const migrationExists = fs.existsSync(migrationPath);

console.log(`Migration file exists: ${migrationExists ? '✅' : '❌'}`);

// Check if route.js has is_deleted
const routePath = path.join(__dirname, '../app/api/messages/route.js');
const routeContent = fs.readFileSync(routePath, 'utf8');
const hasIsDeletedInQuery = routeContent.includes('is_deleted');
const hasSoftDelete = routeContent.includes('update({ is_deleted: true })');

console.log(`Route queries is_deleted: ${hasIsDeletedInQuery ? '✅' : '❌'}`);
console.log(`Route uses soft delete: ${hasSoftDelete ? '✅' : '❌'}`);

// Check if MessageList has deleted tag
const listPath = path.join(__dirname, '../components/client/MessageList.jsx');
const listContent = fs.readFileSync(listPath, 'utf8');
const hasDeletedTag = listContent.includes('is_deleted') && listContent.includes('🗑️ Deleted');

console.log(`MessageList shows deleted tag: ${hasDeletedTag ? '✅' : '❌'}`);

console.log('\n=== Next Steps ===');
if (!migrationExists) {
  console.log('1. Run migration SQL in Supabase Dashboard:');
  console.log('   ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;');
} else {
  console.log('✅ Migration file is ready');
  console.log('2. Run this SQL in Supabase Dashboard → SQL Editor:');
  console.log('   ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;');
  console.log('   CREATE INDEX IF NOT EXISTS idx_messages_is_deleted ON messages(is_deleted);');
}
console.log('\n3. After running migration, clear chat will work without errors');