import crypto from "crypto";
import nodemailer from "nodemailer";
import { getSupabaseAdmin } from "@/lib/db";

/** Invites are valid for 14 days unless a different span is passed in. */
export const DEFAULT_INVITE_DAYS = 14;

/**
 * Tokens are 32 random bytes, base64url-encoded. Only the SHA-256 hash is ever
 * written to the database, so a database leak cannot be replayed as a working
 * invite link — the same reason you don't store raw password material.
 */
function generateToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function siteOrigin() {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

/* ------------------------------------------------------------------ */
/* The sign-in gate                                                    */
/* ------------------------------------------------------------------ */

/**
 * The single source of truth for "may this address sign in?".
 *
 * Called from the NextAuth `signIn` callback for EVERY provider, Google
 * included. Returns a small object rather than a boolean so the caller can send
 * a specific error code to the login page instead of a generic failure.
 *
 * Order matters: an existing profile wins. Once someone has signed in, their
 * invite is marked accepted and revoking it must not lock them out mid-session
 * — deleting the profile is the way to remove access.
 */
export async function checkSignInAllowed(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return { allowed: false, reason: "no-email" };

  const sb = getSupabaseAdmin();
  if (!sb) return { allowed: false, reason: "no-database" };

  // 1. Explicitly configured admins always get in — this is the bootstrap door,
  //    and it must not depend on a table that might not exist yet.
  const superAdmins = (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (superAdmins.includes(normalized)) {
    return { allowed: true, reason: "super-admin-env" };
  }

  // 2. Anyone who already has a profile has been let in before.
  const { data: profile, error: profileError } = await sb
    .from("profiles")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();
  if (profileError) {
    console.error("[invites] profile lookup failed:", profileError.message);
    return { allowed: false, reason: "database-error" };
  }
  if (profile) return { allowed: true, reason: "existing-profile" };

  // 3. Otherwise there must be a live invite.
  const { data: invite, error: inviteError } = await sb
    .from("invites")
    .select("id,email,role,client_id,company_name,expires_at,accepted_at,revoked_at")
    .eq("email", normalized)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inviteError) {
    // Most likely the invites table doesn't exist yet. Fail closed, but say so
    // loudly — silently allowing everyone would defeat the whole feature.
    console.error(
      "[invites] invite lookup failed (has `npm run db:migrate` been run?):",
      inviteError.message
    );
    return { allowed: false, reason: "database-error" };
  }

  if (!invite) return { allowed: false, reason: "not-invited" };
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { allowed: false, reason: "invite-expired", invite };
  }

  return { allowed: true, reason: "invited", invite };
}

/** Stamps accepted_at the first time an invited address actually signs in. */
export async function markInviteAccepted(email) {
  const normalized = normalizeEmail(email);
  const sb = getSupabaseAdmin();
  if (!sb || !normalized) return;

  const { error } = await sb
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("email", normalized)
    .is("accepted_at", null)
    .is("revoked_at", null);

  if (error) console.error("[invites] markInviteAccepted failed:", error.message);
}

/**
 * The invite for an address, if any — used when creating the profile so the
 * invitee lands on the role and client workspace the admin chose.
 */
