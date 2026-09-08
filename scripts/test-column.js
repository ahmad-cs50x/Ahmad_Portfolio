const { getSupabaseAdmin, isDbConfigured } = require('../lib/db');
const fs = require('fs');
const path = require('path');

// Load .env.local
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

async function testColumn() {
  const sb = getSupabaseAdmin();
  if (!sb) {
    console.error('No SB client');
    return;
  }
  // Try querying is_deleted column
  const { data, error } = await sb.from('messages').select('id, is_deleted').limit(1);
  console.log('Query result:', { data, error });
}

testColumn();