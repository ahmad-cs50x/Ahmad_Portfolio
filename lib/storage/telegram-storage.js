/**
 * Telegram Cloud Storage as a backup/mirror object store.
 *
 * Primary mode (TG_CHANNEL_ID set): each object is a document in the private
 *   channel. File IDs are permanent and never expire.
 *
 * Fallback mode (TG_CHANNEL_ID absent): documents are sent as messages in the
 *   bot's own chat (TG_CHAT_ID).  Message IDs are stable enough for download
 *   and delete within the same process (the chat history is cached in chatFileMap).
 *
 * The module is Edge-runtime safe: only fetch, FormData, Blob, TextEncoder/
 * TextDecoder and the Web Crypto API — no Node.js built-ins.
 */

const API = "https://api.telegram.org";
const DEFAULT_TIMEOUT_MS = 25000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ── Cache ────────────────────────────────────────────────────────────────

// Channel file map: storagePath → { fileId, messageId }
export let cachedFileMap = new Map();
let fileMapLoadedAt = 0;

// Chat file map: same shape
export let chatFileMap = new Map();
let chatFileMapLoadedAt = 0;

// Cached /getMe result reused across map-builders and upload path.
let cachedMe = null;

// ── Helpers ──────────────────────────────────────────────────────────────

function token() {
  return process.env.TG_BOT_TOKEN;
}

function channelId() {
  return process.env.TG_CHANNEL_ID?.trim() || null;
}

function botUrl(method, search = "") {
  return `${API}/bot${token()}/${method}${search}`;
}

async function fetchJson(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function parseResult(res, method, path) {
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    const err = new Error(
      `Telegram API error (${method} ${path}): ${json?.description || res.status}`
    );
    err.status = res.status;
    err.tg = json;
    throw err;
  }
  return json.result;
}

async function botCall(method, path, { form } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const options = { method };
      if (form) {
        options.headers = { "Content-Type": "application/x-www-form-urlencoded" };
        options.body = new URLSearchParams(form).toString();
      }
      const res = await fetchJson(botUrl(path), options);
      return await parseResult(res, method, path);
    } catch (e) {
      lastErr = e;
      if (e.name === "AbortError" || (e.status && e.status < 500)) throw e;
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
    }
  }
  throw lastErr || new Error("Telegram request failed after retries");
}

// ── Channel upload ──────────────────────────────────────────────────────

async function sendDocument({ storagePath, bytes, filename, caption }) {
  const form = new FormData();
  form.append("chat_id", channelId());
  form.append("caption", caption);
  form.append("disable_notification", "true");
  form.append("document", new Blob([bytes], { type: "application/octet-stream" }), filename);

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchJson(botUrl("sendDocument"), { method: "POST", body: form });
      return await parseResult(res, "POST", "sendDocument");
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastErr || new Error("Telegram upload failed after retries");
}

function fileIdFrom(result) {
  const doc = result.document || result.audio || result.video || {};
  return doc.file_id || null;
}

// ── Chat upload ──────────────────────────────────────────────────────────

async function uploadToChat({ storagePath, bytes, filename, caption }) {
  const form = new FormData();
  form.append("chat_id", process.env.TG_CHAT_ID);
  form.append("disable_notification", "true");
  form.append("document", new Blob([bytes], { type: "application/octet-stream" }), filename);

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchJson(botUrl("sendDocument"), { method: "POST", body: form });
      return await parseResult(res, "POST", "sendDocument");
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastErr || new Error("Telegram chat upload failed after retries");
}

async function deleteFromChat({ fileId, messageId }) {
  await botCall("POST", "deleteMessage", {
    form: { chat_id: process.env.TG_CHAT_ID, message_id: messageId },
  });
}

// ── Cache refresh ────────────────────────────────────────────────────────

