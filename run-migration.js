const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

const sql = fs.readFileSync(path.join(__dirname, 'supabase/migrations/001_initial_schema.sql'), 'utf8');

async function runMigration() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Split by semicolon and execute each statement
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    
    for (const stmt of statements) {
      try {
        await client.query(stmt);
        console.log('OK:', stmt.substring(0, 80) + '...');
      } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('duplicate')) {
          console.log('SKIP (already exists):', stmt.substring(0, 80) + '...');
        } else {
          console.error('FAILED:', stmt.substring(0, 80) + '...');
          console.error('Error:', err.message);
        }
      }
    }
    console.log('Migration completed!');
  } catch (err) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();