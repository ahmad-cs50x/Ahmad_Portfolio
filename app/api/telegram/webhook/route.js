/**
 * Telegram Bot Webhook Route
 *
 * Receives contact-form messages people send directly to the bot chat:
 * parses "Name: / Email: / Subject: / Message:" and confirms in-chat.
 * Delivery is Telegram-only (no SMTP) — Edge-runtime safe via fetch.
 */

import { NextResponse } from "next/server";

export const runtime = "edge";

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 50;

function getRateLimitInfo(chatId) {
  const now = Date.now();
  const record = rateLimitMap.get(chatId);

  if (!record || now - record.timestamp > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(chatId, { count: 1, timestamp: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count };
}

async function tgReq(method, path, payload = {}) {
  const token = process.env.TG_BOT_TOKEN;
  if (!token) throw new Error("TG_BOT_TOKEN is not configured.");
  const response = await fetch(`https://api.telegram.org/bot${token}/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify(payload) } : {}),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.ok) {
    throw new Error(`Telegram API error (${path}): ${json?.description || response.status}`);
  }
  return json.result;
}

function parseTelegramMessage(text) {
  if (!text) return null;

  const lines = text.split('\n').filter(line => line.trim());
  const result = { name: null, email: null, subject: null, message: '' };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('Name:')) {
      result.name = trimmed.replace('Name:', '').trim();
    } else if (trimmed.startsWith('Email:')) {
      result.email = trimmed.replace('Email:', '').trim();
    } else if (trimmed.startsWith('Subject:')) {
      result.subject = trimmed.replace('Subject:', '').trim();
    } else if (trimmed.startsWith('Message:')) {
      result.message = trimmed.replace('Message:', '').trim().slice(1); // Remove colon and newline
    }
  }

  return result;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const message = body?.message;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const chatId = message.chat.id;
    const { allowed } = getRateLimitInfo(chatId);

    if (!allowed) {
      await tgReq("sendMessage", {
        chat_id: chatId,
        text: "⏳ Too many requests. Please try again in 15 minutes."
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Parse the message
    const formData = parseTelegramMessage(message.text);

    if (!formData) {
      await tgReq("sendMessage", {
        chat_id: chatId,
        text: "❌ Please send the contact form name, email, subject and message:\n\nName: Your name\nEmail: your@email.com\nSubject: Message subject\nMessage: Your message here"
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Validate required fields
    if (!formData.name || !formData.email || !formData.message) {
      await tgReq("sendMessage", {
        chat_id: chatId,
        text: "❌ Missing required fields. Please send:\n\nName: Your name\nEmail: your@email.com\nSubject: Message subject\nMessage: Your message here"
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Send confirmation to Telegram
    await tgReq("sendMessage", {
      chat_id: chatId,
      text: `✅ Form received!\n\nYour message has been delivered.\n\nName: ${formData.name}\nEmail: ${formData.email}`,
      disable_web_page_preview: true
    });

    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (error) {
    console.error("[telegram] Webhook error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}