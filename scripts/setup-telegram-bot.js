/**
 * Telegram Bot Setup Script
 *
 * Usage: node scripts/setup-telegram-bot.js
 *
 * This script:
 * 1. Verifies Telegram bot configuration
 * 2. Sets up webhook with your server URL
 * 3. Generate Discord webhook URL if needed
 */

require("dotenv").config();

const API = "https://api.telegram.org";

async function tgSend(method, data = {}) {
  const token = process.env.TG_BOT_TOKEN;
  const url = `${API}/bot${token}/${method}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.description || "Telegram request failed");
  }

  return response.json();
}

async function getMe() {
  const result = await tgSend("getMe");
  return result.result;
}

async function setVars() {
  console.log("=== 🤖 Telegram Bot Webhook Setup ===\n");

  // Check required env vars
  const required = ["TG_BOT_TOKEN", "NEXT_PUBLIC_APP_URL"];
  const missing = required.filter(v => !process.env[v]);

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach(v => console.error(`   - ${v}`));
    console.error("\nPlease add them to .env.local\n");
    process.exit(1);
  }

  // Get bot info
  if (!process.env.TG_BOT_TOKEN) {
    console.error("❌ TG_BOT_TOKEN not found in .env.local");
    console.error("\n1. Create a bot via @BotFather");
    console.error("2. Copy your token");
    console.error("3. Add to .env.local: TG_BOT_TOKEN=your_token_here\n");
    process.exit(1);
  }

  try {
    const botInfo = await getMe();
    console.log(`✅ Bot created: @${botInfo.username}`);
    console.log(`🏢 Name: ${botInfo.first_name}`);
  } catch (err) {
    console.error(`❌ Failed to get bot info: ${err.message}`);
    process.exit(1);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const webhookUrl = `${appUrl}/api/telegram/webhook`;

  console.log(`\n📡 Setting up webhook...`);
  console.log(`   URL: ${webhookUrl}\n`);

  try {
    const result = await tgSend("setWebhook", {
      url: webhookUrl,
      allowed_updates: ["message"],
    });

    if (result.ok) {
      console.log("✅ Webhook set up successfully!");

      // Verify webhook
      const getInfo = await tgSend("getWebhookInfo");
      console.log(`\n🔗 Webhook URL: ${getInfo.result.url}`);

      if (getInfo.result.url === webhookUrl) {
        console.log("✅ Webhook is active and receiving requests!");
      }

      // Generate test instructions
      console.log("\n=== 🧪 Test Your Bot ===");
      console.log(`1. Open your browser: https://t.me/@${botInfo.username}`);
      console.log(`2. Send a message like:\n`);
      console.log(`   Name: Test User`);
      console.log(`   Email: test@example.com`);
      console.log(`   Subject: Test Subject`);
      console.log(`   Message: Hello from Telegram bot!`);
      console.log(`3. Check your Gmail inbox for the HTML email.\n`);

      // Display server URL
      console.log("=== 🌐 Your Website URL ===");
      console.log(`${appUrl}`);
      console.log("\nIf deployed, replace localhost with your domain.");

    } else {
      console.error(`❌ Failed to set webhook: ${result.description}`);
      process.exit(1);
    }

  } catch (err) {
    console.error(`❌ Webhook error: ${err.message}\n`);
    process.exit(1);
  }
}

// Run setup
setVars().then(() => {
  console.log("\n✨ Setup complete!");
  process.exit(0);
}).catch(err => {
  console.error(`\n❌ Setup failed: ${err.message}`);
  process.exit(1);
});