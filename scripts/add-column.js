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

async function addColumn() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pass = process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_PASSWORD;

  console.log('URL:', url);
  console.log('Pass:', pass ? 'present' : 'absent');

  // Try /sql with service key or db pass
  for (const token of [pass, key]) {
    if (!token) continue;
    try {
      const res = await fetch(url + '/sql', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: 'ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;' }),
      });
      const text = await res.text();
      console.log('SQL res with token:', text);
    } catch (e) {
      console.error('Error with token:', e.message);
    }
  }
}

addColumn();