// Test script to verify message attachment handling
const fs = require('fs');
const path = require('path');

// Read the MessageList.jsx file
const messageListPath = path.join(__dirname, '../components/client/MessageList.jsx');
const content = fs.readFileSync(messageListPath, 'utf8');

// Check if the grid rendering is correct
const hasGridRendering = content.includes('<div className="grid grid-cols-2 gap-2 max-w-xs">');
const hasAttachmentMapping = content.includes('m.attachments.map((att, idx) => {');

console.log('Testing MessageList.jsx attachment rendering...');
console.log('Has grid rendering:', hasGridRendering);
console.log('Has attachment mapping:', hasAttachmentMapping);

if (hasGridRendering && hasAttachmentMapping) {
  console.log('✅ Attachment rendering looks correct - all attachments should be displayed');
} else {
  console.log('❌ Issue detected in attachment rendering logic');
}

// Also check MessageInput.jsx for optimistic update
const messageInputPath = path.join(__dirname, '../components/client/MessageInput.jsx');
const inputContent = fs.readFileSync(messageInputPath, 'utf8');
const hasOptimisticUpdate = inputContent.includes('onSent?.({ type: "add", message: optimisticMessage })');
const hasAllAttachments = inputContent.includes('attachments: selectedFiles.map(f => ({');

console.log('\nTesting MessageInput.jsx optimistic update...');
console.log('Has optimistic update:', hasOptimisticUpdate);
console.log('Has all attachments in optimistic message:', hasAllAttachments);

if (hasOptimisticUpdate && hasAllAttachments) {
  console.log('✅ Optimistic update should include all attachments');
} else {
  console.log('❌ Issue with optimistic update');
}