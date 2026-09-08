import { NextResponse } from "next/server";
import { requireAuth, resolveClientScope, isSuperAdmin } from "@/lib/permissions";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";
import { removeObject } from "@/lib/storage";

export const runtime = "edge";

export async function GET(request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  }
  const session = await requireAuth();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const scope = await resolveClientScope(session, params.get("clientId"));
  if (!scope.ok) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  if (!scope.clientId) return NextResponse.json({ success: false, message: "clientId required." }, { status: 400 });

  const sb = getSupabaseAdmin();
  let query = sb
    .from("files")
    .select("id,file_name,file_size,file_type,purpose,project_id,archived,created_at")
    .eq("client_id", scope.clientId)
    .order("created_at", { ascending: false })
    .limit(200);

  const projectId = params.get("projectId");
  if (projectId) query = query.eq("project_id", projectId);
  const purpose = params.get("purpose");
  if (purpose) query = query.eq("purpose", purpose);
  if (params.get("includeArchived") !== "true") query = query.eq("archived", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true, clientId: scope.clientId, files: data ?? [] });
}

export async function DELETE(request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  }
  const session = await requireAuth();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const fileId = params.get("id");
  const permanent = params.get("permanent") === "true";
  if (!fileId) return NextResponse.json({ success: false, message: "id required." }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: fileRow } = await sb
    .from("files")
    .select("id,client_id,file_size,storage_path,storage_provider,tg_file_id,tg_message_id,uploaded_by")
    .eq("id", fileId)
    .maybeSingle();
  if (!fileRow) return NextResponse.json({ success: false, message: "File not found." }, { status: 404 });

  const scope = await resolveClientScope(session, fileRow.client_id);
  const allowed =
    isSuperAdmin(session) || (scope.ok && !scope.forbidden && fileRow.uploaded_by === session.user.profileId);
  if (!allowed) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });

  if (!permanent) {
    const { error } = await sb.from("files").update({ archived: true }).eq("id", fileId);
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    return NextResponse.json({ success: true, archived: true });
  }

  try {
    await removeObject({
      fileName: fileRow.storage_path,
      storageProvider: fileRow.storage_provider,
      tgFileId: fileRow.tg_file_id,
      tgMessageId: fileRow.tg_message_id,
    });
  } catch (error) {
    console.error("[files] storage delete failed:", error.message);
  }

  const { data: client } = await sb
    .from("clients")
    .select("storage_used")
    .eq("id", fileRow.client_id)
    .maybeSingle();

  await sb.from("files").delete().eq("id", fileId);
  await sb.from("storage_usage").insert({
    client_id: fileRow.client_id,
    delta_bytes: -Number(fileRow.file_size ?? 0),
    reason: "delete",
  });
  if (client) {
    await sb
      .from("clients")
      .update({ storage_used: Math.max(0, Number(client.storage_used) - Number(fileRow.file_size ?? 0)) })
      .eq("id", fileRow.client_id);
  }
  await sb.from("activity_logs").insert({
    actor_profile_id: session.user.profileId,
    client_id: fileRow.client_id,
    action: "file.deleted",
    entity_type: "file",
    entity_id: fileRow.id,
    metadata: { permanent: true },
  });

  return NextResponse.json({ success: true, deleted: true });
}
