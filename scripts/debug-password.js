/**
 * Debug password hash verification
 * Run: node scripts/debug-password.js <email> <password>
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

async function sha256Hex(input) {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(input)));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function debugPassword() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.log('Usage: node scripts/debug-password.js <email> <password>');
    console.log('Example: node scripts/debug-password.js test@example.com mypassword123');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'dev-only-insecure-secret-change-me';

  console.log('=== Password Debug Tool ===\n');
  console.log(`Email: ${email}`);
  console.log(`Password: ${'*'.repeat(password.length)}`);
  console.log(`AUTH_SECRET length: ${authSecret.length} chars`);
  console.log('');

  if (!url || !key) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // Find user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (userError) {
    console.error('User query error:', userError.message);
    process.exit(1);
  }

  if (!user) {
    console.log('❌ User not found in database');
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.id}`);

  // Find account
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id, provider, providerAccountId, password_hash')
    .eq('user_id', user.id)
    .eq('provider', 'credentials')
    .maybeSingle();

  if (accountError) {
    console.error('Account query error:', accountError.message);
    process.exit(1);
  }

  if (!account) {
    console.log('❌ No credentials account found for this user');
    console.log('   The password may not have been set during invitation.');
    process.exit(1);
  }

  console.log(`✅ Found account: ${account.id}`);
  console.log(`   Provider: ${account.provider}`);
  console.log(`   Has password_hash: ${!!account.password_hash}`);
  console.log(`   Hash length: ${account.password_hash?.length || 0} chars`);
  console.log('');

  // Calculate expected hash
  const calculatedHash = await sha256Hex(password + authSecret);
  console.log('=== Hash Verification ===');
  console.log(`Calculated hash (input: password + AUTH_SECRET):`);
  console.log(`  ${calculatedHash}`);
  console.log('');
  console.log(`Stored hash in database:`);
  console.log(`  ${account.password_hash}`);
  console.log('');

  if (calculatedHash === account.password_hash) {
    console.log('✅ PASSWORD MATCH! Hashes are identical.');
    console.log('   The password should work for sign-in.');
  } else {
    console.log('❌ PASSWORD MISMATCH!');
    console.log('   Possible causes:');
    console.log('   1. Wrong password entered');
    console.log('   2. AUTH_SECRET changed since password was created');
    console.log('   3. Password was created with different secret');
    console.log('');
    console.log('   Hint: Check if AUTH_SECRET in .env.local matches what was used when creating the invite.');
  }

  // Test with stored hash
  console.log('');
  console.log('=== Additional Info ===');
  console.log(`User ID: ${user.id}`);
  console.log(`Account ID: ${account.id}`);
  console.log(`Provider Account ID: ${account.providerAccountId}`);
}

debugPassword().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
