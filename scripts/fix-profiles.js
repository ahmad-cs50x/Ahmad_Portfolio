/**
 * Fix profile names and admin roles in database
 * Run this to ensure all hardcoded admins have correct roles and names
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
  { email: 'ranaahmadranaahmad741@gmail.com', name: 'Ahmad' },
  { email: 'ahmedcs50x@gmail.com', name: 'Ahmed' }
];

async function fixProfiles() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }
  
  const supabase = createClient(url, key);
  
  console.log('Fixing admin profiles...\n');
  
  for (const admin of ADMIN_EMAILS) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email, role, full_name')
      .eq('email', admin.email.toLowerCase())
      .single();
    
    if (error) {
      console.log(`❌ ${admin.email}: Not found`);
      continue;
    }
    
    let updates = {};
    let changed = false;
    
    // Ensure SUPER_ADMIN role
    if (profile.role !== 'SUPER_ADMIN') {
      updates.role = 'SUPER_ADMIN';
      changed = true;
    }
    
    // Update name if different or empty
    if (!profile.full_name || profile.full_name !== admin.name) {
      updates.full_name = admin.name;
      changed = true;
    }
    
    if (changed) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('email', admin.email.toLowerCase());
      
      if (updateError) {
        console.log(`❌ ${admin.email}: Update failed - ${updateError.message}`);
      } else {
        console.log(`✅ ${admin.email}: Updated role=${updates.role || profile.role}, name=${updates.full_name || profile.full_name}`);
      }
    } else {
      console.log(`✅ ${admin.email}: Already correct (role=${profile.role}, name=${profile.full_name})`);
    }
  }
  
  console.log('\nDone!');
}

fixProfiles().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
