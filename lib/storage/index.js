/**
 * Storage Provider - Telegram Only
 *
 * Simplified for Cloudflare Pages compatibility.
 * Uses only Telegram Bot API (HTTPS) - no native Node.js dependencies.
 */
import * as tg from "./telegram-storage";

export const STORAGE_PROVIDER = "telegram";

export function isStorageConfigured() {
  return tg.isTgConfigured();
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

export async function putFile(params) {
  const { buffer, storagePath, contentType } = params;

  const tp = await tg.uploadBuffer({ storagePath, buffer, contentType });

  return {
    size: tp.size,
    storageProvider: "telegram",
    tg: { fileId: tp.fileId, messageId: tp.messageId, fileName: tp.fileName },
    b2: null,
  };
}

export async function putText(params) {
  const tp = await tg.putText(params);

  return {
    size: tp.size,
    storageProvider: "telegram",
    b2FileId: null,
    tgFileId: tp.fileId,
    tgMessageId: tp.messageId,
    fileName: tp.fileName ?? params.storagePath,
  };
}

export async function getText(storagePath, { storageProvider, tgFileId } = {}) {
  if (storageProvider === "telegram" && tgFileId) return tg.getText(tgFileId);
  return null;
}

export async function removeTextObject(storagePath, { storageProvider, tgFileId, tgMessageId } = {}) {
  if (storageProvider === "telegram" && tgFileId) {
    return tg.deleteObject({ fileId: tgFileId, messageId: tgMessageId, storagePath });
  }
  return null;
}

export function buildMessageBodyPath(clientId, messageId) {
  const safeClient = String(clientId ?? "unknown").toLowerCase();
  return `clients/${safeClient}/messages/text/${messageId}.txt`;
}

export async function getFileStream(storagePath, range, { storageProvider, tgFileId } = {}) {
  if (storageProvider === "telegram" && tgFileId) {
    return tg.downloadStream(tgFileId, range);
  }
  if (tgFileId) {
    return tg.downloadStream(tgFileId, range);
  }
  const found = await tg.findFile(storagePath);
  if (found) return tg.downloadStream(found.fileId, undefined);
  throw new Error("File not found in Telegram storage");
}

export async function removeObject({ fileId, fileName, storagePath, storageProvider, tgFileId, tgMessageId }) {
  const path = storagePath || fileName;
  if (tgFileId || tgMessageId) {
    return tg.deleteObject({ fileId: tgFileId, messageId: tgMessageId, storagePath: path });
  }
  if (path) {
    const found = await tg.findFile(path);
    if (found) {
      return tg.deleteObject({ fileId: found.fileId, messageId: found.messageId, storagePath: path });
    }
  }
}

export { tg };
