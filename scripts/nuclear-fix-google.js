/**
 * Nuclear option: Delete ALL Google accounts and let Auth.js recreate them
 * This will force Auth.js to create a fresh Google account on next sign-in
 * Run: node scripts/nuclear-fix-google.js
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

async function nuclearFix() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('=== Nuclear Fix: Delete All Google Accounts ===\n');

  if (!url || !key) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // Step 1: Find ALL Google accounts
  console.log('Step 1: Finding ALL Google accounts...\n');
  
  const { data: googleAccounts } = await supabase
    .from('accounts')
    .select('id, user_id, provider, providerAccountId, password_hash')
    .eq('provider', 'google');

  console.log(`  Found ${googleAccounts?.length || 0} Google account(s)\n`);
  if (googleAccounts) {
    for (const acc of googleAccounts) {
      console.log(`  Account ID: ${acc.id}`);
      console.log(`  User ID: ${acc.user_id}`);
      console.log(`  Provider Account ID: ${acc.providerAccountId}`);
      console.log('');
    }
  }

  // Step 2: Delete ALL Google accounts
  console.log('Step 2: Deleting ALL Google accounts...\n');
  
  const { error: deleteError } = await supabase
    .from('accounts')
    .delete()
    .eq('provider', 'google');

  if (deleteError) {
    console.error('Error:', deleteError.message);
    process.exit(1);
  }

  console.log('  ✅ Deleted all Google accounts\n');

  // Step 3: Verify
  console.log('Step 3: Verifying...\n');
  
  const { data: remaining } = await supabase
    .from('accounts')
    .select('id')
    .eq('provider', 'google');

  console.log(`  Remaining Google accounts: ${remaining?.length || 0}\n`);

  // Step 4: Also check for any accounts with the Google providerAccountId
  console.log('Step 4: Checking for any accounts with Google providerAccountId...\n');
  
  const { data: anyAccounts } = await supabase
    .from('accounts')
    .select('id, user_id, provider, providerAccountId')
    .eq('providerAccountId', '115428366463251586345');

  console.log(`  Found ${anyAccounts?.length || 0} account(s) with Google providerAccountId\n`);
  if (anyAccounts && anyAccounts.length > 0) {
    for (const acc of anyAccounts) {
      console.log(`  Account ID: ${acc.id}`);
      console.log(`  User ID: ${acc.user_id}`);
      console.log(`  Provider: ${acc.provider}`);
      console.log('');
    }
  }

  console.log('=== Fix Complete ===');
  console.log('');
  console.log('Next steps:');
  console.log('1. Restart your dev server: npm run dev');
  console.log('2. Clear browser cookies for your site');
  console.log('3. Try signing in with Google again');
  console.log('');
  console.log('Auth.js will create a fresh Google account on sign-in.');
}

nuclearFix().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
