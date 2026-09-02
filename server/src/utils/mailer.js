const nodemailer = require("nodemailer");

let transporter = null;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

exports.sendMessage = async ({ name, email, subject, message }) => {
  const transport = getTransporter();

  if (!transport) {
    console.log("[contact] SMTP not configured — logging submission instead:");
    console.log(JSON.stringify({ name, email, subject, message }, null, 2));
    return { delivered: false, mocked: true };
  }

  await transport.sendMail({
    from: `"Portfolio" <${process.env.SMTP_USER}>`,
    to: process.env.RECEIVER_EMAIL || process.env.SMTP_USER,
    replyTo: email,
    subject: `[Portfolio] ${subject}`,
    text: `From: ${name} <${email}>\n\n${message}`,
    html: `
      <h2 style="font-family:sans-serif">New portfolio message</h2>
      <p><b>Name:</b> ${escapeHtml(name)}</p>
      <p><b>Email:</b> ${escapeHtml(email)}</p>
      <p><b>Subject:</b> ${escapeHtml(subject)}</p>
      <hr />
      <p style="white-space:pre-line;font-family:sans-serif">${escapeHtml(message)}</p>
    `,
  });

  return { delivered: true };
};
