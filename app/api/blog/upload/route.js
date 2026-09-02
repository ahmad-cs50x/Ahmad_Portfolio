import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/permissions";
import { isStorageConfigured, buildStoragePath, putFile } from "@/lib/storage";
import { getSupabaseAdmin } from "@/lib/db";
import { validateFile } from "@/lib/utils/formatFileSize";

export const runtime = "nodejs";

const MAX_COVER = 10 * 1024 * 1024;

export async function POST(request) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ success: false, message: "Object storage not configured — paste an image URL instead." }, { status: 503 });
  }
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  const check = validateFile(file, { maxSizeBytes: MAX_COVER });
  if (!check.valid) return NextResponse.json({ success: false, message: check.error }, { status: 413 });
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ success: false, message: "Only image files are allowed." }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = buildStoragePath({
    purpose: "blog",
    fileType: file.type,
    originalName: file.name,
  });

  let uploaded;
  try {
    uploaded = await putFile({ storagePath, buffer, contentType: file.type });
  } catch (error) {
    console.error("[blog] cover upload failed:", error.message);
    return NextResponse.json({ success: false, message: "Upload to storage failed." }, { status: 502 });
  }

  const sb = getSupabaseAdmin();
  const { data: fileRow } = await sb
    .from("files")
    .insert({
      client_id: null,
      file_name: file.name,
      file_type: file.type,
      file_size: uploaded.size ?? buffer.length,
      storage_path: storagePath,
      storage_provider: uploaded.storageProvider,
      b2_file_id: uploaded.b2?.fileId ?? null,
      tg_file_id: uploaded.tg?.fileId ?? null,
      tg_message_id: uploaded.tg?.messageId ?? null,
      purpose: "blog",
      uploaded_by: session.user.profileId,
    })
    .select("id")
    .single();

  // Served publicly through the blog-aware download route.
  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  return NextResponse.json({ success: true, url: `${base}/api/files/${fileRow.id}` });
}
