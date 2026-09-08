// Test new delete features
const fs = require('fs');
const path = require('path');

console.log('=== Testing Delete Features ===\n');

const bulkRoutePath = path.join(__dirname, '../app/api/messages/bulk/route.js');
const messageListPath = path.join(__dirname, '../components/client/MessageList.jsx');

// Check bulk delete endpoint
const bulkContent = fs.readFileSync(bulkRoutePath, 'utf8');
const bulkChecks = {
  'Bulk DELETE endpoint exists': bulkContent.includes('export async function DELETE'),
  'Handles messageIds parameter': bulkContent.includes('messageIdsParam'),
  'Deletes attachments from Telegram': bulkContent.includes('removeObject'),
  'Deletes text bodies': bulkContent.includes('removeTextObject'),
  'Deletes from message_attachments': bulkContent.includes('message_attachments') && bulkContent.includes('.delete()'),
  'Deletes from messages table': bulkContent.includes('from("messages")') && bulkContent.includes('.delete()'),
  'Checks permissions (admin vs user)': bulkContent.includes('SUPER_ADMIN') && bulkContent.includes('sender_profile_id'),
};

console.log('Bulk Delete API (/api/messages/bulk):');
Object.entries(bulkChecks).forEach(([check, result]) => {
  console.log(`  ${result ? '✅' : '❌'} ${check}`);
});

// Check MessageList component
const listContent = fs.readFileSync(messageListPath, 'utf8');
const listChecks = {
  'Long press handler': listContent.includes('handlePointerDown') && listContent.includes('setTimeout'),
  'Selection mode state': listContent.includes('isSelectionMode'),
  'Selected messages tracking': listContent.includes('selectedMessages'),
  'Toggle selection on click': listContent.includes('toggleMessageSelection'),
  'Bulk delete button in header': listContent.includes('showBulkDeleteConfirm'),
  'Bulk delete handler': listContent.includes('handleBulkDelete'),
  'Delete confirmation modal': listContent.includes('Delete {selectedMessages.size} Messages'),
  'Selection indicator UI': listContent.includes('isSelected'),
};

console.log('\nMessageList Component:');
Object.entries(listChecks).forEach(([check, result]) => {
  console.log(`  ${result ? '✅' : '❌'} ${check}`);
});

const allPassed = Object.values(bulkChecks).every(v => v) && Object.values(listChecks).every(v => v);
console.log(`\n=== Result: ${allPassed ? '✅ All tests passed!' : '❌ Some tests failed'}`);