export async function refreshFileMap() {
  if (fileMapLoadedAt && Date.now() - fileMapLoadedAt < 60_000) return cachedFileMap;

  let botId = null;
  if (cachedMe) {
    botId = cachedMe.id;
  } else {
    cachedMe = await botCall("GET", "getMe");
    botId = cachedMe.id;
  }

  const channelId = Number(channelId());
  if (!channelId) return cachedFileMap;

  let lastOffset = 0;
  let hasMore = true;
  while (hasMore) {
    const updates = await botCall("POST", "getUpdates", {
      form: {
        timeout: "0",
        offset: String(lastOffset),
        allowed_updates: JSON.stringify(["channel_post"]),
      },
    });
    if (!updates) break;
    for (const u of updates) {
      const msg = u.channel_post;
      if (!msg || msg.chat?.id !== channelId) continue;
      if (msg.from && msg.from.id !== botId) continue;
      const doc = msg.document || msg.audio || msg.video;
      if (!doc?.file_name) continue;
      const key = String(doc.file_name).replace(/^\/+/, "");
      if (!cachedFileMap.has(key)) {
        cachedFileMap.set(key, {
          fileId: doc.file_id,
          messageId: msg.message_id,
        });
      }
    }
    lastOffset = updates.length;
    hasMore = updates.length > 0;
  }
  fileMapLoadedAt = Date.now();
  return cachedFileMap;
}

export async function bootstrapChatFiles() {
  if (chatFileMapLoadedAt && Date.now() - chatFileMapLoadedAt < 60_000) return chatFileMap;
  const chatId = Number(process.env.TG_CHAT_ID) || 0;
  let botId = null;
  if (cachedMe) {
    botId = cachedMe.id;
  } else {
    cachedMe = await botCall("GET", "getMe");
    botId = cachedMe.id;
  }

  let lastOffset = 0;
  let hasMore = true;
  while (hasMore) {
    const updates = await botCall("POST", "getUpdates", {
      form: {
        timeout: "0",
        offset: String(lastOffset),
        allowed_updates: JSON.stringify(["message"]),
      },
    });
    if (!updates) break;
    for (const u of updates) {
      const msg = u.message;
      if (!msg?.from || msg.from.id !== botId) continue;
      if (msg.chat?.id !== chatId) continue;
      const doc = msg.document || msg.audio || msg.video;
      if (!doc?.file_name) continue;
      const key = String(doc.file_name).replace(/^\/+/, "");
      if (!chatFileMap.has(key)) {
        chatFileMap.set(key, {
          fileId: doc.file_id,
          messageId: msg.message_id,
        });
      }
    }
    lastOffset = updates.length;
    hasMore = updates.length > 0;
  }
  chatFileMapLoadedAt = Date.now();
  return chatFileMap;
}

// ── Public API ──────────────────────────────────────────────────────────

export function isTgConfigured() {
  return Boolean(process.env.TG_BOT_TOKEN);
}

async function checkConfigured() {
  if (!isTgConfigured()) {
    throw new Error("Telegram Cloud Storage is not configured");
  }
  if (!cachedMe) {
    cachedMe = await botCall("GET", "getMe");
  }
  return cachedMe;
}

export async function uploadBuffer({ storagePath, buffer, contentType }) {
  await checkConfigured();
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  // Prefer channel if configured
  if (channelId()) {
    try {
      const result = await sendDocument({
        storagePath,
        bytes,
        filename: storagePath,
        caption: storagePath,
      });
      const fileId = fileIdFrom(result);
      if (!fileId) throw new Error("Telegram upload did not return a file_id");
      cachedFileMap.set(storagePath, {
        fileId,
        messageId: result.message_id,
        size: bytes.byteLength,
      });
      return {
        fileId,
        messageId: result.message_id,
        size: bytes.byteLength,
        fileName: storagePath,
      };
    } catch {
      // channel failed → fall through to chat
    }
  }

  // Fallback: chat-based storage
  const result = await uploadToChat({
    storagePath,
    bytes,
    filename: storagePath,
    caption: storagePath,
  });
  const fileId = fileIdFrom(result);
  if (!fileId) throw new Error("Telegram upload did not return a file_id");
  cachedFileMap.set(storagePath, {
    fileId,
    messageId: result.message_id,
    size: bytes.byteLength,
  });
  await bootstrapChatFiles();
  chatFileMap.set(storagePath, {
    fileId,
    messageId: result.message_id,
    size: bytes.byteLength,
  });
  return {
    fileId,
    messageId: result.message_id,
    size: bytes.byteLength,
    fileName: storagePath,
  };
}

