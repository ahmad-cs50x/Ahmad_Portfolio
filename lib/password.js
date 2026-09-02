import crypto from "crypto";

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

export function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(String(password ?? "") + passwordSecret())
    .digest("hex");
}

export function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;
  // Compare in constant time to avoid a timing oracle on the password field.
  const candidate = hashPassword(password);
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(String(storedHash), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
