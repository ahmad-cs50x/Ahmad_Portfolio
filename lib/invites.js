import { randomBytesBase64Url, sha256Hex } from "@/lib/edge-crypto";
import { getSupabaseAdmin } from "@/lib/db";

/** Invites are valid for 14 days unless a different span is passed in. */
export const DEFAULT_INVITE_DAYS = 14;

/**
 * Tokens are 32 random bytes, base64url-encoded. Only the SHA-256 hash is ever
 * written to the database, so a database leak cannot be replayed as a working
 * invite link — the same reason you don't store raw password material.
 */
export function generateToken() {
  return randomBytesBase64Url(32);
}

export async function hashToken(token) {
  return sha256Hex(token);
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
  const envAdmins = (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const hardcodedAdmins = ['ranaahmadranaahmad741@gmail.com', 'ahmedcs50x@gmail.com'].map(e => e.toLowerCase());
  const superAdmins = [...new Set([...envAdmins, ...hardcodedAdmins])];
  if (superAdmins.includes(normalized)) {
    return { allowed: true, reason: "super-admin-env" };
  }

  // 0.5. If no profiles exist at all, allow the first user to sign up (bootstrap).
  // This avoids requiring an invite for the very first account.
  const { count, error: countError } = await sb
    .from("profiles")
    .select("*", { count: "exact", head: true });
  if (countError) {
    console.error("[invites] profile count failed:", countError.message);
    return { allowed: false, reason: "database-error" };
  }
  if (count === 0) {
    return { allowed: true, reason: "first-user-bootstrap" };
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
      "[invites] invite lookup failed (has the supabase migration been run?):",
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
 * Creates (or refreshes) an invite and notifies via Telegram.
 *
 * Re-inviting an address with a live invite rotates the token rather than
 * erroring — the usual reason an admin clicks invite twice is that the first
 * message never arrived. A partial unique index enforces one live row per address.
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
    token_hash: await hashToken(token),
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
          message: `${error.message} — if the invites table is missing, run the supabase migration.`,
        };
      }
      return { ok: false, message: error.message };
    }
    invite = data;
  }

  // Send last: if the message fails the invite still exists and can be resent,
  // which is far better than a sent message with no matching row.
  const sent = await sendInviteNotification({ email: normalized, token, expiresAt, note, password: invite.password });
  if (!sent.ok) {
    return {
      ok: false,
      message: `Invite saved, but the Telegram notification could not be sent: ${sent.message}`,
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
/* Telegram notification                                               */
/* ------------------------------------------------------------------ */

export function isInviteMailConfigured() {
  return Boolean(process.env.TG_BOT_TOKEN && process.env.TG_CHAT_ID);
}

export async function sendInviteNotification({ email, token, expiresAt, note, password }) {
  const botToken = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;
  if (!botToken || !chatId) {
    return { ok: false, message: "Telegram is not configured (TG_BOT_TOKEN / TG_CHAT_ID)." };
  }

  const url = `${siteOrigin()}/invite/${token}?autologin=1`;
  const name = email.split("@")[0];
  const expires = new Date(expiresAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const message = [
    "🚀 *New Portal Invite*",
    "",
    `👤 *Name:* ${name}`,
    `📧 *Email:* ${email}`,
    note ? `📝 *Note:* ${note}` : null,
    "",
    `🔑 *Temporary Password:* \`${password || "(set by admin)"}\``,
    "",
    `🔗 *Open Portal:* ${url}`,
    "",
    `_This link signs you in automatically and expires on ${expires}._`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: Number(chatId),
        text: message,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[invites] Telegram send failed:", errorData);
      return { ok: false, message: errorData.description || "Failed to send notification" };
    }

    return { ok: true };
  } catch (error) {
    console.error("[invites] sendInviteNotification failed:", error.message);
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
    .eq("token_hash", await hashToken(token))
    .maybeSingle();

  return data ?? null;
}