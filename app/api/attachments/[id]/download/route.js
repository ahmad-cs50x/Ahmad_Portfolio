import { NextResponse } from "next/server";
import { requireAuth, resolveClientScope } from "@/lib/permissions";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";
import { getFileStream } from "@/lib/storage";

export const runtime = "edge";

export async function GET(request, { params }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  }
  const session = await requireAuth();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const sb = getSupabaseAdmin();
  const { data: fileRow } = await sb
    .from("files")
    .select("client_id,storage_path,file_name,file_type,file_size,tg_file_id,storage_provider,archived,purpose")
    .eq("id", id)
    .maybeSingle();
  if (!fileRow) return new Response("Not found", { status: 404 });

  const scope = await resolveClientScope(session, fileRow.client_id);
  if (!scope.ok || scope.forbidden) return new Response("Forbidden", { status: 403 });

  const contentType = fileRow.file_type || "application/octet-stream";
  const size = Number(fileRow.file_size) || 0;
  const isMedia = contentType.startsWith("audio/") || contentType.startsWith("video/") || contentType.startsWith("image/");
  const disposition = isMedia
    ? "inline"
    : `attachment; filename="${encodeURIComponent(fileRow.file_name)}"`;

  const baseHeaders = {
    "Content-Type": contentType,
    "Content-Disposition": disposition,
    "Cache-Control": "private, max-age=0",
    "Accept-Ranges": "bytes",
  };

  const rangeHeader = request.headers.get("range");
  const providerOpts = { storageProvider: fileRow.storage_provider, tgFileId: fileRow.tg_file_id };

  try {
    if (rangeHeader && size > 0) {
      const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
      let start = match && match[1] !== "" ? parseInt(match[1], 10) : 0;
      let end = match && match[2] !== "" ? parseInt(match[2], 10) : size - 1;
      if (!Number.isFinite(start) || start < 0) start = 0;
      if (!Number.isFinite(end) || end >= size) end = size - 1;
      if (start > end) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      }
      const stream = await getFileStream(fileRow.storage_path, { start, end }, providerOpts);
      return new Response(stream, {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${size}`,
        },
      });
    }
    const stream = await getFileStream(fileRow.storage_path, undefined, providerOpts);
    return new Response(stream, {
      status: 200,
      headers: {
        ...baseHeaders,
        ...(size ? { "Content-Length": String(size) } : {}),
      },
    });
  } catch (error) {
    console.error("[download] failed:", error.message);
    return new Response("Download failed", { status: 502 });
  }
}