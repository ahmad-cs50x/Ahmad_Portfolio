/**
 * Delete ALL accounts data from the database
 * This will remove ALL users, accounts, sessions, profiles, invites, messages, files, etc.
 * 
 * WARNING: This is IRREVERSIBLE. All data will be permanently deleted.
 * 
 * Run: node scripts/delete-all-data.js
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function deleteAllData() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('=== DELETE ALL DATABASE DATA ===\n');
  console.log('⚠️  WARNING: This will permanently delete ALL data from your database!');
  console.log('   This includes:');
  console.log('   - All users and accounts');
  console.log('   - All sessions');
  console.log('   - All profiles');
  console.log('   - All invites');
  console.log('   - All messages');
  console.log('   - All files metadata');
  console.log('   - All notifications');
  console.log('   - All activity logs');
  console.log('   - All storage usage records');
  console.log('');

  if (!url || !key) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // Get counts before deletion
  console.log('Current data counts:');
  const tables = [
    { name: 'users', label: 'Users' },
    { name: 'accounts', label: 'Accounts' },
    { name: 'sessions', label: 'Sessions' },
    { name: 'verification_tokens', label: 'Verification Tokens' },
    { name: 'profiles', label: 'Profiles' },
    { name: 'invites', label: 'Invites' },
    { name: 'messages', label: 'Messages' },
    { name: 'message_attachments', label: 'Message Attachments' },
    { name: 'files', label: 'Files' },
    { name: 'notifications', label: 'Notifications' },
    { name: 'activity_logs', label: 'Activity Logs' },
    { name: 'storage_usage', label: 'Storage Usage' },
    { name: 'clients', label: 'Clients' },
    { name: 'projects', label: 'Projects' },
    { name: 'project_members', label: 'Project Members' },
    { name: 'milestones', label: 'Milestones' },
    { name: 'blog_posts', label: 'Blog Posts' },
    { name: 'blog_categories', label: 'Blog Categories' },
    { name: 'blog_tags', label: 'Blog Tags' },
    { name: 'blog_post_tags', label: 'Blog Post Tags' },
    { name: 'settings', label: 'Settings' },
  ];

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`  ${table.label}: ${count || 0}`);
      }
    } catch (e) {
      // Table might not exist
    }
  }
  console.log('');

  // Ask for confirmation
  const answer = await askQuestion('Type "DELETE ALL" to confirm: ');
  
  if (answer !== 'DELETE ALL') {
    console.log('Cancelled. No data was deleted.');
    rl.close();
    return;
  }

  console.log('');
  console.log('Deleting all data...\n');

  // Delete in order (respecting foreign key constraints)
  const deleteOrder = [
    'blog_post_tags',
    'blog_tags',
    'blog_categories',
    'blog_posts',
    'project_members',
    'milestones',
    'projects',
    'messages',
    'message_attachments',
    'notifications',
    'activity_logs',
    'storage_usage',
    'files',
    'invites',
    'profiles',
    'clients',
    'sessions',
    'verification_tokens',
    'accounts',
    'users',
    'settings',
  ];

  let deletedCount = 0;
  let errorCount = 0;

  for (const table of deleteOrder) {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

      if (error) {
        // Try with a different approach for tables without 'id' column
        const { error: error2 } = await supabase
          .from(table)
          .delete()
          .not('id', 'is', null);
        
        if (error2) {
          console.log(`  ⚠️  ${table}: ${error2.message}`);
          errorCount++;
        } else {
          console.log(`  ✅ ${table}: Deleted`);
          deletedCount++;
        }
      } else {
        console.log(`  ✅ ${table}: Deleted`);
        deletedCount++;
      }
    } catch (e) {
      console.log(`  ⚠️  ${table}: ${e.message}`);
      errorCount++;
    }
  }

  console.log('');
  console.log('=== Deletion Complete ===');
  console.log(`  Tables processed: ${deletedCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log('');
  console.log('All data has been deleted from the database.');
  console.log('You can now start fresh with new sign-ups.');

  rl.close();
}

deleteAllData().catch(err => {
  console.error('Fatal error:', err.message);
  rl.close();
  process.exit(1);
});
