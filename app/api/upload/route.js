import { NextResponse } from "next/server";
import { requireAuth, resolveClientScope } from "@/lib/permissions";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";
import { isStorageConfigured, buildStoragePath, putFile } from "@/lib/storage";
import { validateFile } from "@/lib/utils/formatFileSize";

export const runtime = "nodejs";
export const maxDuration = 60;

const MESSAGE_MEDIA_LIMIT = 200 * 1024 * 1024; // 200 MB for recorded audio/video
const MAX_FILES_PER_UPLOAD = 10;

function jsonError(message, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request) {
  if (!isDbConfigured()) return jsonError("Database not configured.", 503);
  if (!isStorageConfigured()) return jsonError("Object storage is not configured.", 503);

  const session = await requireAuth();
  if (!session) return jsonError("Unauthorized.", 401);

  const form = await request.formData();
  const files = form.getAll("file");
  const clientId = form.get("clientId") || null;
  const projectId = form.get("projectId") || null;
  const purpose = String(form.get("purpose") || "shared");
  const recordedAt = form.get("recordedAt") || null;

  const scope = await resolveClientScope(session, clientId);
  if (!scope.ok) return jsonError("Forbidden.", 403);
  if (!scope.clientId) return jsonError("clientId is required.", 400);

  if (!files.length) return jsonError("No files provided.", 400);
  if (files.length > MAX_FILES_PER_UPLOAD) return jsonError(`Maximum ${MAX_FILES_PER_UPLOAD} files per upload.`, 400);

  const sb = getSupabaseAdmin();

  // Quota check - calculate total size first
  let totalSize = 0;
  const fileBuffers = [];
  const fileInfos = [];

  for (const file of files) {
    const validation = validateFile(file, { maxSizeBytes: MESSAGE_MEDIA_LIMIT });
    if (!validation.valid) return jsonError(validation.error, 413);
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";
    totalSize += buffer.length;
    fileBuffers.push(buffer);
    fileInfos.push({ file, contentType, buffer });
  }

  // Quota check before anything touches storage
  const { data: client } = await sb
    .from("clients")
    .select("id,storage_limit,storage_used,no_portal_limit,is_active")
    .eq("id", scope.clientId)
    .maybeSingle();
  if (!client) return jsonError("Client not found.", 404);
  if (!client.is_active && !isSuper(session)) return jsonError("This client account is disabled.", 403);
  if (
    !isSuper(session) &&
    !client.no_portal_limit &&
    client.storage_used + totalSize > client.storage_limit
  ) {
    return jsonError("Storage quota exceeded. Contact your project manager.", 413);
  }

  // Current footprint on Telegram, used to decide Telegram-vs-B2 tiering.
  const { data: tgFiles } = await sb
    .from("files")
    .select("file_size")
    .eq("storage_provider", "telegram");
  const tgBytesUsed = (tgFiles ?? []).reduce((s, f) => s + (Number(f.file_size) || 0), 0);

  // Upload all files
  const uploadedFiles = [];
  let cumulativeSize = 0;

  for (let i = 0; i < fileInfos.length; i++) {
    const { file, contentType, buffer } = fileInfos[i];
    const storagePath = buildStoragePath({
      clientId: scope.clientId,
      projectId,
      purpose,
      fileType: contentType,
      originalName: file.name,
    });

    let uploaded;
    try {
      uploaded = await putFile({ storagePath, buffer, contentType, tgBytesUsed });
    } catch (error) {
      console.error("[upload] storage upload failed:", error.message);
      return jsonError("Upload to storage failed. Please try again.", 502);
    }

    const { data: fileRow, error: insertError } = await sb
      .from("files")
      .insert({
        client_id: scope.clientId,
        project_id: projectId,
        file_name: file.name,
        file_type: contentType,
        file_size: uploaded.size,
        storage_provider: uploaded.storageProvider,
        storage_path: storagePath,
        b2_file_id: uploaded.b2?.fileId ?? null,
        tg_file_id: uploaded.tg?.fileId ?? null,
        tg_message_id: uploaded.tg?.messageId ?? null,
        uploaded_by: session.user.profileId ?? null,
        purpose,
        recorded_at: recordedAt ?? null,
      })
      .select("id,file_name,file_size,file_type,purpose,created_at")
      .single();

    if (insertError) {
      console.error("[upload] metadata insert failed:", insertError.message);
      return jsonError("File stored but metadata failed. Contact support.", 500);
    }

    await sb.from("storage_usage").insert({
      file_id: fileRow.id,
      client_id: scope.clientId,
      delta_bytes: uploaded.size,
      reason: "upload",
    });

    cumulativeSize += uploaded.size;
    uploadedFiles.push({ ...fileRow, recorded_at: recordedAt });
  }

  const { data: fresh } = await sb
    .from("clients")
    .update({ storage_used: client.storage_used + cumulativeSize })
    .eq("id", scope.clientId)
    .select("storage_used")
    .single();

  for (const fileRow of uploadedFiles) {
    await sb.from("activity_logs").insert({
      actor_profile_id: session.user.profileId ?? null,
      client_id: scope.clientId,
      action: "file.uploaded",
      entity_type: "file",
      entity_id: fileRow.id,
      metadata: { name: fileRow.file_name, size: fileRow.file_size },
    });
  }

  return NextResponse.json({
    success: true,
    files: uploadedFiles,
    storage_used: fresh?.storage_used ?? null,
  });
}

function isSuper(session) {
  return session?.user?.role === "SUPER_ADMIN";
}
