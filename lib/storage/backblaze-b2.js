import B2 from "backblaze-b2";

const AUTH_TTL_MS = 20 * 60 * 60 * 1000; // B2 auth tokens last 24h; refresh early

let instance = null;
let authorizedAt = 0;
let cachedBucketId = null;

export function isB2Configured() {
  return Boolean(
    process.env.B2_KEY_ID &&
      process.env.B2_APPLICATION_KEY &&
      process.env.B2_BUCKET_NAME
  );
}

async function getB2() {
  if (!isB2Configured()) return null;
  if (!instance) {
    instance = new B2({
      applicationKeyId: process.env.B2_KEY_ID,
      applicationKey: process.env.B2_APPLICATION_KEY,
    });
  }
  if (Date.now() - authorizedAt > AUTH_TTL_MS) {
    await instance.authorize();
    authorizedAt = Date.now();
    cachedBucketId = null;
  }
  return instance;
}

export async function getBucketId(b2) {
  if (process.env.B2_BUCKET_ID) return process.env.B2_BUCKET_ID;
  if (cachedBucketId) return cachedBucketId;
  const response = await b2.listBuckets({
    bucketName: process.env.B2_BUCKET_NAME,
  });
  const bucket = response.data.buckets?.[0];
  if (!bucket) throw new Error(`B2 bucket "${process.env.B2_BUCKET_NAME}" not found`);
  cachedBucketId = bucket.bucketId;
  return cachedBucketId;
}

/**
 * Uploads a buffer. Returns { fileId, fileName, size }.
 * storagePath example: clients/<id>/messages/audio/<uuid>-note.webm
 */
export async function uploadBuffer({ storagePath, buffer, contentType }) {
  const b2 = await getB2();
  if (!b2) throw new Error("Backblaze B2 is not configured");
  const bucketId = await getBucketId(b2);

  const { data: uploadData } = await b2.getUploadUrl({ bucketId });
  const response = await b2.uploadFile({
    uploadUrl: uploadData.uploadUrl,
    uploadAuthToken: uploadData.authorizationToken,
    fileName: storagePath,
    data: buffer,
    contentType: contentType || "application/octet-stream",
  });

  return {
    fileId: response.data.fileId,
    fileName: response.data.fileName,
    size: Number(response.data.contentLength ?? buffer.length),
  };
}

/** Downloads a stored object as a Node stream. Optional { start, end } for range reads (byte offsets). */
export async function downloadStream(storagePath, { start, end } = {}) {
  const b2 = await getB2();
  if (!b2) throw new Error("Backblaze B2 is not configured");
  const params = {
    bucketName: process.env.B2_BUCKET_NAME,
    fileName: storagePath,
    responseType: "stream",
  };
  // B2 honours an HTTP Range header for byte streaming; axiosOverride is
  // merged last by the SDK so it reliably reaches the request headers.
  if (Number.isInteger(start)) {
    params.axiosOverride = {
      headers: { Range: `bytes=${start}-${Number.isInteger(end) ? end : ""}` },
    };
  }
  const response = await b2.downloadFileByName(params);
  return response.data;
}

/** Uploads/overwrites a UTF-8 text object. Returns { fileName, size }. */
export async function putText({ storagePath, text }) {
  const b2 = await getB2();
  if (!b2) throw new Error("Backblaze B2 is not configured");
  const bucketId = await getBucketId(b2);
  const { data: uploadData } = await b2.getUploadUrl({ bucketId });
  const buffer = Buffer.from(text ?? "", "utf8");
  const response = await b2.uploadFile({
    uploadUrl: uploadData.uploadUrl,
    uploadAuthToken: uploadData.authorizationToken,
    fileName: storagePath,
    data: buffer,
    contentType: "text/plain; charset=utf-8",
  });
  return { fileName: response.data.fileName, size: buffer.length };
}

/** Downloads a stored text object and returns its UTF-8 string. */
export async function getText(storagePath) {
  const b2 = await getB2();
  if (!b2) throw new Error("Backblaze B2 is not configured");
  const response = await b2.downloadFileByName({
    bucketName: process.env.B2_BUCKET_NAME,
    fileName: storagePath,
    responseType: "stream",
  });
  return streamToString(response.data);
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

export async function deleteObject({ fileId, fileName }) {
  const b2 = await getB2();
  if (!b2) throw new Error("Backblaze B2 is not configured");
  if (fileId) {
    await b2.deleteFileVersion({ fileId, fileName });
  } else {
    const bucketId = await getBucketId(b2);
    const { data } = await b2.listFileNames({
      bucketId,
      startFileName: fileName,
      maxFileCount: 1,
      prefix: fileName,
    });
    const match = data.files?.find((f) => f.fileName === fileName);
    if (match) await b2.deleteFileVersion({ fileId: match.fileId, fileName });
  }
}
