/**
 * Crypto helpers usable on the Edge runtime and in Node 18+.
 * Uses only globalThis.crypto (Web Crypto) — no `node:crypto` imports.
 */

const encoder = new TextEncoder();

export function randomBytes(length) {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function toHex(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

export function bytesToBase64Url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomBytesHex(length) {
  return toHex(randomBytes(length));
}

export function randomBytesBase64Url(length) {
  return bytesToBase64Url(randomBytes(length));
}

export async function sha256Hex(input) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(String(input)));
  return toHex(new Uint8Array(digest));
}

/** Constant-time string comparison to avoid a timing oracle. */
export function timingSafeEqualStr(a, b) {
  const x = String(a);
  const y = String(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}