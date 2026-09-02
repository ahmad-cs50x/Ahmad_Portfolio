import { Storage } from "@google-cloud/storage";

let gcsInstance = null;

export function isGCSConfigured() {
  return Boolean(
    process.env.GCS_PROJECT_ID &&
    process.env.GCS_CLIENT_EMAIL &&
    process.env.GCS_PRIVATE_KEY &&
    process.env.GCS_BUCKET_NAME
  );
}

async function getGCS() {
  if (!isGCSConfigured()) return null;
  if (!gcsInstance) {
    gcsInstance = new Storage({
      projectId: process.env.GCS_PROJECT_ID,
      credentials: {
        client_email: process.env.GCS_CLIENT_EMAIL,
        private_key: process.env.GCS_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
    });
  }
  return gcsInstance;
}

export async function getBucket() {
  const gcs = await getGCS();
  if (!gcs) throw new Error("Google Cloud Storage is not configured");
  return gcs.bucket(process.env.GCS_BUCKET_NAME);
}

export async function uploadBuffer({ storagePath, buffer, contentType }) {
  const bucket = await getBucket();
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    metadata: {
      contentType: contentType || "application/octet-stream",
      cacheControl: "public, max-age=31536000",
    },
    resumable: false,
    validation: "md5",
  });

  await file.makePublic();

  const publicUrl = `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/${storagePath}`;

  return {
    fileId: storagePath,
    fileName: storagePath,
    size: buffer.length,
    publicUrl,
  };
}

export async function downloadStream(storagePath, { start, end } = {}) {
  const bucket = await getBucket();
  const file = bucket.file(storagePath);
  const options = { decompress: false };
  if (Number.isInteger(start)) options.start = start;
  if (Number.isInteger(end)) options.end = end;
  return file.createReadStream(options);
}

export async function deleteObject({ fileId, fileName }) {
  const bucket = await getBucket();
  const file = bucket.file(fileId || fileName);
  await file.delete();
}

export async function getSignedUrl(storagePath, action = "read", expires = Date.now() + 15 * 60 * 1000) {
  const bucket = await getBucket();
  const file = bucket.file(storagePath);
  const [url] = await file.getSignedUrl({
    action,
    expires,
  });
  return url;
}

/** Uploads/overwrites a UTF-8 text object. Returns { fileName, size }. */
export async function putText({ storagePath, text }) {
  const bucket = await getBucket();
  const file = bucket.file(storagePath);
  const buffer = Buffer.from(text ?? "", "utf8");
  await file.save(buffer, {
    metadata: { contentType: "text/plain; charset=utf-8" },
    resumable: false,
    validation: false,
  });
  return { fileName: storagePath, size: buffer.length };
}

/** Downloads a stored text object and returns its UTF-8 string. */
export async function getText(storagePath) {
  const bucket = await getBucket();
  const file = bucket.file(storagePath);
  const [buf] = await file.download();
  return buf.toString("utf8");
}