// Debug test for multiple attachments rendering
const fs = require('fs');
const path = require('path');

console.log('=== Testing Multiple Attachments Rendering ===\n');

const listPath = path.join(__dirname, '../components/client/MessageList.jsx');
const listContent = fs.readFileSync(listPath, 'utf8');

// Check if renderAttachment handles different media types
const checks = {
  'Has renderAttachment function': listContent.includes('function renderAttachment'),
  'Handles audio': listContent.includes('isAudio') && listContent.includes('<audio'),
  'Handles video': listContent.includes('isVideo') && listContent.includes('<video'),
  'Handles image': listContent.includes('isImage') && listContent.includes('<img'),
  'Maps all attachments': listContent.includes('m.attachments.map'),
  'Uses key prop': listContent.includes('key={idx}') || listContent.includes('key={att.id}'),
};

Object.entries(checks).forEach(([check, result]) => {
  console.log(`${result ? '✅' : '❌'} ${check}`);
});

// Check the actual mapping in MessageList
const mapMatch = listContent.match(/m\.attachments\.map\(\(att, idx\) => \{[\s\S]*?\}\)\)/);
if (mapMatch) {
  console.log('\n✅ Found attachment mapping code:');
  console.log(mapMatch[0].substring(0, 300) + '...');
} else {
  console.log('\n❌ Could not find attachment mapping');
}

// Check renderAttachment function
const renderAttMatch = listContent.match(/function renderAttachment\(att\) \{[\s\S]*?\n\}/);
if (renderAttMatch) {
  console.log('\n✅ renderAttachment function found');
  // Check if it returns different tags for different types
  const funcCode = renderAttMatch[0];
  const hasAudioTag = funcCode.includes('<audio');
  const hasVideoTag = funcCode.includes('<video');
  const hasImgTag = funcCode.includes('<img');
  
  console.log(`   - Audio support: ${hasAudioTag ? '✅' : '❌'}`);
  console.log(`   - Video support: ${hasVideoTag ? '✅' : '❌'}`);
  console.log(`   - Image support: ${hasImgTag ? '✅' : '❌'}`);
}
