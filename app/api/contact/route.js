import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

function smtpOptions() {
  const port = Number(process.env.SMTP_PORT || 587);
  return {
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  };
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const { name, email, subject, message } = body ?? {};

  if (!name || !email || !message) {
    return NextResponse.json(
      { success: false, message: "Name, email, and message are required." },
      { status: 400 },
    );
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    return NextResponse.json(
      { success: false, message: "Email is not configured on the server." },
      { status: 503 },
    );
  }

  try {
    const transport = nodemailer.createTransport(smtpOptions());
    await transport.sendMail({
      to: process.env.CONTACT_RECEIVER || process.env.SMTP_USER,
      from: `"${name}" <${process.env.SMTP_USER}>`,
      replyTo: email,
      subject: subject || `New message from ${name}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        "",
        message,
      ].join("\n"),
      html: `
        <div style="background:#050505;padding:40px;font-family:-apple-system,Segoe UI,sans-serif">
          <div style="max-width:520px;margin:0 auto;background:#101014;border:1px solid #26262e;border-radius:16px;padding:36px">
            <p style="color:#22d3ee;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.22em;text-transform:uppercase;margin:0 0 14px">Contact Form</p>
            <h1 style="color:#fff;font-size:20px;margin:0 0 16px">${subject || `New message from ${name}`}</h1>
            <p style="color:#a1a1aa;font-size:14px;margin:0 0 8px"><strong style="color:#d4d4d8">From:</strong> ${name} &lt;${email}&gt;</p>
            <div style="border-left:2px solid #7c3aed;padding:8px 0 8px 14px;margin:16px 0">
              <p style="color:#d4d4d8;font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap">${message}</p>
            </div>
          </div>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: "Message sent successfully!",
    });
  } catch (error) {
    console.error("[contact] send failed:", error.message);
    return NextResponse.json(
      { success: false, message: `Failed to send: ${error.message}` },
      { status: 500 },
    );
  }
}
