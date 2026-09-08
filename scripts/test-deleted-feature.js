// Test deleted message functionality
const fs = require('fs');
const path = require('path');

console.log('=== Testing Deleted Message Feature ===\n');

const listPath = path.join(__dirname, '../components/client/MessageList.jsx');
const routePath = path.join(__dirname, '../app/api/messages/route.js');
const migrationPath = path.join(__dirname, '../supabase/migrations/011_add_is_deleted_to_messages.up.sql');

let checks = [];
let passed = 0;
let failed = 0;

// Check frontend
const listContent = fs.readFileSync(listPath, 'utf8');
checks.push({
  name: 'Frontend shows Deleted tag',
  pass: listContent.includes('m.is_deleted') && listContent.includes('Deleted')
});

// Check backend soft delete
const routeContent = fs.readFileSync(routePath, 'utf8');
checks.push({
  name: 'Backend uses soft delete (is_deleted)',
  pass: routeContent.includes('is_deleted: true')
});

// Check migration file exists
checks.push({
  name: 'Migration file exists',
  pass: fs.existsSync(migrationPath)
});

// Check migration SQL
if (fs.existsSync(migrationPath)) {
  const migrationContent = fs.readFileSync(migrationPath, 'utf8');
  checks.push({
    name: 'Migration adds is_deleted column',
    pass: migrationContent.includes('ADD COLUMN IF NOT EXISTS is_deleted')
  });
}

// Check API selects is_deleted
checks.push({
  name: 'API selects is_deleted column',
  pass: routeContent.includes('is_deleted') && routeContent.includes('.select(')
});

console.log('Test Results:');
console.log('-------------');

checks.forEach(check => {
  if (check.pass) {
    console.log(`✅ ${check.name}`);
    passed++;
  } else {
    console.log(`❌ ${check.name}`);
    failed++;
  }
});

console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===`);

if (failed > 0) {
  console.log('\n⚠️  Some tests failed. Please review the code.');
  process.exit(1);
} else {
  console.log('\n✅ All code checks passed!');
  console.log('\n⚡ IMPORTANT: You must run the database migration first!');
  console.log('\nTo run the migration:');
  console.log('1. Go to Supabase Dashboard → SQL Editor');
  console.log('2. Run the SQL in: supabase/migrations/011_add_is_deleted_to_messages.up.sql');
  console.log('3. Or paste this SQL:\n');
  console.log(fs.readFileSync(migrationPath, 'utf8'));
}
