/**
 * Fix duplicate user accounts and link Google account to correct user
 * Run: node scripts/fix-duplicate-users.js
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

const ADMIN_EMAIL = 'ranaahmadranaahmad741@gmail.com';

async function fixDuplicateUsers() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('=== Fix Duplicate User Accounts ===\n');

  if (!url || !key) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // Step 1: Find all users with this email
  console.log(`Step 1: Finding all users for ${ADMIN_EMAIL}...`);
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, name, emailVerified')
    .eq('email', ADMIN_EMAIL.toLowerCase());

  if (usersError) {
    console.error('Error finding users:', usersError.message);
    process.exit(1);
  }

  console.log(`  Found ${users?.length || 0} user(s)`);
  if (users && users.length > 0) {
    for (const user of users) {
      console.log(`    - ID: ${user.id}, Name: ${user.name}, Verified: ${user.emailVerified}`);
    }
  }
  console.log('');

  if (!users || users.length === 0) {
    console.log('No users found. Nothing to fix.');
    return;
  }

  if (users.length === 1) {
    console.log('Only one user found. Checking accounts...');
  }

  // Step 2: Find all accounts for these users
  console.log('Step 2: Finding all accounts...');
  const userIds = users.map(u => u.id);
  
  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('id, user_id, provider, providerAccountId, password_hash')
    .in('user_id', userIds);

  if (accountsError) {
    console.error('Error finding accounts:', accountsError.message);
    process.exit(1);
  }

  console.log(`  Found ${accounts?.length || 0} account(s)`);
  if (accounts && accounts.length > 0) {
    for (const acc of accounts) {
      console.log(`    - User: ${acc.user_id}, Provider: ${acc.provider}, Has Password: ${!!acc.password_hash}`);
    }
  }
  console.log('');

  // Step 3: Determine which user to keep (the one with credentials/password)
  const userWithPassword = accounts?.find(a => a.password_hash);
  const primaryUserId = userWithPassword?.user_id || users[0].id;

  console.log(`Step 3: Primary user to keep: ${primaryUserId}`);
  console.log(`  (User with password: ${userWithPassword ? 'Yes' : 'No'})\n`);

  // Step 4: Move Google account to primary user if needed
  const googleAccount = accounts?.find(a => a.provider === 'google');
  
  if (googleAccount && googleAccount.user_id !== primaryUserId) {
    console.log('Step 4: Moving Google account to primary user...');
    
    // Check if primary user already has a google account
    const primaryHasGoogle = accounts?.some(a => a.user_id === primaryUserId && a.provider === 'google');
    
    if (primaryHasGoogle) {
      console.log('  Primary user already has Google account. Deleting duplicate...');
      const { error: deleteError } = await supabase
        .from('accounts')
        .delete()
        .eq('id', googleAccount.id);
      
      if (deleteError) {
        console.error('  Error deleting:', deleteError.message);
      } else {
        console.log('  ✅ Deleted duplicate Google account');
      }
    } else {
      console.log('  Updating Google account to point to primary user...');
      const { error: updateError } = await supabase
        .from('accounts')
        .update({ user_id: primaryUserId })
        .eq('id', googleAccount.id);
      
      if (updateError) {
        console.error('  Error updating:', updateError.message);
      } else {
        console.log('  ✅ Google account linked to primary user');
      }
    }
    console.log('');
  } else if (googleAccount?.user_id === primaryUserId) {
    console.log('Step 4: Google account already linked to primary user ✅\n');
  } else {
    console.log('Step 4: No Google account found\n');
  }

  // Step 5: Delete duplicate user accounts (keep only primary)
  console.log('Step 5: Cleaning up duplicate users...');
  const duplicateUserIds = userIds.filter(id => id !== primaryUserId);
  
  if (duplicateUserIds.length > 0) {
    for (const dupId of duplicateUserIds) {
      // Check if this user has any accounts
      const dupAccounts = accounts?.filter(a => a.user_id === dupId) || [];
      
      if (dupAccounts.length > 0) {
        console.log(`  User ${dupId} has ${dupAccounts.length} account(s). Moving them...`);
        for (const acc of dupAccounts) {
          // Check if primary user already has this provider type
          const primaryHasProvider = accounts?.some(a => a.user_id === primaryUserId && a.provider === acc.provider);
          
          if (primaryHasProvider) {
            console.log(`    Deleting duplicate ${acc.provider} account...`);
            await supabase.from('accounts').delete().eq('id', acc.id);
          } else {
            console.log(`    Moving ${acc.provider} account to primary user...`);
            await supabase.from('accounts').update({ user_id: primaryUserId }).eq('id', acc.id);
          }
        }
      }
      
      console.log(`  Deleting duplicate user ${dupId}...`);
      const { error: deleteUserError } = await supabase
        .from('users')
        .delete()
        .eq('id', dupId);
      
      if (deleteUserError) {
        console.error(`  Error: ${deleteUserError.message}`);
      } else {
        console.log(`  ✅ Deleted duplicate user`);
      }
    }
  } else {
    console.log('  No duplicate users to delete');
  }
  console.log('');

  // Step 6: Verify final state
  console.log('Step 6: Verifying final state...');
  const { data: finalUsers } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', ADMIN_EMAIL.toLowerCase());

  const { data: finalAccounts } = await supabase
    .from('accounts')
    .select('id, user_id, provider, password_hash')
    .in('user_id', finalUsers?.map(u => u.id) || []);

  console.log(`  Users: ${finalUsers?.length || 0}`);
  console.log(`  Accounts: ${finalAccounts?.length || 0}`);
  if (finalAccounts) {
    for (const acc of finalAccounts) {
      console.log(`    - ${acc.provider} (password: ${!!acc.password_hash})`);
    }
  }
  console.log('');

  console.log('=== Fix Complete ===');
  console.log('You should now be able to sign in with Google!');
}

fixDuplicateUsers().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
