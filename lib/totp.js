/**
 * TOTP (RFC 6238, SHA-1 / 6 digits / 30s) built on Web Crypto —
 * Edge-runtime safe. Replaces the Node-only `otplib` package.
 */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(input) {
  const cleaned = String(input).replace(/\s|[-=]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = B32.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** Generates a fresh 20-byte (160-bit) Base32 secret, matching otplib's default size. */
export function generateSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return base32Encode(bytes);
}

async function hmacSha1(keyBytes, inputBytes) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, inputBytes);
  return new Uint8Array(signature);
}

function dynamicTruncate(hmac) {
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return code;
}

/** Reads a Base32 secret and returns the code for the given epoch (unix seconds). */
export async function generateCode(secret, epoch = Math.floor(Date.now() / 1000), digits = 6, period = 30) {
  const keyBytes = base32Decode(secret);
  if (keyBytes.length < 8) throw new Error("TOTP secret is too short (needs ≥ 8 bytes).");

  const counter = Math.floor(epoch / period);
  const counterBytes = new Uint8Array(8);
  let value = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = value & 0xff;
    value = Math.floor(value / 256);
  }

  const hmac = await hmacSha1(keyBytes, counterBytes);
  const truncated = dynamicTruncate(hmac);
  return String(truncated % 10 ** digits).padStart(digits, "0");
}

/**
 * Verifies a user-supplied code against the stored secret.
 * `window` is the number of time-steps of tolerance on each side (default 0,
 * matching the app's previous otplib behavior).
 */
export async function verifyCode(secret, token, { window = 0, digits = 6, period = 30 } = {}) {
  const expected = String(token || "").trim();
  if (!/^\d+$/.test(expected) || expected.length !== digits) return false;

  const now = Math.floor(Date.now() / 1000);
  for (let step = -window; step <= window; step++) {
    const candidate = await generateCode(secret, now + step * period, digits, period);
    if (candidate === expected) return true;
  }
  return false;
}