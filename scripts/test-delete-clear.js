// Test delete and clear functionality
const fs = require('fs');
const path = require('path');

console.log('=== Testing Delete & Clear Functionality ===\n');

// Check admin page
const adminPath = path.join(__dirname, '../app/admin/messages/page.js');
const adminContent = fs.readFileSync(adminPath, 'utf8');

const adminChecks = {
  'Handle delete action': adminContent.includes('action === "delete"'),
  'Handle bulk_delete action': adminContent.includes('action === "bulk_delete"'),
  'Handle clear action': adminContent.includes('action === "clear"'),
  'Reload after delete': adminContent.includes('setTimeout(() => load(), 300)'),
};

console.log('Admin Messages Page:');
Object.entries(adminChecks).forEach(([check, result]) => {
  console.log(`  ${result ? '✅' : '❌'} ${check}`);
});

// Check client portal page
const clientPath = path.join(__dirname, '../app/client-portal/messages/page.js');
const clientContent = fs.readFileSync(clientPath, 'utf8');

const clientChecks = {
  'Handle delete action': clientContent.includes('action === "delete"'),
  'Handle bulk_delete action': clientContent.includes('action === "bulk_delete"'),
  'Handle clear action': clientContent.includes('action === "clear"'),
  'Reload after delete': clientContent.includes('setTimeout(() => load(), 300)'),
};

console.log('\nClient Portal Messages Page:');
Object.entries(clientChecks).forEach(([check, result]) => {
  console.log(`  ${result ? '✅' : '❌'} ${check}`);
});

// Check MessageList component
const listPath = path.join(__dirname, '../components/client/MessageList.jsx');
const listContent = fs.readFileSync(listPath, 'utf8');

const listChecks = {
  'handleClearChat exists': listContent.includes('async function handleClearChat'),
  'Modal closes on success': listContent.includes('setShowClearConfirm(false)'),
  'Calls onMessageUpdate clear': listContent.includes('onMessageUpdate?.("clear", null)'),
  'No window.reload()': !listContent.includes('window.location.reload()'),
};

console.log('\nMessageList Component:');
Object.entries(listChecks).forEach(([check, result]) => {
  console.log(`  ${result ? '✅' : '❌'} ${check}`);
});

const allPassed = Object.values(adminChecks).every(v => v) && 
                  Object.values(clientChecks).every(v => v) &&
                  Object.values(listChecks).every(v => v);

console.log(`\n=== Result: ${allPassed ? '✅ All tests passed!' : '❌ Some tests failed'}`);
