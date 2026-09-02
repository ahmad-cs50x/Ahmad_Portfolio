import * as b2 from "./backblaze-b2";
import * as gcs from "./google-cloud-storage";
import * as tg from "./telegram-storage";

export const STORAGE_PROVIDER = "hybrid";

export function isStorageConfigured() {
  return b2.isB2Configured() || gcs.isGCSConfigured() || (tg.isTgConfigured() && tgConfiguredSafe());
}

function tgConfiguredSafe() {
  return true;
}

export function isGCSConfigured() {
  return gcs.isGCSConfigured();
}

export function isTgConfigured() {
  return tg.isTgConfigured();
}

function safeSegment(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** Builds the logical folder structure inside the bucket/folder. */
export function buildStoragePath({ clientId, projectId, purpose, fileType, originalName }) {
  const uuid = crypto.randomUUID();
  let folder = "misc";
  if (purpose === "blog") folder = `blog/images`;
  else if (purpose === "archive") folder = "archives";
  else if (purpose === "deliverable" && projectId) folder = `projects/${projectId}/deliverables`;
  else if (clientId) {
    const kind =
      fileType?.startsWith("audio/") ? "audio"
      : fileType?.startsWith("video/") ? "video"
      : "files";
    folder = `clients/${clientId}/messages/${kind}`;
  }
  return `${folder}/${uuid}-${safeSegment(originalName ?? "file.bin")}`;
}

/**
 * B2 capacity check for tiering. When B2_MAX_BYTES is set and the current
 * B2 footprint plus the incoming bytes would exceed it, the write is tiered
 * to Google Drive instead of B2. (Kept for legacy/explicitness.)
 */
export function b2Full(incomingBytes, b2BytesUsed = 0) {
  const cap = Number(process.env.B2_MAX_BYTES);
  if (!Number.isFinite(cap) || cap <= 0) return false;
  return (Number(b2BytesUsed) || 0) + (Number(incomingBytes) || 0) > cap;
}

/**
 * Telegram capacity check for tiering. When TG_MAX_BYTES is set and the
 * current Telegram footprint (tgBytesUsed) plus the incoming bytes would
 * exceed it, the write is tiered to Backblaze B2 instead of Telegram.
 */
export function tgFull(incomingBytes, tgBytesUsed = 0) {
  const cap = Number(process.env.TG_MAX_BYTES);
  if (!Number.isFinite(cap) || cap <= 0) return false;
  return (Number(tgBytesUsed) || 0) + (Number(incomingBytes) || 0) > cap;
}

/**
 * Writes a file binary.
 *
 * Primary: Backblaze Telegram Cloud Storage.
 * Fallback: Backblaze B2, used only when Telegram is full (TG_MAX_BYTES)
 * or unavailable/errors. Only the chosen provider stores the object; the
 * other does NOT mirror it (single-write with failover).
 */
export async function putFile(params) {
  const { buffer, storagePath, contentType, tgBytesUsed } = params;
  const size = buffer?.length ?? 0;
  const b2Available = b2.isB2Configured();
  const tgAvailable = tg.isTgConfigured();
  const useTg = tgAvailable && !tgFull(size, tgBytesUsed);

  const result = {
    size,
    storageProvider: useTg ? "telegram" : "backblaze-b2",
    b2: null,
    tg: null,
  };

  if (useTg) {
    try {
      const tp = await tg.uploadBuffer({ storagePath, buffer, contentType });
      result.tg = { fileId: tp.fileId, messageId: tp.messageId, fileName: tp.fileName };
      result.size = tp.size;
    } catch (e) {
      console.error("[storage] Telegram write failed, falling back to B2:", e.message);
      result.tg = null;
      result.storageProvider = "backblaze-b2";
    }
  }

  // Fallback / primary-when-Telegram-unavailable: Backblaze B2.
  if (!result.tg && b2Available) {
    try {
      const up = await b2.uploadBuffer(params);
      result.b2 = { fileId: up.fileId, fileName: up.fileName };
      result.size = up.size;
    } catch (e) {
      console.error("[storage] B2 write failed:", e.message);
      result.b2 = null;
    }
  }

  if (!result.tg && !result.b2) {
    throw new Error("Neither Telegram nor Backblaze B2 is available to store this file.");
  }

  // Set the final provider: Telegram if it stored, else B2.
  result.storageProvider = result.tg ? "telegram" : "backblaze-b2";

  return result;
}

/**
 * Writes a message-text object.
 * Primary: Telegram. Fallback: B2 only when Telegram is full/unavailable.
 * Returns { storageProvider, b2, tg, size }.
 */
export async function putText(params) {
  const { text, storagePath, tgBytesUsed } = params;
  const size = Buffer.byteLength(text ?? "", "utf8");
  const b2Available = b2.isB2Configured();
  const tgAvailable = tg.isTgConfigured();
  const useTg = tgAvailable && !tgFull(size, tgBytesUsed);

  const result = {
    size,
    storageProvider: useTg ? "telegram" : "backblaze-b2",
    b2FileId: null,
    tgFileId: null,
    tgMessageId: null,
    fileName: storagePath,
  };

  if (useTg) {
    try {
      const tp = await tg.putText(params);
      result.tgFileId = tp.fileId;
      result.tgMessageId = tp.messageId;
      result.fileName = tp.fileName ?? storagePath;
    } catch (e) {
      console.error("[storage] Telegram text write failed, falling back to B2:", e.message);
      result.storageProvider = "backblaze-b2";
    }
  }

  if (!result.tgFileId && b2Available) {
    try {
      const up = await b2.putText(params);
      result.b2FileId = up.fileId ?? null;
      result.fileName = up.fileName ?? storagePath;
    } catch (e) {
      console.error("[storage] B2 text write failed:", e.message);
    }
  }

  if (!result.tgFileId && !result.b2FileId) {
    throw new Error("Neither Telegram nor Backblaze B2 is available for message text.");
  }

  result.storageProvider = result.tgFileId ? "telegram" : "backblaze-b2";

  return result;
}

export async function getText(storagePath, { storageProvider, tgFileId } = {}) {
  if (storageProvider === "telegram" && tgFileId) return tg.getText(tgFileId);
  return b2.getText(storagePath);
}

export async function removeTextObject(storagePath, { storageProvider, tgFileId, tgMessageId } = {}) {
  if (storageProvider === "telegram" && tgFileId) {
    return tg.deleteObject({ fileId: tgFileId, messageId: tgMessageId, storagePath });
  }
  return b2.deleteObject({ fileId: undefined, fileName: storagePath });
}

/** Builds the object path for a message's text body. */
export function buildMessageBodyPath(clientId, messageId) {
  const safeClient = String(clientId ?? "unknown").toLowerCase();
  return `clients/${safeClient}/messages/text/${messageId}.txt`;
}

/** Streams a file from its stored provider (Telegram primary, B2 fallback). */
export async function getFileStream(storagePath, range, { storageProvider, tgFileId } = {}) {
  if (storageProvider === "telegram") {
    if (tgFileId) return tg.downloadStream(tgFileId, range);
    // Telegram has no range reads; serve the whole object for fallback.
    const found = await tg.findFile(storagePath);
    if (found) return tg.downloadStream(found.fileId, undefined);
    throw new Error("Telegram object not found: " + storagePath);
  }
  return b2.downloadStream(storagePath, range);
}

/** Deletes a file from both B2 and Telegram. */
export async function removeObject({ fileId, fileName, storagePath, storageProvider, tgFileId, tgMessageId }) {
  const path = storagePath || fileName;
  const jobs = [];
  if (tgFileId || tgMessageId) {
    jobs.push(tg.deleteObject({ fileId: tgFileId, messageId: tgMessageId, storagePath: path }).catch(() => {}));
  }
  if (storageProvider === "telegram") {
    if (!tgFileId && !tgMessageId) {
      jobs.push(tg.deleteObject({ fileId: undefined, messageId: undefined, storagePath: path }).catch(() => {}));
    }
  } else if (storageProvider === "backblaze-b2" || (!storageProvider && !tgFileId && !tgMessageId)) {
    jobs.push(b2.deleteObject({ fileId, fileName: path }).catch(() => {}));
  }
  await Promise.all(jobs);
}

export { tg };
