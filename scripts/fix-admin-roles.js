/**
 * Fix admin roles in database
 * Run this once to promote specific emails to SUPER_ADMIN
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

const ADMIN_EMAILS = [
  'ranaahmadranaahmad741@gmail.com',
  'ahmedcs50x@gmail.com'
];

async function fixAdminRoles() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
  }
  
  const supabase = createClient(url, key);
  
  console.log('Fixing admin roles for:', ADMIN_EMAILS.join(', '));
  console.log('');
  
  let updated = 0;
  let alreadyAdmin = 0;
  let notFound = 0;
  
  for (const email of ADMIN_EMAILS) {
    const normalizedEmail = email.toLowerCase();
    
    // Check if user exists
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('email', normalizedEmail)
      .single();
    
    if (error) {
      console.log(`❌ ${email}: Not found in database`);
      notFound++;
      continue;
    }
    
    if (profile.role === 'SUPER_ADMIN') {
      console.log(`✅ ${email}: Already SUPER_ADMIN`);
      alreadyAdmin++;
      continue;
    }
    
    // Update to SUPER_ADMIN
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'SUPER_ADMIN' })
      .eq('email', normalizedEmail);
    
    if (updateError) {
      console.log(`❌ ${email}: Failed to update - ${updateError.message}`);
    } else {
      console.log(`✅ ${email}: Updated to SUPER_ADMIN`);
      updated++;
    }
  }
  
  console.log('');
  console.log('Summary:');
  console.log(`  Updated: ${updated}`);
  console.log(`  Already admin: ${alreadyAdmin}`);
  console.log(`  Not found: ${notFound}`);
}

fixAdminRoles().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
