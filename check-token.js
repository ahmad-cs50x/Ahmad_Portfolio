const { Client } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const connectionString = process.env.DATABASE_URL;

async function checkVerificationToken() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT * FROM verification_tokens ORDER BY expires DESC LIMIT 5
    `);
    
    console.log('Recent verification tokens:');
    result.rows.forEach(row => {
      console.log(`  Identifier: ${row.identifier}`);
      console.log(`  Token: ${row.token}`);
      console.log(`  Expires: ${row.expires}`);
      console.log('---');
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkVerificationToken();