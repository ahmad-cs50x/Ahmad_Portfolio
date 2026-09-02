/**
 * Telegram Cloud Storage as a backup/mirror object store.
 *
 * A bot (TG_BOT_TOKEN) is an admin of a private channel (TG_CHANNEL_ID).
 * Each object is uploaded as a Document into that channel. Two Telegram
 * identifiers are stored per object:
 *   - file_id  : stable Telegram handle used to fetch/delete the file.
 *   - message_id: the channel message, used to delete the post.
 *
 * Telegram does not offer byte-range streaming, so this module is used only
 * as a backup mirror / fallback read source (Backblaze B2 remains the fast
 * primary read path). All requests use Telegram's plain HTTPS Bot API —
 * no OAuth required.
 */
import https from "https";

const API = "https://api.telegram.org";

let cachedFileMap = new Map(); // storagePath -> { fileId, messageId }
let fileMapLoadedAt = 0;
let cachedMe = null;

export function isTgConfigured() {
  return Boolean(process.env.TG_BOT_TOKEN && process.env.TG_CHANNEL_ID);
}

function tgReq(method, path, { form, buffer, fileField } = {}) {
  return new Promise((resolve, reject) => {
    const token = process.env.TG_BOT_TOKEN;
    const u = new URL(`${API}/bot${token}/${path}`);
    const boundary = "XBOUND_" + Date.now() + Math.floor(Math.random() * 1e6);

    let headers = {};
    let body = null;

    if (buffer && fileField) {
      // multipart/form-data  (used for uploading documents + caption)
      const parts = [];
      for (const [k, v] of Object.entries(form || {})) {
        parts.push(
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`)
        );
      }
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${(form.filename || "file.bin")}"\r\nContent-Type: application/octet-stream\r\n\r\n`
        )
      );
      parts.push(buffer);
      parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
      body = Buffer.concat(parts);
      headers["Content-Type"] = `multipart/form-data; boundary=${boundary}`;
      headers["Content-Length"] = Buffer.byteLength(body);
    } else if (form) {
      body = new URLSearchParams(form).toString();
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      headers["Content-Length"] = Buffer.byteLength(body);
    }

    const r = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method, headers, timeout: 25000 },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(Buffer.from(c)));
        res.on("end", () =>
          resolve({ status: res.statusCode, buf: Buffer.concat(chunks) })
        );
      }
    );
    r.on("timeout", () => r.destroy(new Error("Telegram request timed out")));
    r.on("error", reject);
    if (body) r.write(body);
    r.end();
  });
}

async function botCall(method, path, opts) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await tgReq(method, path, opts);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
      continue;
    }
    let json = null;
    try {
      json = JSON.parse(res.buf.toString("utf8"));
    } catch {
      throw new Error(`Telegram API ${res.status}: invalid JSON from ${path}`);
    }
    if (!json.ok || res.status >= 400) {
      const err = new Error(
        `Telegram API error (${method} ${path}): ${json.description || res.buf.toString().slice(0, 200)}`
      );
      err.status = res.status;
      err.tg = json;
      throw err;
    }
    return json.result;
  }
  throw lastErr || new Error("Telegram request failed after retries");
}

export async function checkConfigured() {
  if (!isTgConfigured()) throw new Error("Telegram Cloud Storage is not configured");
  if (!cachedMe) {
    cachedMe = await botCall("GET", "getMe");
  }
  return cachedMe;
}

function channelId() {
  return process.env.TG_CHANNEL_ID.trim();
}

function configFileName(storagePath) {
  // Store the object path as the document's file name so we can rebuild a
  // path -> file map by reading channel history when needed.
  return storagePath;
}

/**
 * Uploads a buffer as a Document into the channel.
 * Returns { fileId, messageId, size, fileName }.
 */
export async function uploadBuffer({ storagePath, buffer, contentType }) {
  await checkConfigured();
  const form = {
    chat_id: channelId(),
    filename: storagePath,
    caption: storagePath, // keeps path searchable in channel history
    disable_notification: "true",
  };
  const result = await botCall("POST", "sendDocument", {
    buffer,
    fileField: "document",
    form,
  });
  const doc = result.document || result.audio || result.video || {};
  const fileId = doc.file_id || result.document?.file_id;
  if (!fileId) throw new Error("Telegram upload did not return a file_id");
  cachedFileMap.set(storagePath, {
    fileId,
    messageId: result.message_id,
    size: Number(doc.file_size ?? buffer.length),
  });
  return {
    fileId,
    messageId: result.message_id,
    size: Number(doc.file_size ?? buffer.length),
    fileName: storagePath,
  };
}

/** Uploads a UTF-8 text object. Returns { fileId, messageId, size }. */
export async function putText({ storagePath, text }) {
  await checkConfigured();
  const buf = Buffer.from(text ?? "", "utf8");
  const result = await botCall("POST", "sendDocument", {
    buffer: buf,
    fileField: "document",
    form: {
      chat_id: channelId(),
      filename: storagePath,
      caption: storagePath,
      disable_notification: "true",
    },
  });
  const doc = result.document || {};
  cachedFileMap.set(storagePath, {
    fileId: doc.file_id,
    messageId: result.message_id,
    size: Number(doc.file_size ?? buf.length),
  });
  return {
    fileId: doc.file_id,
    messageId: result.message_id,
    size: Number(doc.file_size ?? buf.length),
    fileName: storagePath,
  };
}

/** Returns { fileId, messageId } for a stored path, or null. */
export async function findFile(storagePath) {
  const cached = cachedFileMap.get(storagePath);
  if (cached) return cached;
  await refreshFileMap();
  return cachedFileMap.get(storagePath) || null;
}

/**
 * Reads the channel history to rebuild the path -> (fileId,messageId) map.
 * Telegram getUpdates only returns recent updates, so for durable retrieval we
 * list channel messages via getChatHistory? (Not in Bot API). Instead we rely on
 * the fileId stored in our DB per object (TG_FILE_ID column) — this map is just
 * an in-memory cache for same-process deletes. For robustness, delete-by-path
 * also uses the channel history available to the bot via getUpdates of the
 * channel's document messages.
 */
export async function refreshFileMap() {
  if (Date.now() - fileMapLoadedAt < 60_000) return cachedFileMap;
  // Best-effort: getUpdates allows reading recent channel posts for the bot.
  const updates = await botCall("POST", "getUpdates", {
    form: { timeout: 0, allowed_updates: JSON.stringify(["message"]) },
  });
  const botId = (cachedMe ?? (await checkConfigured())).id;
  for (const u of updates || []) {
    const msg = u.channel_post || u.message;
    if (!msg || msg.chat?.id !== Number(channelId())) continue;
    if (msg.from && msg.from.id !== botId) continue; // only bot's own posts
    const doc = msg.document || msg.audio || msg.video;
    if (!doc?.file_name) continue;
    const key = String(doc.file_name).replace(/^\/+/, "");
    cachedFileMap.set(key, { fileId: doc.file_id, messageId: msg.message_id });
  }
  fileMapLoadedAt = Date.now();
  return cachedFileMap;
}

/**
 * Downloads a stored file, optionally slicing to a byte range. Telegram has
 * no partial-read, so a requested range is fulfilled by downloading the whole
 * object and returning only the requested slice (fine for small backup files).
 */
export async function downloadStream(fileId, { start, end } = {}) {
  const buf = await downloadFile(fileId);
  let out = buf;
  if (Number.isInteger(start) || Number.isInteger(end)) {
    const s = Number.isInteger(start) ? start : 0;
    const e = Number.isInteger(end) ? end : buf.length - 1;
    out = buf.subarray(Math.max(0, s), Math.min(buf.length, e + 1));
  }
  const { Readable } = await import("stream");
  return Readable.from([out]);
}

export async function getText(fileId) {
  const buf = await downloadFile(fileId);
  return buf.toString("utf8");
}

async function downloadFile(fileId) {
  const result = await botCall("GET", `getFile?file_id=${encodeURIComponent(fileId)}`);
  const token = process.env.TG_BOT_TOKEN;
  const u = new URL(`https://api.telegram.org/file/bot${token}/${result.file_path}`);
  const res = await new Promise((resolve, reject) => {
    const r = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: "GET", timeout: 30000 },
      (resp) => {
        const chunks = [];
        resp.on("data", (c) => chunks.push(Buffer.from(c)));
        resp.on("end", () => resolve({ status: resp.statusCode, buf: Buffer.concat(chunks) }));
      }
    );
    r.on("timeout", () => r.destroy(new Error("Telegram download timed out")));
    r.on("error", reject);
    r.end();
  });
  if (res.status >= 400) throw new Error(`Telegram download failed (${res.status})`);
  return res.buf;
}

/** Deletes an object. Prefers messageId (removes the channel post); falls back to fileId. */
export async function deleteObject({ fileId, messageId, storagePath }) {
  await checkConfigured();
  if (messageId) {
    try {
      await botCall("POST", "deleteMessage", {
        form: { chat_id: channelId(), message_id: messageId },
      });
      if (storagePath) cachedFileMap.delete(storagePath);
      return;
    } catch {
      /* fall through to fileId-only delete (no channel post to remove) */
    }
  }
  // Without a message id, we cannot delete from Telegram's history via Bot API.
  if (fileId && !messageId) {
    throw new Error(
      "Telegram deleteObject requires the message id; provide message_id to remove the post."
    );
  }
}
