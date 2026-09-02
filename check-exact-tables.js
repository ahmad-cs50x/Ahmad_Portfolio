const { Client } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const connectionString = process.env.DATABASE_URL;

async function checkExactTableNames() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    // Check exact table names in public schema
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'accounts', 'sessions', 'verification_tokens', 'profiles', 'clients')
      ORDER BY table_name
    `);
    
    console.log('Tables in public schema:');
    result.rows.forEach(row => console.log(' -', row.table_name));
    
    // Check if sessions table exists with exact name
    const sessionsResult = await client.query(`
      SELECT * FROM sessions LIMIT 1
    `);
    console.log('\nsessions table columns:', Object.keys(sessionsResult.rows[0] || {}));
    
    const vtResult = await client.query(`
      SELECT * FROM verification_tokens LIMIT 1
    `);
    console.log('verification_tokens table columns:', Object.keys(vtResult.rows[0] || {}));
    
    const profilesResult = await client.query(`
      SELECT * FROM profiles LIMIT 1
    `);
    console.log('profiles table columns:', Object.keys(profilesResult.rows[0] || {}));
    
    const clientsResult = await client.query(`
      SELECT * FROM clients LIMIT 1
    `);
    console.log('clients table columns:', Object.keys(clientsResult.rows[0] || {}));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkExactTableNames();