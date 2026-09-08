import { NextResponse } from "next/server";

// Edge Runtime for Cloudflare Pages compatibility
export const runtime = 'edge';

import { sendContactEmail, isEmailConfigured } from "@/lib/email";

// Simple in-memory rate limiter (resets on server restart)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 25;

function getRateLimitInfo(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now - record.timestamp > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count };
}

function getClientIP(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function sanitizeString(str, maxLength = Infinity) {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, maxLength);
}

export async function POST(request) {
  // Rate limiting
  const ip = getClientIP(request);
  const { allowed, remaining } = getRateLimitInfo(ip);

  if (!allowed) {
    return NextResponse.json(
      {
        success: false,
        message: "Too many requests from this IP. Please try again in 15 minutes.",
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil((Date.now() + RATE_LIMIT_WINDOW) / 1000)),
        },
      }
    );
  }

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid JSON body.",
        rateLimit: { remaining },
      },
      { status: 400 }
    );
  }

  // Validate required fields
  const name = sanitizeString(body?.name, 80);
  const email = sanitizeString(body?.email, 320);
  const subject = sanitizeString(body?.subject, 120);
  const message = sanitizeString(body?.message, 2000);

  if (!name) {
    return NextResponse.json(
      { success: false, message: "Name is required.", rateLimit: { remaining } },
      { status: 400 }
    );
  }

  if (!email || !validateEmail(email)) {
    return NextResponse.json(
      { success: false, message: "A valid email is required.", rateLimit: { remaining } },
      { status: 400 }
    );
  }

  if (!message) {
    return NextResponse.json(
      { success: false, message: "Message is required.", rateLimit: { remaining } },
      { status: 400 }
    );
  }

  if (message.length < 10) {
    return NextResponse.json(
      { success: false, message: "Message must be at least 10 characters.", rateLimit: { remaining } },
      { status: 400 }
    );
  }

  // Check if email is configured
  if (!isEmailConfigured()) {
    return NextResponse.json(
      {
        success: false,
        message: "Email service is not configured on the server.",
        rateLimit: { remaining },
      },
      { status: 503 }
    );
  }

  // Send email
  try {
    await sendContactEmail({
      name,
      email,
      subject: subject || "New portfolio message",
      message,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Message sent successfully! I'll get back to you within 24 hours.",
        rateLimit: { remaining: remaining - 1 },
      },
      {
        status: 201,
        headers: {
          "X-RateLimit-Remaining": String(remaining - 1),
        },
      }
    );
  } catch (error) {
    console.error("[contact] send failed:", error.message);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to send message. Please try again later.",
        rateLimit: { remaining },
      },
      { status: 500 }
    );
  }
}