export async function putText({ storagePath, text }) {
  await checkConfigured();
  const bytes = encoder.encode(text ?? "");

  if (channelId()) {
    try {
      const result = await sendDocument({
        storagePath,
        bytes,
        filename: storagePath,
        caption: storagePath,
      });
      const fileId = fileIdFrom(result);
      if (!fileId) throw new Error("Telegram upload did not return a file_id");
      cachedFileMap.set(storagePath, {
        fileId,
        messageId: result.message_id,
        size: bytes.byteLength,
      });
      return {
        fileId,
        messageId: result.message_id,
        size: bytes.byteLength,
        fileName: storagePath,
      };
    } catch {
      // channel failed
    }
  }

  // Fallback: chat
  const result = await uploadToChat({
    storagePath,
    bytes,
    filename: storagePath,
    caption: storagePath,
  });
  const fileId = fileIdFrom(result);
  if (!fileId) throw new Error("Telegram upload did not return a file_id");
  cachedFileMap.set(storagePath, {
    fileId,
    messageId: result.message_id,
    size: bytes.byteLength,
  });
  await bootstrapChatFiles();
  chatFileMap.set(storagePath, {
    fileId,
    messageId: result.message_id,
    size: bytes.byteLength,
  });
  return {
    fileId,
    messageId: result.message_id,
    size: bytes.byteLength,
    fileName: storagePath,
  };
}

/** Returns { fileId, messageId } for a stored path, or null. */
export async function findFile(storagePath) {
  const cached = cachedFileMap.get(storagePath);
  if (cached) return cached;
  await refreshFileMap();
  const ch = cachedFileMap.get(storagePath);
  if (ch) return ch;
  await bootstrapChatFiles();
  return chatFileMap.get(storagePath) || null;
}

async function downloadFile(fileId) {
  const result = await botCall("GET", `getFile?file_id=${encodeURIComponent(fileId)}`);
  const fileUrl = `https://api.telegram.org/file/bot${token()}/${result.file_path}`;
  const res = await fetchJson(fileUrl, { method: "GET" });
  if (!res.ok) throw new Error(`Telegram download failed (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function downloadStream(fileId, { start, end } = {}) {
  const buf = await downloadFile(fileId);
  if (!Number.isInteger(start) && !Number.isInteger(end)) return buf;
  const s = Number.isInteger(start) ? start : 0;
  const e = Number.isInteger(end) ? end : buf.byteLength - 1;
  return buf.subarray(Math.max(0, s), Math.min(buf.byteLength, e + 1));
}

export async function getText(fileId) {
  const buf = await downloadFile(fileId);
  return decoder.decode(buf);
}

/** Deletes an object. Prefers messageId (removes the channel/post). */
export async function deleteObject({ fileId, messageId, storagePath }) {
  await checkConfigured();
  const targetChat = channelId() || process.env.TG_CHAT_ID;

  if (messageId) {
    try {
      await botCall("POST", "deleteMessage", {
        form: { chat_id: targetChat, message_id: messageId },
      });
      if (storagePath) {
        cachedFileMap.delete(storagePath);
        chatFileMap.delete(storagePath);
      }
      return;
    } catch {
      /* fall through */
    }
  }
  if (fileId && !messageId) {
    throw new Error(
      "Telegram deleteObject requires the message id; provide message_id to remove the post."
    );
  }
}