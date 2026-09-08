/**
 * Telegram Email Service — 100% Edge Runtime Compatible (Cloudflare Pages)
 *
 * Uses Telegram Bot API via standard fetch() — no external services or packages needed.
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
  return !!(process.env.TG_BOT_TOKEN && process.env.TG_CHAT_ID);
}

export async function sendContactEmail({ name, email, subject, message }) {
  const botToken = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;

  if (!botToken || !chatId) {
    console.log("[contact] Telegram not configured — logging submission:");
    console.log(JSON.stringify({ name, email, subject, message }, null, 2));
    return { success: false, mocked: true };
  }

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
    const response = await fetch(`${API}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: Number(chatId),
        text: telegramMessage,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      console.error("[email] Telegram API error:", data.description || response.status);
      return { success: false, error: data.description || "Failed to send" };
    }

    return { success: true };
  } catch (err) {
    console.error("[email] Unexpected error:", err);
    return { success: false, error: err.message };
  }
}