export async function pendingInviteFor(email) {
  const normalized = normalizeEmail(email);
  const sb = getSupabaseAdmin();
  if (!sb || !normalized) return null;

  const { data } = await sb
    .from("invites")
    .select("id,email,role,client_id,company_name")
    .eq("email", normalized)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

/* ------------------------------------------------------------------ */
/* Admin operations                                                    */
/* ------------------------------------------------------------------ */

/**
 * Creates (or refreshes) an invite and emails it.
 *
 * Re-inviting an address with a live invite rotates the token rather than
 * erroring — the usual reason an admin clicks invite twice is that the first
 * mail never arrived. A partial unique index enforces one live row per address.
 */
export async function createInvite({
  email,
  role = "CLIENT",
  clientId = null,
  companyName = null,
  note = null,
  invitedBy = null,
  days = DEFAULT_INVITE_DAYS,
  password = null,
}) {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return { ok: false, message: "That doesn't look like a valid email address." };
  }

  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, message: "Database is not configured." };

  const { data: existingProfile } = await sb
    .from("profiles")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();
  if (existingProfile) {
    return { ok: false, message: "That address already has an account — no invite needed." };
  }

  const token = generateToken();
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { data: live } = await sb
    .from("invites")
    .select("id,send_count")
    .eq("email", normalized)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .maybeSingle();

  const payload = {
    email: normalized,
    token_hash: hashToken(token),
    role: role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "CLIENT",
    client_id: clientId || null,
    company_name: companyName || null,
    note: note || null,
    invited_by: invitedBy || null,
    expires_at: expiresAt,
    last_sent_at: nowIso,
    password: password || null,
  };

  let invite;
  if (live) {
    const { data, error } = await sb
      .from("invites")
      .update({ ...payload, send_count: (live.send_count ?? 0) + 1 })
      .eq("id", live.id)
      .select("id,email,role,expires_at,send_count,password")
      .single();
    if (error) return { ok: false, message: error.message };
    invite = data;
  } else {
    const { data, error } = await sb
      .from("invites")
      .insert({ ...payload, send_count: 1 })
      .select("id,email,role,expires_at,send_count,password")
      .single();
    if (error) {
      if (error.message?.includes("invites")) {
        return {
          ok: false,
          message: `${error.message} — if the invites table is missing, run \`npm run db:migrate\`.`,
        };
      }
      return { ok: false, message: error.message };
    }
    invite = data;
  }

  // Send last: if the mail fails the invite still exists and can be resent,
  // which is far better than a sent mail with no matching row.
  const sent = await sendInviteEmail({ email: normalized, token, expiresAt, note, password: invite.password });
  if (!sent.ok) {
    return {
      ok: false,
      message: `Invite saved, but the email could not be sent: ${sent.message}`,
      invite,
      emailFailed: true,
    };
  }

  return { ok: true, invite };
}

export async function revokeInvite(id) {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, message: "Database is not configured." };

  const { error } = await sb
    .from("invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("accepted_at", null);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function listInvites() {
  const sb = getSupabaseAdmin();
  if (!sb) return { invites: [], error: "Database is not configured." };

  const { data, error } = await sb
    .from("invites")
    .select("id,email,role,company_name,note,expires_at,accepted_at,revoked_at,send_count,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[invites] list failed:", error.message);
    return { invites: [], error: error.message };
  }
  return { invites: data ?? [], error: null };
}

/** Derived state for the admin table — keeps that logic out of the component. */
export function inviteStatus(invite) {
  if (invite.revoked_at) return "revoked";
  if (invite.accepted_at) return "accepted";
  if (new Date(invite.expires_at).getTime() < Date.now()) return "expired";
  return "pending";
}

/* ------------------------------------------------------------------ */
/* Mail                                                                */
/* ------------------------------------------------------------------ */

function smtpOptions() {
  const port = Number(process.env.SMTP_PORT || 587);
  return {
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  };
}

export function isInviteMailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
}

