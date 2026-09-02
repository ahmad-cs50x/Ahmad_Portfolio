import { createClient } from "@supabase/supabase-js";
import B2 from "backblaze-b2";
import { readFileSync } from "fs";
import { randomUUID } from "crypto";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const b2 = new B2({ applicationKeyId: env.B2_KEY_ID, applicationKey: env.B2_APPLICATION_KEY });
await b2.authorize();
let bucketId = env.B2_BUCKET_ID;
if (!bucketId) {
  const { data } = await b2.listBuckets({ bucketName: env.B2_BUCKET_NAME });
  bucketId = data.buckets[0].bucketId;
}

const pathFor = (clientId, id) => `clients/${String(clientId).toLowerCase()}/messages/text/${id}.txt`;

const { data: rows, error } = await sb
  .from("messages")
  .select("id,client_id,body,body_provider,body_storage_path")
  .or(`body_provider.is.null,body_provider.eq.inline`)
  .not("body", "is", null);

if (error) { console.error("query error:", error.message); process.exit(1); }
console.log("messages to backfill:", (rows || []).length);

let done = 0;
for (const r of rows || []) {
  const text = (r.body || "").trim();
  if (!text) continue;
  const path = r.body_storage_path || pathFor(r.client_id, randomUUID());
  try {
    const { data: up } = await b2.getUploadUrl({ bucketId });
    const buffer = Buffer.from(text, "utf8");
    const resp = await b2.uploadFile({
      uploadUrl: up.uploadUrl,
      uploadAuthToken: up.authorizationToken,
      fileName: path,
      data: buffer,
      contentType: "text/plain; charset=utf-8",
    });
    const { error: ue } = await sb
      .from("messages")
      .update({
        body_provider: "object",
        body_storage_path: path,
        body_preview: text.slice(0, 280),
        body_bytes: Number(resp.data.contentLength ?? buffer.length),
        body_truncated: text.length > 280,
        body: null,
      })
      .eq("id", r.id);
    if (ue) { console.error("update fail", r.id, ue.message); continue; }
    done++;
  } catch (e) {
    console.error("upload fail", r.id, e.message);
  }
}
console.log("backfilled:", done);
