import * as tg from "./telegram-storage";

export const STORAGE_PROVIDER = "telegram";

/**
 * Check if Telegram storage is configured.
 * Returns true when TG_BOT_TOKEN is set.
 * With TG_CHANNEL_ID → private channel (persistent documents).
 * Without TG_CHANNEL_ID → chat storage (sent to TG_CHAT_ID).
 */
export function isTgConfigured() {
  return tg.isTgConfigured();
}

export function isStorageConfigured() {
  return isTgConfigured();
}

/** Builds the logical folder structure for the Telegram channel. */
export function buildStoragePath({ clientId, projectId, purpose, fileType, originalName }) {
  const id = crypto.randomUUID();
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
  const safeName = (originalName || "file.bin")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return `${folder}/${id}-${safeName}`;
}

/** Builds the object path for a message's text body. */
export function buildMessageBodyPath(clientId, messageId) {
  const safeClient = String(clientId ?? "unknown").toLowerCase();
  return `clients/${safeClient}/messages/text/${messageId}.txt`;
}

/** Uploads a file buffer to Telegram storage.
  Returns { size, storageProvider, tg: { fileId, messageId, fileName }, b2 }.
 */
export async function putFile({ storagePath, buffer, contentType }) {
  const bytes = toBytes(buffer);
  const tp = await tg.uploadBuffer({ storagePath, buffer: bytes, contentType });
  return {
    size: tp.size,
    storageProvider: "telegram",
    tg: {
      fileId: tp.fileId,
      messageId: tp.messageId,
      fileName: tp.fileName,
    },
    b2: null,
  };
}

/** Uploads a UTF-8 text object to Telegram storage.
  Returns { storageProvider, tgFileId, tgMessageId, fileName, size }.
 */
export async function putText({ storagePath, text }) {
  const tp = await tg.putText({ storagePath, text });
  return {
    storageProvider: "telegram",
    tgFileId: tp.fileId,
    tgMessageId: tp.messageId,
    fileName: tp.fileName ?? storagePath,
    b2FileId: null,
    size: tp.size,
  };
}

/** Fetches a text object from Telegram storage. */
export async function getText(storagePath, { tgFileId } = {}) {
  let fileId = tgFileId;
  if (!fileId) {
    const found = await findFile(storagePath);
    if (!found) throw new Error(`Telegram object not found: ${storagePath}`);
    fileId = found.fileId;
  }
  return tg.getText(fileId);
}

/** Deletes an object from Telegram storage. */
export async function removeObject({ fileId, fileName, storagePath, tgFileId, tgMessageId }) {
  const path = storagePath || fileName;
  const jobs = [];
  if (tgFileId || tgMessageId) {
    jobs.push(
      tg.deleteObject({
        fileId: tgFileId,
        messageId: tgMessageId,
        storagePath: path,
      }).catch(() => {}),
    );
  } else {
    const found = await findFile(path).catch(() => null);
    if (found) {
      jobs.push(
        tg.deleteObject({
          fileId: found.fileId,
          messageId: found.messageId,
          storagePath: path,
        }).catch(() => {}),
      );
    }
  }
  await Promise.all(jobs);
}

/** Finds a file by its storage path, returning { fileId, messageId } or null. */
export async function findFile(storagePath) {
  let cached = tg.cachedFileMap.get(storagePath);
  if (cached) return cached;
  await tg.refreshFileMap();
  cached = tg.cachedFileMap.get(storagePath);
  if (cached) return cached;
  await tg.bootstrapChatFiles();
  return tg.chatFileMap.get(storagePath) || null;
}

/** Downloads a stored file as a stream (Uint8Array). */
export async function getFileStream(storagePath, range, { tgFileId } = {}) {
  if (tgFileId) return tg.downloadStream(tgFileId, range);
  const found = await findFile(storagePath);
  if (!found) throw new Error(`Telegram object not found: ${storagePath}`);
  return tg.downloadStream(found.fileId, range);
}

/** Removes a text object from storage. */
export async function removeTextObject(storagePath, { tgFileId, tgMessageId } = {}) {
  if (tgFileId || tgMessageId) {
    await tg.deleteObject({
      fileId: tgFileId,
      messageId: tgMessageId,
      storagePath: storagePath,
    });
  } else {
    const found = await findFile(storagePath).catch(() => null);
    if (found) {
      await tg.deleteObject({
        fileId: found.fileId,
        messageId: found.messageId,
        storagePath,
      });
    }
  }
}

function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return new Uint8Array(input);
}