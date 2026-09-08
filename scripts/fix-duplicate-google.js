/**
 * Find and fix duplicate Google accounts with same providerAccountId
 * Run: node scripts/fix-duplicate-google.js
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

async function fixDuplicateGoogle() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('=== Fix Duplicate Google Accounts ===\n');

  if (!url || !key) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // Step 1: Find ALL Google accounts
  console.log('Step 1: Finding ALL Google accounts...');
  const { data: googleAccounts, error: googleError } = await supabase
    .from('accounts')
    .select('id, user_id, provider, providerAccountId, password_hash, access_token')
    .eq('provider', 'google');

  if (googleError) {
    console.error('Error finding Google accounts:', googleError.message);
    process.exit(1);
  }

  console.log(`  Found ${googleAccounts?.length || 0} Google account(s)`);
  if (googleAccounts) {
    for (const acc of googleAccounts) {
      console.log(`    - Account ID: ${acc.id}`);
      console.log(`      User ID: ${acc.user_id}`);
      console.log(`      Provider Account ID: ${acc.providerAccountId}`);
      console.log('');
    }
  }

  // Step 2: Find duplicate providerAccountIds
  console.log('Step 2: Checking for duplicate providerAccountIds...');
  const providerAccountMap = {};
  for (const acc of googleAccounts || []) {
    if (!providerAccountMap[acc.providerAccountId]) {
      providerAccountMap[acc.providerAccountId] = [];
    }
    providerAccountMap[acc.providerAccountId].push(acc);
  }

  const duplicates = Object.entries(providerAccountMap).filter(([_, accounts]) => accounts.length > 1);

  if (duplicates.length === 0) {
    console.log('  No duplicate providerAccountIds found.');
    console.log('');
    console.log('Step 3: Checking for the specific providerAccountId from error...');
    const targetProviderAccountId = '115428366463251586345';
    
    const { data: targetAccounts } = await supabase
      .from('accounts')
      .select('id, user_id, provider, providerAccountId')
      .eq('providerAccountId', targetProviderAccountId);

    console.log(`  Found ${targetAccounts?.length || 0} account(s) with providerAccountId ${targetProviderAccountId}`);
    if (targetAccounts) {
      for (const acc of targetAccounts) {
        console.log(`    - Account ID: ${acc.id}, User ID: ${acc.user_id}, Provider: ${acc.provider}`);
      }
    }
    console.log('');

    // Step 4: Find the user that the adapter is finding
    console.log('Step 4: Finding user 16fc498b-1297-44d4-8235-4bfb504347cc...');
    const { data: adapterUser } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', '16fc498b-1297-44d4-8235-4bfb504347cc')
      .maybeSingle();

    if (adapterUser) {
      console.log(`  Found: ${adapterUser.email} (${adapterUser.name})`);
    } else {
      console.log('  User not found! This is the problem.');
    }
    console.log('');

    // Step 5: Find what accounts this user has
    console.log('Step 5: Finding accounts for user 16fc498b-1297-44d4-8235-4bfb504347cc...');
    const { data: adapterUserAccounts } = await supabase
      .from('accounts')
      .select('id, provider, providerAccountId')
      .eq('user_id', '16fc498b-1297-44d4-8235-4bfb504347cc');

    console.log(`  Found ${adapterUserAccounts?.length || 0} account(s)`);
    if (adapterUserAccounts) {
      for (const acc of adapterUserAccounts) {
        console.log(`    - ${acc.provider} (${acc.providerAccountId})`);
      }
    }
    return;
  }

  console.log(`  Found ${duplicates.length} duplicate(s)!`);
  for (const [providerAccountId, accounts] of duplicates) {
    console.log(`    Provider Account ID: ${providerAccountId}`);
    for (const acc of accounts) {
      console.log(`      - Account: ${acc.id}, User: ${acc.user_id}`);
    }
  }
}

fixDuplicateGoogle().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
