/**
 * Fix Google account linked to wrong user
 * The Google account points to a different user ID than the one with the matching email
 * Run: node scripts/fix-google-account-link.js
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

async function fixGoogleAccountLink() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('=== Fix Google Account Link ===\n');

  if (!url || !key) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // Step 1: Find the Google account
  console.log('Step 1: Finding Google account...');
  const { data: googleAccount, error: googleError } = await supabase
    .from('accounts')
    .select('id, user_id, provider, providerAccountId')
    .eq('provider', 'google')
    .maybeSingle();

  if (googleError) {
    console.error('Error finding Google account:', googleError.message);
    process.exit(1);
  }

  if (!googleAccount) {
    console.log('No Google account found in database.');
    console.log('This means the Google account was never linked.');
    return;
  }

  console.log(`  Found Google account:`);
  console.log(`    Account ID: ${googleAccount.id}`);
  console.log(`    User ID: ${googleAccount.user_id}`);
  console.log(`    Provider Account ID: ${googleAccount.providerAccountId}`);
  console.log('');

  // Step 2: Find the user that the Google account points to
  console.log('Step 2: Finding user that Google account points to...');
  const { data: googleUser, error: googleUserError } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('id', googleAccount.user_id)
    .maybeSingle();

  if (googleUserError) {
    console.error('Error finding Google user:', googleUserError.message);
    process.exit(1);
  }

  if (!googleUser) {
    console.log('❌ User not found! The Google account points to a non-existent user.');
    console.log('   This is the root cause of the OAuthAccountNotLinked error.');
    console.log('');
    console.log('Fix: Deleting orphaned Google account...');
    const { error: deleteError } = await supabase
      .from('accounts')
      .delete()
      .eq('id', googleAccount.id);
    
    if (deleteError) {
      console.error('Error deleting:', deleteError.message);
    } else {
      console.log('✅ Deleted orphaned Google account. Try signing in again.');
    }
    return;
  }

  console.log(`  Google account points to user:`);
  console.log(`    ID: ${googleUser.id}`);
  console.log(`    Email: ${googleUser.email}`);
  console.log(`    Name: ${googleUser.name}`);
  console.log('');

  // Step 3: Find all users with the same email
  console.log('Step 3: Finding all users with email:', googleUser.email);
  const { data: allUsers, error: allUsersError } = await supabase
    .from('users')
    .select('id, email, name, emailVerified')
    .eq('email', googleUser.email.toLowerCase());

  if (allUsersError) {
    console.error('Error finding users:', allUsersError.message);
    process.exit(1);
  }

  console.log(`  Found ${allUsers?.length || 0} user(s) with this email`);
  if (allUsers) {
    for (const user of allUsers) {
      console.log(`    - ID: ${user.id}, Name: ${user.name}, Verified: ${user.emailVerified}`);
    }
  }
  console.log('');

  // Step 4: Check if Google account points to the correct user
  const correctUser = allUsers?.find(u => u.email?.toLowerCase() === googleUser.email?.toLowerCase());
  
  if (!correctUser) {
    console.log('⚠️ Could not find matching user. The email might be different.');
    return;
  }

  if (googleAccount.user_id === correctUser.id) {
    console.log('✅ Google account is already linked to the correct user!');
    console.log('');
    console.log('If you are still getting OAuthAccountNotLinked error, try:');
    console.log('1. Clear browser cookies');
    console.log('2. Restart dev server');
    console.log('3. Try signing in again');
    return;
  }

  // Step 5: Fix the Google account link
  console.log('Step 5: Fixing Google account link...');
  console.log(`  Current user_id: ${googleAccount.user_id}`);
  console.log(`  Correct user_id: ${correctUser.id}`);
  console.log('');

  // Check if the correct user already has a Google account
  const { data: existingGoogle } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', correctUser.id)
    .eq('provider', 'google')
    .maybeSingle();

  if (existingGoogle) {
    console.log('Correct user already has a Google account. Deleting duplicate...');
    const { error: deleteError } = await supabase
      .from('accounts')
      .delete()
      .eq('id', googleAccount.id);
    
    if (deleteError) {
      console.error('Error deleting:', deleteError.message);
    } else {
      console.log('✅ Deleted duplicate Google account');
    }
  } else {
    console.log('Updating Google account to point to correct user...');
    const { error: updateError } = await supabase
      .from('accounts')
      .update({ user_id: correctUser.id })
      .eq('id', googleAccount.id);
    
    if (updateError) {
      console.error('Error updating:', updateError.message);
    } else {
      console.log('✅ Google account linked to correct user');
    }
  }
  console.log('');

  // Step 6: Delete duplicate user if it exists
  if (googleUser.id !== correctUser.id) {
    console.log('Step 6: Cleaning up duplicate user...');
    console.log(`  Deleting user ${googleUser.id} (the one Google was incorrectly linked to)`);
    
    // Check if this user has any other accounts
    const { data: otherAccounts } = await supabase
      .from('accounts')
      .select('id, provider')
      .eq('user_id', googleUser.id);

    if (otherAccounts && otherAccounts.length > 0) {
      console.log(`  Warning: This user has ${otherAccounts.length} other account(s)`);
      for (const acc of otherAccounts) {
        console.log(`    - ${acc.provider}`);
      }
    }

    const { error: deleteUserError } = await supabase
      .from('users')
      .delete()
      .eq('id', googleUser.id);
    
    if (deleteUserError) {
      console.error('Error deleting user:', deleteUserError.message);
    } else {
      console.log('✅ Deleted duplicate user');
    }
    console.log('');
  }

  console.log('=== Fix Complete ===');
  console.log('Try signing in with Google again!');
}

fixGoogleAccountLink().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
