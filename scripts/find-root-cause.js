/**
 * Find the root cause of OAuthAccountNotLinked error
 * The adapter is finding user 16fc498b... but Google account points to a7f5c92d...
 * Run: node scripts/find-root-cause.js
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

async function findRootCause() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('=== Find Root Cause of OAuthAccountNotLinked ===\n');

  if (!url || !key) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const targetProviderAccountId = '115428366463251586345';

  // Step 1: Find ALL accounts with this providerAccountId (any provider)
  console.log(`Step 1: Finding ALL accounts with providerAccountId: ${targetProviderAccountId}\n`);
  
  const { data: allAccounts, error: allError } = await supabase
    .from('accounts')
    .select('id, user_id, provider, providerAccountId, password_hash, type')
    .eq('providerAccountId', targetProviderAccountId);

  if (allError) {
    console.error('Error:', allError.message);
    process.exit(1);
  }

  console.log(`  Found ${allAccounts?.length || 0} account(s) with this providerAccountId`);
  if (allAccounts) {
    for (const acc of allAccounts) {
      console.log(`    - Account ID: ${acc.id}`);
      console.log(`      User ID: ${acc.user_id}`);
      console.log(`      Provider: ${acc.provider}`);
      console.log(`      Type: ${acc.type}`);
      console.log(`      Has Password: ${!!acc.password_hash}`);
      console.log('');
    }
  }

  // Step 2: Find ALL users that have these accounts
  console.log('Step 2: Finding ALL users associated with these accounts...\n');
  
  const userIds = [...new Set(allAccounts?.map(a => a.user_id) || [])];
  
  for (const userId of userIds) {
    const { data: user } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', userId)
      .maybeSingle();

    const userAccounts = allAccounts?.filter(a => a.user_id === userId) || [];
    
    console.log(`  User: ${user?.email || 'NOT FOUND'} (${userId})`);
    console.log(`    Accounts: ${userAccounts.length}`);
    for (const acc of userAccounts) {
      console.log(`      - ${acc.provider} (${acc.providerAccountId})`);
    }
    console.log('');
  }

  // Step 3: Check what the adapter would find
  console.log('Step 3: Simulating adapter getUserByAccount query...\n');
  
  const { data: adapterResult } = await supabase
    .from('accounts')
    .select('user_id')
    .eq('provider', 'google')
    .eq('providerAccountId', targetProviderAccountId)
    .maybeSingle();

  if (adapterResult) {
    console.log(`  Adapter finds user_id: ${adapterResult.user_id}`);
    
    const { data: adapterUser } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', adapterResult.user_id)
      .maybeSingle();
    
    console.log(`  Which is user: ${adapterUser?.email || 'NOT FOUND'}`);
    console.log('');
  }

  // Step 4: Find the user that SHOULD be found (the one with the Google email)
  console.log('Step 4: Finding the user that SHOULD be found...\n');
  
  const { data: correctUser } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('email', 'ranaahmadranaahmad741@gmail.com')
    .maybeSingle();

  if (correctUser) {
    console.log(`  Correct user: ${correctUser.email} (${correctUser.id})`);
    
    const { data: correctUserAccounts } = await supabase
      .from('accounts')
      .select('id, provider, providerAccountId')
      .eq('user_id', correctUser.id);
    
    console.log(`  Their accounts: ${correctUserAccounts?.length || 0}`);
    if (correctUserAccounts) {
      for (const acc of correctUserAccounts) {
        console.log(`    - ${acc.provider} (${acc.providerAccountId})`);
      }
    }
    console.log('');
  }

  // Step 5: The fix
  console.log('=== ROOT CAUSE ===\n');
  
  if (allAccounts && allAccounts.length > 1) {
    console.log(`❌ FOUND ${allAccounts.length} accounts with the same providerAccountId!`);
    console.log('   This is causing the OAuthAccountNotLinked error.');
    console.log('');
    console.log('FIX: Delete the incorrect account and keep only the one linked to the correct user.');
  } else if (allAccounts && allAccounts.length === 1) {
    const account = allAccounts[0];
    if (account.user_id === '16fc498b-1297-44d4-8235-4bfb504347cc') {
      console.log('❌ The Google account is linked to the WRONG user!');
      console.log(`   It points to: 16fc498b-1297-44d4-8235-4bfb504347cc (ranaahmadranaahmad471888@gmail.com)`);
      console.log(`   It should point to: ${correctUser?.id} (ranaahmadranaahmad741@gmail.com)`);
      console.log('');
      console.log('FIX: Update the Google account to point to the correct user.');
    } else {
      console.log('✅ The Google account is linked to the correct user.');
      console.log('   The issue might be elsewhere.');
    }
  }
}

findRootCause().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