function inviteHtml({ url, expiresAt, note, email, password }) {
  const expires = new Date(expiresAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const name = email.split("@")[0];
  const autoLoginUrl = `${url}?autologin=1`;
  return `
  <div style="background:#050505;padding:40px;font-family:-apple-system,Segoe UI,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#101014;border:1px solid #26262e;border-radius:16px;padding:36px">
      <p style="color:#22d3ee;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.22em;text-transform:uppercase;margin:0 0 14px">
        Client Portal
      </p>
      <h1 style="color:#fff;font-size:24px;line-height:1.25;margin:0 0 14px">
        You've been invited to Ahmad's client portal
      </h1>
      <p style="color:#a1a1aa;font-size:14px;line-height:1.65;margin:0 0 20px">
        The portal is where we track project progress, share files and message each
        other directly. Below are your login credentials.
      </p>
      ${
        note
          ? `<div style="border-left:2px solid #7c3aed;padding:2px 0 2px 14px;margin:0 0 22px">
               <p style="color:#d4d4d8;font-size:14px;line-height:1.6;margin:0;font-style:italic">${note}</p>
             </div>`
          : ""
      }
      <p style="color:#d4d4d8;font-size:15px;line-height:1.6;margin:0 0 16px">
        Hi ${name}, here are your credentials
      </p>
      ${
        password
          ? `<div style="background:#1a1a2e;border:1px solid #2a2a3e;border-radius:12px;padding:20px;margin:0 0 22px">
               <p style="color:#a1a1aa;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px">Your Credentials</p>
               <p style="color:#d4d4d8;font-size:13px;margin:0 0 6px"><strong style="color:#7c3aed">Email:</strong> ${email}</p>
               <p style="color:#d4d4d8;font-size:13px;margin:0"><strong style="color:#7c3aed">Password:</strong> <span style="font-family:ui-monospace,monospace;background:#0f0f1a;padding:3px 8px;border-radius:6px;border:1px solid #2a2a3e">${password}</span></p>
             </div>`
          : ""
      }
      <a href="${autoLoginUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 30px;border-radius:10px">
        Open Portal Now
      </a>
      <p style="color:#71717a;font-size:12px;line-height:1.6;margin:26px 0 0">
        This link signs you in automatically — no need to enter your password. Expires on ${expires}.
      </p>
      <p style="color:#52525b;font-size:12px;line-height:1.6;margin:10px 0 0">
        You can also sign in manually at <a href="${siteOrigin()}/login" style="color:#7c3aed;text-decoration:none">${siteOrigin()}/login</a> using the email and password above.
      </p>
      <p style="color:#3f3f46;font-size:11px;margin:20px 0 0">
        If you weren't expecting this, you can ignore it. Nothing happens until you sign in.
      </p>
    </div>
  </div>`;
}

async function sendInviteEmail({ email, token, expiresAt, note, password }) {
  if (!isInviteMailConfigured()) {
    return { ok: false, message: "SMTP is not configured (SMTP_HOST / SMTP_USER)." };
  }

  const url = `${siteOrigin()}/invite/${token}`;
  const name = email.split("@")[0];
  const autoLoginUrl = `${url}?autologin=1`;

  try {
    const transport = nodemailer.createTransport(smtpOptions());
    const result = await transport.sendMail({
      to: email,
      from: `"Ahmad Portfolio" <${process.env.SMTP_USER}>`,
      subject: "Your portal access — login credentials inside",
      text: [
        "You've been invited to Ahmad's client portal.",
        "The portal is where we track project progress, share files and message each other directly.",
        "",
        note ? `Note: ${note}` : null,
        note ? "" : null,
        `Hi ${name}, here are your credentials`,
        "",
        "Your credentials:",
        `  Email: ${email}`,
        `  Password: ${password || "(set by admin)"}`,
        "",
        `Open your portal directly: ${autoLoginUrl}`,
        "",
        `This link signs you in automatically — no need to enter your password.`,
        `You can also sign in manually at ${siteOrigin()}/login using the email and password above.`,
        "",
        `This invitation expires on ${new Date(expiresAt).toDateString()}.`,
      ]
        .filter((line) => line !== null)
        .join("\n"),
      html: inviteHtml({ url, expiresAt, note, email, password }),
    });

    // Nodemailer resolves even when a recipient was refused — check explicitly,
    // the same way lib/auth.js does for the magic-link mail.
    const failed = [...(result.rejected || []), ...(result.pending || [])].filter(Boolean);
    if (failed.length) return { ok: false, message: `Rejected for ${failed.join(", ")}` };

    return { ok: true };
  } catch (error) {
    console.error("[invites] sendInviteEmail failed:", error.message);
    return { ok: false, message: error.message };
  }
}

/** Resolves an invite from the raw token in an /invite/<token> URL. */
export async function inviteFromToken(token) {
  const sb = getSupabaseAdmin();
  if (!sb || !token) return null;

  const { data } = await sb
    .from("invites")
    .select("id,email,role,company_name,note,expires_at,accepted_at,revoked_at,password")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  return data ?? null;
}
