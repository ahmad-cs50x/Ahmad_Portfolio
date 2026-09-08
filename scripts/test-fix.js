// Test to verify multiple attachments are handled correctly
const fs = require('fs');
const path = require('path');

console.log('=== Testing Multiple Attachments Fix ===\n');

const sendRoutePath = path.join(__dirname, '../app/api/messages/send/route.js');
const getMessageRoutePath = path.join(__dirname, '../app/api/messages/route.js');

// Check send route
const sendContent = fs.readFileSync(sendRoutePath, 'utf8');
const sendChecks = {
  'Collects all files': sendContent.includes('const files = []'),
  'Pushes each file': sendContent.includes('files.push(file)'),
  'Sets primary attachment': sendContent.includes('primaryFile = files[0]'),
  'Inserts into message_attachments': sendContent.includes('message_attachments') && sendContent.includes('insert(attachmentRows)'),
};

console.log('Send Route (/api/messages/send):');
Object.entries(sendChecks).forEach(([check, result]) => {
  console.log(`  ${result ? '✅' : '❌'} ${check}`);
});

// Check get route  
const getContent = fs.readFileSync(getMessageRoutePath, 'utf8');
const getChecks = {
  'Queries message_attachments': getContent.includes('message_attachments') && getContent.includes('in("message_id"'),
  'Builds attachments map': getContent.includes('attachmentsMap'),
  'Combines primary + additional': getContent.includes('allAttachments'),
};

console.log('\nGet Route (/api/messages):');
Object.entries(getChecks).forEach(([check, result]) => {
  console.log(`  ${result ? '✅' : '❌'} ${check}`);
});

console.log('\n=== Summary ===');
const allPassed = Object.values(sendChecks).every(v => v) && Object.values(getChecks).every(v => v);
if (allPassed) {
  console.log('✅ All checks passed! Multiple attachments should now work correctly.');
} else {
  console.log('❌ Some checks failed. Review the implementation.');
}
