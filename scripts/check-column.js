const { getSupabaseAdmin } = require('./lib/db');

async function checkColumn() {
  const sb = getSupabaseAdmin();
  if (!sb) {
    console.error('No Supabase client');
    return;
  }

  // Check if column exists
  const { data, error } = await sb.rpc('pg_columns', { table_name: 'messages' });
  
  if (error) {
    // Try direct query
    const { data: cols, error: err } = await sb.from('messages').select('*').limit(0);
    console.log('Columns:', err?.message);
  } else {
    console.log('Columns found:', data);
  }
}

checkColumn();