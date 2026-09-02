const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing Supabase config');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

async function testInsert() {
  const token = {
    identifier: 'test2@example.com',
    token: 'test-token-' + randomUUID(),
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };
  
  console.log('Inserting token:', token);
  
  const { data, error } = await db.from('verification_tokens').insert(token).select();
  
  if (error) {
    console.error('Insert error:', error);
  } else {
    console.log('Insert success:', data);
  }
  
  // Verify
  const { data: verifyData, error: verifyError } = await db
    .from('verification_tokens')
    .select('*')
    .eq('identifier', token.identifier)
    .eq('token', token.token)
    .maybeSingle();
    
  console.log('Verify result:', verifyData, verifyError);
}

testInsert();