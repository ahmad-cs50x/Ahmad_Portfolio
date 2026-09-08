/**
 * Delete remaining tables with composite primary keys
 * Run: node scripts/delete-remaining-tables.js
 */
const fs = require('fs');
const path = require('path');

// Load environment
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valParts] = trimmed.split('=');
      const val = valParts.join('=').trim();
      if (key && val) process.env[key] = val;
    }
  });
}

const { createClient } = require('@supabase/supabase-js');

async function deleteRemaining() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('=== Delete Remaining Tables ===\n');

  if (!url || !key) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // Tables with composite primary keys
  const tables = [
    { name: 'blog_post_tags', keys: ['post_id', 'tag_id'] },
    { name: 'project_members', keys: ['project_id', 'profile_id'] },
    { name: 'message_attachments', keys: ['message_id', 'file_id'] },
    { name: 'verification_tokens', keys: ['identifier', 'token'] },
    { name: 'settings', keys: ['key'] },
  ];

  for (const table of tables) {
    try {
      // Use .delete() with a filter that matches all rows
      const { error } = await supabase
        .from(table.name)
        .delete()
        .not(table.keys[0], 'is', null);

      if (error) {
        console.log(`  ⚠️  ${table.name}: ${error.message}`);
      } else {
        console.log(`  ✅ ${table.name}: Deleted`);
      }
    } catch (e) {
      console.log(`  ⚠️  ${table.name}: ${e.message}`);
    }
  }

  console.log('');
  console.log('=== Verification ===');
  
  // Verify all tables are empty
  for (const table of tables) {
    try {
      const { count } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true });
      console.log(`  ${table.name}: ${count || 0} rows`);
    } catch (e) {
      // Ignore
    }
  }

  console.log('');
  console.log('Done!');
}

deleteRemaining().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
