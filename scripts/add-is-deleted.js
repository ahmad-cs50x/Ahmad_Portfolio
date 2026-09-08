const { getSupabaseAdmin } = require('./lib/db');

async function addIsDeletedColumn() {
  const sb = getSupabaseAdmin();
  if (!sb) {
    console.error('No Supabase client');
    process.exit(1);
  }

  try {
    // Add column directly
    const { error } = await sb.rpc('add_is_deleted_column');
    
    // Alternative: use raw SQL via PostgREST
    const res = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/messages', {
      method: 'OPTIONS',
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
      }
    });
    
    console.log('Columns response status:', res.status);
    
    // Try direct SQL execution
    const sql = `ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;`;
    
    const sqlRes = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/run_sql', {
      method: 'POST',
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    });
    
    console.log('SQL result:', sqlRes.status);
    const text = await sqlRes.text();
    console.log('Response:', text);
    
  } catch (e) {
    console.error('Error:', e.message);
  }
}

addIsDeletedColumn();