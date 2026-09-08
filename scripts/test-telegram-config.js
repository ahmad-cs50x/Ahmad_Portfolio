/**
 * Test Telegram Configuration
 * Run: node scripts/test-telegram-config.js
 */
const fs = require('fs');
const path = require('path');

// Load environment
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valParts] = trimmed.split('=');
      const val = valParts.join('=').trim();
      if (key && val) process.env[key] = val;
    }
  });
}

async function testTelegramConfig() {
  console.log('=== Telegram Configuration Test ===\n');

  // Check configuration
  const botToken = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;
  const channelId = process.env.TG_CHANNEL_ID;

  console.log('Configuration Status:');
  console.log(`  TG_BOT_TOKEN: ${botToken ? '✅ Set' : '❌ Missing'}`);
  console.log(`  TG_CHAT_ID: ${chatId ? `✅ Set (${chatId})` : '⚠️  Empty - will use for notifications'}`);
  console.log(`  TG_CHANNEL_ID: ${channelId ? `✅ Set (${channelId})` : '⚠️  Empty - files go to chat'}`);
  console.log('');

  // Show current behavior
  if (!botToken) {
    console.error('❌ TG_BOT_TOKEN is required. Get one from @BotFather on Telegram.');
    process.exit(1);
  }

  console.log('Current Behavior:');
  if (channelId) {
    console.log('  📁 Media Storage → Private Channel');
    console.log('     Files uploaded through portal will go to channel:', channelId);
  } else {
    console.log('  📁 Media Storage → Bot Chat (TG_CHAT_ID)');
    console.log('     Files will be sent to your personal chat.');
  }

  if (chatId) {
    console.log('  📧 Notifications → Personal Chat');
    console.log('     Invitations, magic links, contact form →', chatId);
  } else {
    console.log('  📧 Notifications → No recipient configured');
  }
  console.log('');

  // Verify bot can access channels
  if (channelId) {
    console.log('Testing channel access...');
    try {
      const API = 'https://api.telegram.org';
      const res = await fetch(`${API}/bot${botToken}/getChat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: channelId })
      });
      const data = await res.json();
      
      if (data.ok) {
        console.log(`  ✅ Bot can access channel: ${data.result.title || channelId}`);
        console.log(`     Type: ${data.result.type}`);
        console.log(`     Members: ${data.result.members_count || 'unknown'}`);
      } else {
        console.log(`  ❌ Cannot access channel: ${data.description}`);
        console.log('     Make sure the bot is added as an admin to the channel!');
      }
    } catch (e) {
      console.log(`  ❌ Error testing channel: ${e.message}`);
    }
  }

  console.log('');
  console.log('=== Next Steps ===');
  console.log('1. If using a private channel, make sure the bot has admin permissions');
  console.log('2. Restart your dev server after changing environment variables');
  console.log('3. Test by uploading a file - it should appear in the channel');
}

testTelegramConfig().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
