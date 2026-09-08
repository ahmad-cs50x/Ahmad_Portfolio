import { NextResponse } from "next/server";
import { requireAuth, resolveClientScope } from "@/lib/permissions";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";
import { isStorageConfigured, buildStoragePath, putFile, buildMessageBodyPath } from "@/lib/storage";
import { publish, channels } from "@/lib/realtime";
import { validateFile } from "@/lib/utils/formatFileSize";

export const runtime = "edge";

/**
 * Unified message send endpoint.
 * Used by both admin and client messaging flows.
 *
 * POST body: { clientId, text?, attachmentIds?, messageType?, recordedAt?, uploadedAt? }
 *
 * The message is created immediately in the database with status 'sending'.
 * Then attachments are uploaded to Telegram. Finally status is updated to 'sent'.
 * Returns the full message object so the frontend can reconcile the optimistic message.
 */
export async function POST(request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  }
  if (!isStorageConfigured()) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Object storage not configured. Set TG_BOT_TOKEN. " +
          "For a private channel backend also set TG_CHANNEL_ID, or leave it blank for chat-based storage (uses TG_CHAT_ID).",
      },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const {
    clientId,
    text,
    attachmentIds,
    messageType,
    recordedAt,
    uploadedAt,
    clientMessageId,
  } = body;

  if (!clientId) {
    return NextResponse.json({ success: false, message: "clientId required." }, { status: 400 });
  }

  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  const scope = await resolveClientScope(session, clientId);
  if (!scope.ok) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const sb = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  // ── 1. Create message in DB with status='sending' ────────────────────
  const { data: created, error: insertErr } = await sb
    .from("messages")
    .insert({
      client_id: scope.clientId,
      sender_profile_id: session.user.profileId,
      sender_role: session.user.role,
      message_type: messageType || "text",
      body: text || null,
      client_message_id: clientMessageId || crypto.randomUUID(),
      status: "sending",
      sent_at: null,
      read_at: null,
    })
    .select("*")
    .single();

  if (insertErr) {
    return NextResponse.json({ success: false, message: insertErr.message }, { status: 500 });
  }

  // ── 2. Upload attachments to Telegram ───────────────────────────────
  if (attachmentIds && attachmentIds.length > 0) {
    const files = [];
    for (const fid of attachmentIds) {
      const { data: file, error: fileErr } = await sb
        .from("files")
        .select("id, file_name, file_type, storage_path, file_size, storage_provider, tg_file_id, tg_message_id")
        .eq("id", fid)
        .single();
      if (fileErr || !file) {
        // Rollback: mark as failed
        await sb.from("messages").update({ status: "failed" }).eq("id", created.id);
        throw new Error(`Attachment file ${fid} not found.`);
      }
      files.push(file);
    }

    // Set first file as primary attachment
    const primaryFile = files[0];
    await sb
      .from("messages")
      .update({
        attachment_id: primaryFile.id,
        telegram_file_id: primaryFile.tg_file_id || null,
        telegram_file_unique_id: primaryFile.tg_file_id || null,
        telegram_file_name: primaryFile.file_name,
        telegram_file_mimetype: primaryFile.file_type,
        telegram_file_size: primaryFile.file_size,
        telegram_message_id: primaryFile.tg_message_id || null,
        attachment_type: categorizeAttachment(primaryFile.file_type),
        sent_at: nowIso,
        status: "sent",
      })
      .eq("id", created.id);

    // Link ALL attachments to the message via message_attachments table
    const attachmentRows = files.map(f => ({ message_id: created.id, file_id: f.id }));
    await sb.from("message_attachments").insert(attachmentRows);
  } else if (text) {
    // Text-only: update status to sent
    await sb
      .from("messages")
      .update({
        status: "sent",
        sent_at: nowIso,
        body_preview: text.length > 280 ? text.slice(0, 280) : text,
        body_truncated: text.length > 280,
      })
      .eq("id", created.id);
  }

  // ── 3. Notify other party & broadcast ──────────────────────────────
  const { data: recipients } = await sb
    .from("profiles")
    .select("id,timezone,full_name")
    .eq("client_id", scope.clientId);

  if (recipients.length) {
    await sb.from("notifications").insert(
      recipients.map((profileId) => ({
        profile_id: profileId,
        client_id: scope.clientId,
        type: "message",
        title:
          created.message_type === "text"
            ? `New message from ${session.user.name || session.user.email}`
            : `New ${created.message_type} message`,
        body: text?.slice(0, 120) || null,
        link_url: session.user.role === "SUPER_ADMIN"
          ? "/admin/messages"
          : "/client-portal/messages",
      }))
    );
    for (const profileId of recipients) {
      publish(channels.user(profileId), "notification", { type: "message", at: nowIso });
    }
  }

  publish(channels.conversation(scope.clientId), "message", { id: created.id, at: nowIso });

  return NextResponse.json({
    success: true,
    message: {
      id: created.id,
      client_message_id: created.client_message_id,
      message_type: created.message_type,
      body: text || null,
      status: "sent",
      sent_at: created.sent_at,
      created_at: created.created_at,
    },
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────

function categorizeAttachment(fileType) {
  if (!fileType) return "document";
  if (fileType.startsWith("audio/")) return "audio";
  if (fileType.startsWith("video/")) return "video";
  if (fileType.startsWith("image/")) return "image";
  if (fileType.includes("pdf")) return "pdf";
  if (fileType.includes("zip") || fileType.includes("rar")) return "archive";
  return "document";
}