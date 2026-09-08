// Debug tool to verify message attachment data flow
const fs = require('fs');
const path = require('path');

console.log('=== Attachment Flow Debug ===\n');

// 1. Check MessageInput.jsx for how attachments are added to optimistic message
const messageInputPath = path.join(__dirname, '../components/client/MessageInput.jsx');
const inputContent = fs.readFileSync(messageInputPath, 'utf8');

// Extract the optimistic message creation
const optimisticMatch = inputContent.match(/const optimisticMessage = \{[\s\S]*?attachments: (\[[\s\S]*?\])/);
if (optimisticMatch) {
  console.log('✅ Optimistic message includes attachments array:');
  console.log(optimisticMatch[1].substring(0, 200) + '...');
} else {
  console.log('❌ Could not find optimistic message attachments in MessageInput.jsx');
}

// 2. Check if the optimistic message is sent via onSent
const onSentMatch = inputContent.includes('onSent?.({ type: "add", message: optimisticMessage })');
console.log(`\n✅ onSent called with optimisticMessage: ${onSentMatch}`);

// 3. Check MessageList.jsx for rendering loop
const messageListPath = path.join(__dirname, '../components/client/MessageList.jsx');
const listContent = fs.readFileSync(messageListPath, 'utf8');

// Find the attachments mapping
const mapMatch = listContent.match(/m\.attachments\.map\(\(att, idx\) => \{[\s\S]*?\}\)/);
if (mapMatch) {
  console.log('\n✅ MessageList.jsx maps all attachments:');
  console.log(mapMatch[0].substring(0, 150) + '...');
} else {
  console.log('\n❌ Could not find attachments.map in MessageList.jsx');
}

// 4. Check for any slicing or limiting of attachments
const hasSlice = listContent.includes('.slice(');
const hasLimit = listContent.includes('.limit(');
console.log(`\n⚠️  Found potential limiting:`);
console.log(`   - .slice() used: ${hasSlice}`);
console.log(`   - .limit() used: ${hasLimit}`);

if (hasSlice || hasLimit) {
  console.log('   This might be causing only first image to show!');
}

console.log('\n=== End Debug ===');