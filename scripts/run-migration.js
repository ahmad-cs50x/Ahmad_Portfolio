/**
 * Run Supabase migrations using the service role key
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valParts] = trimmed.split('=');
    const val = valParts.join('=').trim();
    if (key && val) process.env[key] = val;
  }
});

async function runMigration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.error('Missing environment variables');
    process.exit(1);
  }
  
  // Create admin client (bypasses RLS)
  const supabase = createClient(url, key);
  
  // Read migration file
  const migrationFile = path.resolve(__dirname, '../supabase/migrations/011_add_is_deleted_to_messages.up.sql');
  const sql = fs.readFileSync(migrationFile, 'utf8');
  
  console.log('Running migration...');
  console.log(sql);
  
  try {
    // Use PostgREST RPC to execute SQL
    const res = await fetch(url + '/rest/v1/', {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ sql })
    });
    
    console.log('Response status:', res.status);
    
    // If REST doesn't work, provide manual instructions
    if (!res.ok) {
      console.log('\nPlease run this SQL manually in Supabase Dashboard → SQL Editor:\n');
      console.log(sql);
    } else {
      console.log('Migration completed!');
    }
  } catch (e) {
    console.error('Error:', e.message);
    console.log('\nPlease run this SQL manually in Supabase Dashboard → SQL Editor:\n');
    console.log(sql);
  }
}

runMigration();
