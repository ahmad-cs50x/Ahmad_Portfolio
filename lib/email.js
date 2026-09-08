/**
 * Email Service for Cloudflare Pages (Edge Runtime Compatible)
 *
 * Uses Telegram Bot to send contact form messages - 100% FREE, lifetime!
 * No paid services needed - uses your existing Telegram Bot.
 *
 * Setup:
 * 1. Create a Telegram Bot via @BotFather (if you don't have one)
 * 2. Get your Bot Token: TG_BOT_TOKEN
 * 3. Get your Chat ID: TG_CHAT_ID (your personal chat or channel)
 * 4. Set environment variables:
 *    - TG_BOT_TOKEN=123456:ABC-DEF
 *    - TG_CHAT_ID=123456789
 */

const API = "https://api.telegram.org";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isEmailConfigured() {
  return !!process.env.TG_BOT_TOKEN && !!process.env.TG_CHAT_ID;
}

export async function sendContactEmail({ name, email, subject, message }) {
  const botToken = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;

  // Convert chat_id to number (Telegram API requires number, not string)
  const numericChatId = Number(chatId);
  if (!botToken || !numericChatId) {
    // Development mode: log to console
    console.log("[contact] Telegram not configured — logging submission:");
    console.log(JSON.stringify({ name, email, subject, message }, null, 2));
    return { success: true, mocked: true };
  }

  // Format the message nicely for Telegram
  const telegramMessage = `
📬 *New Portfolio Contact*

👤 *Name:* ${escapeHtml(name)}
📧 *Email:* ${escapeHtml(email)}
📝 *Subject:* ${escapeHtml(subject || "No subject")}

💬 *Message:*
${escapeHtml(message)}

---
Reply to: ${email}
`.trim();

  try {
    // Send message via Telegram Bot API
    const response = await fetch(`${API}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: numericChatId,
        text: telegramMessage,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[email] Telegram API error:", errorData);
      return { success: false, error: errorData.description || "Failed to send" };
    }

    return { success: true };

  } catch (err) {
    console.error("[email] Unexpected error:", err);
    return { success: false, error: err.message };
  }
}
