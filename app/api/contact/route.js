import { NextResponse } from "next/server";
import { ratelimit } from "@/lib/rate-limit";
import { sendContactEmail } from "@/lib/email";

// Validation helper
function validateContactForm(data) {
  const errors = [];

  if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
    errors.push({ field: "name", message: "Name is required" });
  } else if (data.name.trim().length > 80) {
    errors.push({ field: "name", message: "Name must be 80 characters or less" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email)) {
    errors.push({ field: "email", message: "A valid email is required" });
  }

  if (data.subject && data.subject.length > 120) {
    errors.push({ field: "subject", message: "Subject must be 120 characters or less" });
  }

  if (!data.message || typeof data.message !== "string" || data.message.trim().length === 0) {
    errors.push({ field: "message", message: "Message is required" });
  } else if (data.message.trim().length < 10) {
    errors.push({ field: "message", message: "Message must be at least 10 characters" });
  } else if (data.message.length > 2000) {
    errors.push({ field: "message", message: "Message must be 2000 characters or less" });
  }

  return errors;
}

export async function POST(request) {
  try {
    // Rate limiting - get IP from headers
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               request.headers.get("x-real-ip") ||
               "anonymous";

    const { success, limit, remaining, reset } = await ratelimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          message: `Too many requests. Please try again in ${Math.ceil((reset - Date.now()) / 1000 / 60)} minutes.`,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(reset),
            "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
          },
        }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const errors = validateContactForm(body);
    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, message: errors[0].message, errors },
        { status: 422 }
      );
    }

    const { name, email, subject, message } = body;

    const result = await sendContactEmail({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject?.trim() || "New portfolio message",
      message: message.trim(),
    });

    if (!result.success) {
      console.error("[contact] Email failed:", result.error);
      return NextResponse.json(
        { success: false, message: "Failed to send message. Please try again later." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Message sent successfully! I'll get back to you within 24 hours.",
      },
      {
        status: 201,
        headers: {
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining - 1),
          "X-RateLimit-Reset": String(reset),
        },
      }
    );

  } catch (error) {
    console.error("[contact] Unexpected error:", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again later." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    service: "ahmad-portfolio-contact-api",
    timestamp: new Date().toISOString(),
  });
}
