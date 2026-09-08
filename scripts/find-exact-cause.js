/**
 * Find the EXACT cause of OAuthAccountNotLinked
 * The adapter finds user 16fc498b... but Google account has a7f5c92d...
 * There must be a duplicate providerAccountId!
 * Run: node scripts/find-exact-cause.js
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

async function findExactCause() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('=== Find EXACT Cause ===\n');

  if (!url || !key) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // Step 1: Find ALL accounts with providerAccountId 115428366463251586345 (ANY provider)
  console.log('Step 1: Finding ALL accounts with providerAccountId 115428366463251586345 (any provider)\n');
  
  const { data: allAccounts } = await supabase
    .from('accounts')
    .select('id, user_id, provider, providerAccountId, password_hash')
    .eq('providerAccountId', '115428366463251586345');

  console.log(`  Found ${allAccounts?.length || 0} account(s)\n`);
  if (allAccounts) {
    for (const acc of allAccounts) {
      console.log(`  Account ID: ${acc.id}`);
      console.log(`  User ID: ${acc.user_id}`);
      console.log(`  Provider: ${acc.provider}`);
      console.log(`  Has Password: ${!!acc.password_hash}`);
      console.log('');
    }
  }

  // Step 2: Find user 16fc498b-1297-44d4-8235-4bfb504347cc
  console.log('Step 2: Finding user 16fc498b-1297-44d4-8235-4bfb504347cc\n');
  
  const { data: user16fc } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('id', '16fc498b-1297-44d4-8235-4bfb504347cc')
    .maybeSingle();

  console.log(`  User: ${user16fc?.email || 'NOT FOUND'} (${user16fc?.name || 'N/A'})`);
  console.log('');

  // Step 3: Find all accounts for user 16fc498b...
  console.log('Step 3: Finding all accounts for user 16fc498b-1297-44d4-8235-4bfb504347cc\n');
  
  const { data: user16fcAccounts } = await supabase
    .from('accounts')
    .select('id, provider, providerAccountId, password_hash')
    .eq('user_id', '16fc498b-1297-44d4-8235-4bfb504347cc');

  console.log(`  Found ${user16fcAccounts?.length || 0} account(s)\n`);
  if (user16fcAccounts) {
    for (const acc of user16fcAccounts) {
      console.log(`  Account ID: ${acc.id}`);
      console.log(`  Provider: ${acc.provider}`);
      console.log(`  Provider Account ID: ${acc.providerAccountId}`);
      console.log(`  Has Password: ${!!acc.password_hash}`);
      console.log('');
    }
  }

  // Step 4: Find user a7f5c92d...
  console.log('Step 4: Finding user a7f5c92d-1388-4ee5-a301-6cde0418e7f8\n');
  
  const { data: userA7f5 } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('id', 'a7f5c92d-1388-4ee5-a301-6cde0418e7f8')
    .maybeSingle();

  console.log(`  User: ${userA7f5?.email || 'NOT FOUND'} (${userA7f5?.name || 'N/A'})`);
  console.log('');

  // Step 5: Find all accounts for user a7f5c92d...
  console.log('Step 5: Finding all accounts for user a7f5c92d-1388-4ee5-a301-6cde0418e7f8\n');
  
  const { data: userA7f5Accounts } = await supabase
    .from('accounts')
    .select('id, provider, providerAccountId, password_hash')
    .eq('user_id', 'a7f5c92d-1388-4ee5-a301-6cde0418e7f8');

  console.log(`  Found ${userA7f5Accounts?.length || 0} account(s)\n`);
  if (userA7f5Accounts) {
    for (const acc of userA7f5Accounts) {
      console.log(`  Account ID: ${acc.id}`);
      console.log(`  Provider: ${acc.provider}`);
      console.log(`  Provider Account ID: ${acc.providerAccountId}`);
      console.log(`  Has Password: ${!!acc.password_hash}`);
      console.log('');
    }
  }

  // Step 6: THE FIX
  console.log('=== ROOT CAUSE ===\n');
  
  if (user16fcAccounts && user16fcAccounts.length > 0) {
    const duplicateAccount = user16fcAccounts.find(a => a.providerAccountId === '115428366463251586345');
    
    if (duplicateAccount) {
      console.log('❌ FOUND THE PROBLEM!');
      console.log(`   User 16fc498b... (${user16fc?.email}) has an account with providerAccountId 115428366463251586345`);
      console.log(`   But this providerAccountId should belong to user a7f5c92d... (${userA7f5?.email})`);
      console.log('');
      console.log('FIX: Delete the duplicate account from the wrong user.');
      console.log('');
      
      // Delete the duplicate
      console.log('Deleting duplicate account...');
      const { error: deleteError } = await supabase
        .from('accounts')
        .delete()
        .eq('id', duplicateAccount.id);
      
      if (deleteError) {
        console.error('Error:', deleteError.message);
      } else {
        console.log('✅ Deleted duplicate account!');
        console.log('');
        console.log('Now try signing in with Google again.');
      }
    } else {
      console.log('No duplicate found. The issue is elsewhere.');
    }
  } else {
    console.log('User 16fc498b... has no accounts. The issue is elsewhere.');
  }
}

findExactCause().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
