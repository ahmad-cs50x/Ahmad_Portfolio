import { sha256Hex, timingSafeEqualStr } from "@/lib/edge-crypto";

/**
 * The email-password login scheme. The admin sets a password when they invite a
 * user (app/api/invites/route.js). Only its SHA-256 digest over `password +
 * secret` is ever stored in `accounts.password_hash`, so a leaked database
 * cannot be replayed as a working password.
 *
 * On the server the cookie is HttpOnly and the browsing session is a database
 * session — the raw password never leaves the login form except over HTTPS.
 */
function passwordSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-only-insecure-secret-change-me";
}

export async function hashPassword(password) {
  return sha256Hex(String(password ?? "") + passwordSecret());
}

export async function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;
  // Compare in constant time to avoid a timing oracle on the password field.
  const candidate = await hashPassword(password);
  return timingSafeEqualStr(candidate, String(storedHash));
}