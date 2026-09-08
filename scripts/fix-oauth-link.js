/**
 * Fix the OAuthAccountNotLinked error
 * The adapter is finding the wrong user for the Google account
 * Run: node scripts/fix-oauth-link.js
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

async function fixOAuthLink() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('=== Fix OAuthAccountNotLinked Error ===\n');

  if (!url || !key) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const targetProviderAccountId = '115428366463251586345';
  const targetEmail = 'ranaahmadranaahmad741@gmail.com';

  // Step 1: Find ALL accounts with this providerAccountId (any provider)
  console.log(`Step 1: Finding ALL accounts with providerAccountId: ${targetProviderAccountId}\n`);
  
  const { data: allAccounts, error: allError } = await supabase
    .from('accounts')
    .select('id, user_id, provider, providerAccountId, password_hash, type, access_token, refresh_token')
    .eq('providerAccountId', targetProviderAccountId);

  if (allError) {
    console.error('Error:', allError.message);
    process.exit(1);
  }

  console.log(`  Found ${allAccounts?.length || 0} account(s)\n`);
  if (allAccounts) {
    for (const acc of allAccounts) {
      console.log(`  Account ID: ${acc.id}`);
      console.log(`  User ID: ${acc.user_id}`);
      console.log(`  Provider: ${acc.provider}`);
      console.log(`  Type: ${acc.type}`);
      console.log(`  Has Password: ${!!acc.password_hash}`);
      console.log('');
    }
  }

  // Step 2: Find the user for each account
  console.log('Step 2: Finding users for each account...\n');
  
  const userIds = [...new Set(allAccounts?.map(a => a.user_id) || [])];
  const users = {};
  
  for (const userId of userIds) {
    const { data: user } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', userId)
      .maybeSingle();
    
    users[userId] = user;
    console.log(`  User ${userId}:`);
    console.log(`    Email: ${user?.email || 'NOT FOUND'}`);
    console.log(`    Name: ${user?.name || 'NOT FOUND'}`);
    console.log('');
  }

  // Step 3: Find the correct user (the one with the target email)
  console.log('Step 3: Finding correct user...\n');
  
  const { data: correctUser } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('email', targetEmail.toLowerCase())
    .maybeSingle();

  if (!correctUser) {
    console.log(`  ❌ No user found with email ${targetEmail}`);
    console.log('  This means we need to create the user or fix the email.');
    return;
  }

  console.log(`  Correct user: ${correctUser.email} (${correctUser.id})`);
  console.log('');

  // Step 4: Check if Google account points to correct user
  console.log('Step 4: Checking Google account...\n');
  
  const googleAccount = allAccounts?.find(a => a.provider === 'google');
  
  if (!googleAccount) {
    console.log('  ❌ No Google account found!');
    console.log('  This means the Google account was never created.');
    return;
  }

  if (googleAccount.user_id === correctUser.id) {
    console.log('  ✅ Google account points to correct user!');
    console.log('');
    console.log('  The issue might be:');
    console.log('  1. Browser cookies - try clearing them');
    console.log('  2. Cached session - try incognito mode');
    console.log('  3. Multiple Google accounts - make sure you\'re using the right one');
    return;
  }

  // Step 5: Fix the Google account
  console.log('Step 5: Fixing Google account...\n');
  console.log(`  Current user_id: ${googleAccount.user_id} (${users[googleAccount.user_id]?.email})`);
  console.log(`  Correct user_id: ${correctUser.id} (${correctUser.email})`);
  console.log('');

  // Check if correct user already has a Google account
  const { data: existingGoogle } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', correctUser.id)
    .eq('provider', 'google')
    .maybeSingle();

  if (existingGoogle) {
    console.log('  Correct user already has a Google account. Deleting the incorrect one...');
    const { error: deleteError } = await supabase
      .from('accounts')
      .delete()
      .eq('id', googleAccount.id);
    
    if (deleteError) {
      console.error('  Error:', deleteError.message);
    } else {
      console.log('  ✅ Deleted incorrect Google account');
    }
  } else {
    console.log('  Updating Google account to point to correct user...');
    const { error: updateError } = await supabase
      .from('accounts')
      .update({ user_id: correctUser.id })
      .eq('id', googleAccount.id);
    
    if (updateError) {
      console.error('  Error:', updateError.message);
    } else {
      console.log('  ✅ Updated Google account');
    }
  }

  // Step 6: Delete duplicate user if it has no accounts
  console.log('');
  console.log('Step 6: Cleaning up...\n');
  
  const wrongUserId = googleAccount.user_id;
  if (wrongUserId !== correctUser.id) {
    const { data: wrongUserAccounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', wrongUserId);

    if (!wrongUserAccounts || wrongUserAccounts.length === 0) {
      console.log(`  User ${wrongUserId} has no accounts. Deleting...`);
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', wrongUserId);
      
      if (deleteError) {
        console.error('  Error:', deleteError.message);
      } else {
        console.log('  ✅ Deleted empty user');
      }
    } else {
      console.log(`  User ${wrongUserId} still has ${wrongUserAccounts.length} account(s). Keeping.`);
    }
  }

  console.log('');
  console.log('=== Fix Complete ===');
  console.log('Try signing in with Google again!');
}

fixOAuthLink().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
