import { NextResponse } from "next/server";
import { requireAuth, resolveClientScope } from "@/lib/permissions";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";
import { removeObject, removeTextObject } from "@/lib/storage";

export const runtime = "edge";

/**
 * Bulk delete messages API
 * DELETE /api/messages/bulk?clientId=xxx&messageIds=id1,id2,id3
 */
export async function DELETE(request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  }
  
  const session = await requireAuth();
  if (!session || !session.user.profileId) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const messageIdsParam = searchParams.get("messageIds");

  if (!clientId || !messageIdsParam) {
    return NextResponse.json({ success: false, message: "clientId and messageIds required." }, { status: 400 });
  }

  const messageIds = messageIdsParam.split(",").filter(Boolean);
  if (messageIds.length === 0) {
    return NextResponse.json({ success: false, message: "No message IDs provided." }, { status: 400 });
  }

  const scope = await resolveClientScope(session, clientId);
  if (!scope.ok) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const sb = getSupabaseAdmin();

  // Get all messages to delete with their attachments
  const { data: messages, error: fetchError } = await sb
    .from("messages")
    .select("id,sender_profile_id,attachment_id,body_storage_path,body_provider,body_storage_provider,body_tg_file_id")
    .in("id", messageIds)
    .eq("client_id", clientId);

  if (fetchError) {
    console.error("[bulk delete] Failed to fetch messages:", fetchError.message);
    return NextResponse.json({ success: false, message: fetchError.message }, { status: 500 });
  }

  if (!messages?.length) {
    return NextResponse.json({ success: false, message: "No messages found." }, { status: 404 });
  }

  // Check permissions: admin can delete any, users can only delete their own
  const isAdmin = session.user.role === "SUPER_ADMIN";
  const nonOwned = messages.filter(m => !isAdmin && m.sender_profile_id !== session.user.profileId);
  if (nonOwned.length > 0) {
    return NextResponse.json({ success: false, message: "You can only delete your own messages." }, { status: 403 });
  }

  try {
    // Collect all attachment IDs to delete
    const attachmentIds = [];
    
    for (const m of messages) {
      // Delete message text objects from Telegram
      if (m.body_provider === "object" && m.body_storage_path) {
        try {
          await removeTextObject(m.body_storage_path, {
            storageProvider: m.body_storage_provider,
            tgFileId: m.body_tg_file_id,
          });
        } catch (e) {
          console.error("[bulk delete] Failed to delete message body:", e.message);
        }
      }

      // Collect primary attachment
      if (m.attachment_id) {
        attachmentIds.push(m.attachment_id);
      }
    }

    // Collect additional attachments from message_attachments
    if (messages.length > 0) {
      const { data: extraAttachments } = await sb
        .from("message_attachments")
        .select("file_id")
        .in("message_id", messageIds);
      
      if (extraAttachments) {
        for (const ea of extraAttachments) {
          if (ea.file_id) attachmentIds.push(ea.file_id);
        }
      }
    }

    // Delete unique attachments from Telegram and database
    const uniqueAttachmentIds = [...new Set(attachmentIds)];
    
    for (const attId of uniqueAttachmentIds) {
      const { data: file } = await sb
        .from("files")
        .select("id,storage_path,storage_provider,tg_file_id,tg_message_id")
        .eq("id", attId)
        .single();
      
      if (file) {
        try {
          await removeObject({
            fileId: file.id,
            fileName: file.storage_path,
            storagePath: file.storage_path,
            storageProvider: file.storage_provider,
            tgFileId: file.tg_file_id,
            tgMessageId: file.tg_message_id,
          });
          await sb.from("files").delete().eq("id", file.id);
        } catch (e) {
          console.error("[bulk delete] Failed to delete file:", e.message);
        }
      }
    }

    // Delete message_attachments entries
    await sb.from("message_attachments").delete().in("message_id", messageIds);

    // Delete messages
    const { error: deleteError } = await sb
      .from("messages")
      .delete()
      .in("id", messageIds);

    if (deleteError) {
      console.error("[bulk delete] Failed to delete messages:", deleteError.message);
      return NextResponse.json({ success: false, message: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      deleted: messages.length,
      deletedCount: messages.length 
    });
  } catch (error) {
    console.error("[bulk delete] Error:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
