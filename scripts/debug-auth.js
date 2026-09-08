/**
 * Debug authentication issues
 * Run: node scripts/debug-auth.js
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

async function debugAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  console.log('=== Authentication Debug ===\n');

  // Check environment
  console.log('Environment Check:');
  console.log(`  SUPABASE_URL: ${url ? '✅ Set' : '❌ Missing'}`);
  console.log(`  SERVICE_ROLE_KEY: ${key ? '✅ Set' : '❌ Missing'}`);
  console.log(`  AUTH_SECRET: ${secret ? '✅ Set' : '❌ Missing'}`);
  console.log(`  TG_BOT_TOKEN: ${process.env.TG_BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`  TG_CHAT_ID: ${process.env.TG_CHAT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log('');

  if (!url || !key) {
    console.error('Missing required environment variables');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // Check tables exist
  console.log('Table Existence Check:');
  const tables = ['users', 'accounts', 'profiles', 'invites', 'messages'];
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1);
      console.log(`  ${table}: ${error ? '❌ Missing/Error' : '✅ Exists'}`);
    } catch (e) {
      console.log(`  ${table}: ❌ Error - ${e.message}`);
    }
  }
  console.log('');

  // Check admin emails
  console.log('Admin Email Check:');
  const adminEmails = ['ranaahmadranaahmad741@gmail.com', 'ahmedcs50x@gmail.com'];
  for (const email of adminEmails) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email, role, full_name')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error) {
      console.log(`  ${email}: ❌ Error - ${error.message}`);
    } else if (profile) {
      console.log(`  ${email}: ✅ Found (role: ${profile.role}, name: ${profile.full_name})`);
    } else {
      console.log(`  ${email}: ⚠️ Not found in profiles table`);
    }
  }
  console.log('');

  // Check users table
  console.log('Users Table Check:');
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, emailVerified')
    .limit(10);

  if (usersError) {
    console.log(`  ❌ Error: ${usersError.message}`);
  } else {
    console.log(`  ✅ Found ${users?.length || 0} users`);
    if (users && users.length > 0) {
      for (const user of users.slice(0, 3)) {
        console.log(`    - ${user.email} (verified: ${!!user.emailVerified})`);
      }
    }
  }
  console.log('');

  // Check accounts table
  console.log('Accounts Table Check:');
  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('id, provider, providerAccountId, password_hash')
    .limit(10);

  if (accountsError) {
    console.log(`  ❌ Error: ${accountsError.message}`);
  } else {
    console.log(`  ✅ Found ${accounts?.length || 0} accounts`);
    if (accounts && accounts.length > 0) {
      for (const acc of accounts.slice(0, 3)) {
        console.log(`    - ${acc.provider} (${acc.providerAccountId.substring(0, 20)}...) ${acc.password_hash ? 'with password' : 'no password'}`);
      }
    }
  }
  console.log('');

  // Check invites table
  console.log('Invites Table Check:');
  const { data: invites, error: invitesError } = await supabase
    .from('invites')
    .select('id, email, role, expires_at, accepted_at')
    .limit(10);

  if (invitesError) {
    console.log(`  ❌ Error: ${invitesError.message}`);
  } else {
    console.log(`  ✅ Found ${invites?.length || 0} invites`);
    if (invites && invites.length > 0) {
      for (const inv of invites.slice(0, 3)) {
        console.log(`    - ${inv.email} (role: ${inv.role}, status: ${inv.accepted_at ? 'accepted' : 'pending'})`);
      }
    }
  }
}

debugAuth().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
