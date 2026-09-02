const { Client } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const connectionString = process.env.DATABASE_URL;

async function refreshSchemaCache() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Notify PostgREST to reload schema
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log('Schema reload notification sent');
    
    // Also try the alternative notification
    await client.query("NOTIFY pgrst, 'reload config'");
    console.log('Config reload notification sent');
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

refreshSchemaCache();