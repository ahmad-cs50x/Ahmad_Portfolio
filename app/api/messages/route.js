import { NextResponse } from "next/server";
import { requireAuth, resolveClientScope } from "@/lib/permissions";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";
import { publish, channels } from "@/lib/realtime";
import { removeObject, putText, getText, buildMessageBodyPath, removeTextObject } from "@/lib/storage";

export const runtime = "edge";

const byteLengthUtf8 = (str) => new TextEncoder().encode(str).length;

async function conversationMeta(sb, clientId) {
  const { data: clientProfiles } = await sb
    .from("profiles")
    .select("id,timezone,full_name")
    .eq("client_id", clientId);
  const { data: admins } = await sb
    .from("profiles")
    .select("id,timezone,full_name")
    .eq("role", "SUPER_ADMIN");
  return { clientProfiles: clientProfiles ?? [], admins: admins ?? [] };
}

export async function GET(request) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const session = await requireAuth();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const scope = await resolveClientScope(session, params.get("clientId"));
  if (!scope.ok) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  if (!scope.clientId) return NextResponse.json({ success: false, message: "clientId required." }, { status: 400 });

  const sb = getSupabaseAdmin();
  
  // First get messages with primary attachment (no FK name - let PostgREST infer)
  const { data: messages, error } = await sb
    .from("messages")
    .select(
      `id,message_type,body,body_provider,body_storage_path,body_storage_provider,body_tg_file_id,body_preview,body_truncated,created_at,recorded_at,uploaded_at,read_at,sender_role,status,sent_at,client_message_id,
       sender:profiles!sender_profile_id(id,full_name,email),
       attachment:files!attachment_id(id,file_name,file_size,file_type,storage_path,storage_provider)`
    )
    .eq("client_id", scope.clientId)
    .order("created_at", { ascending: true })
    .limit(300);

  if (error) {
    console.error("[messages GET] Query error:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  // Then get all message_attachments for these messages
  const messageIds = (messages ?? []).map(m => m.id);
  let attachmentsMap = {};
  
  if (messageIds.length > 0) {
    const { data: messageAttachments, error: attError } = await sb
      .from("message_attachments")
      .select(
        `message_id,
         file:files(id,file_name,file_size,file_type,storage_path,storage_provider)`
      )
      .in("message_id", messageIds);
    
    if (attError) {
      console.error("[messages GET] Attachments query error:", attError.message);
    } else if (messageAttachments) {
      for (const ma of messageAttachments) {
        if (ma.file) {
          if (!attachmentsMap[ma.message_id]) attachmentsMap[ma.message_id] = [];
          attachmentsMap[ma.message_id].push(ma.file);
        }
      }
    }
  }

  // Process attachments - combine primary attachment with additional attachments
  const processedMessages = (messages ?? []).map(m => {
    const primaryAttachment = m.attachment;
    const additionalAttachments = attachmentsMap[m.id] || [];
    
    // Remove duplicates by file id
    const allAttachments = primaryAttachment 
      ? [primaryAttachment, ...additionalAttachments.filter(a => a.id !== primaryAttachment?.id)]
      : additionalAttachments;

    return {
      ...m,
      attachments: allAttachments,
      attachment: primaryAttachment, // Keep for backward compatibility
    };
  });

  // Hydrate full text bodies from object storage. Short messages already fit
  // in body_preview, so only truncated object-backed messages hit storage.
  await Promise.all(
    processedMessages.map(async (m) => {
      if (m.body_provider === "object" && m.body_truncated && m.body_storage_path && !m.body) {
        try {
          m.body = await getText(m.body_storage_path, {
            storageProvider: m.body_storage_provider,
            tgFileId: m.body_tg_file_id,
          });
        } catch (e) {
          // Fall back to preview if the object is missing.
          console.error("[messages] body fetch failed:", e.message);
          m.body = m.body_preview ?? null;
        }
      }
    })
  );

  const meta = await conversationMeta(sb, scope.clientId);
  const viewerIsAdmin = session.user.role === "SUPER_ADMIN";
  const otherPartyTz = viewerIsAdmin
    ? meta.clientProfiles[0]?.timezone ?? null
    : meta.admins[0]?.timezone ?? null;

  return NextResponse.json({
    success: true,
    messages: processedMessages,
    meta: {
      clientId: scope.clientId,
      viewerTimezone: session.user.timezone,
      otherPartyTimezone: otherPartyTz,
    },
  });
}

export async function PATCH(request) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const session = await requireAuth();
  if (!session || !session.user.profileId) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { messageId, clientId, action } = body;

  if (!messageId || !clientId || action !== "mark-read") {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400 });
  }

  const scope = await resolveClientScope(session, clientId);
  if (!scope.ok) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });

  const sb = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  // Mark message as read
  const { data: message, error } = await sb
    .from("messages")
    .update({ read_at: nowIso })
    .eq("id", messageId)
    .eq("client_id", scope.clientId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

  // Notify sender about read receipt
  if (message.sender_profile_id !== session.user.profileId) {
    await sb.from("notifications").insert({
      profile_id: message.sender_profile_id,
      client_id: scope.clientId,
      type: "read_receipt",
      title: "Message read",
      body: `Your message was read at ${new Date().toLocaleTimeString()}`,
      link_url: session.user.role === "SUPER_ADMIN" ? "/admin/messages" : "/client-portal/messages",
    });
    publish(channels.user(message.sender_profile_id), "read_receipt", { messageId, readAt: nowIso });
  }

  publish(channels.conversation(scope.clientId), "message_read", { id: messageId, readAt: nowIso });

  return NextResponse.json({ success: true, message });
}

export async function DELETE(request) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const session = await requireAuth();
  if (!session || !session.user.profileId) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const clientId = searchParams.get("clientId");
  const messageId = searchParams.get("id");

  // If clearing entire chat (admin only)
  if (action === "clear") {
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, message: "Only admin can clear chat." }, { status: 403 });
    }
    if (!clientId) return NextResponse.json({ success: false, message: "clientId required." }, { status: 400 });

    const scope = await resolveClientScope(session, clientId);
    if (!scope.ok) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });

    const sb = getSupabaseAdmin();

    // Get all message IDs to delete attachments
    const { data: messages } = await sb
      .from("messages")
      .select("id,attachment_id,body_provider,body_storage_path,body_storage_provider,body_tg_file_id")
      .eq("client_id", clientId);

    if (messages?.length) {
      // Delete message text objects
      for (const m of messages) {
        if (m.body_provider === "object" && m.body_storage_path) {
          try {
            await removeTextObject(m.body_storage_path, {
              storageProvider: m.body_storage_provider,
              tgFileId: m.body_tg_file_id,
            });
          } catch (e) {
            console.error("[clear chat] Failed to delete message body:", e.message);
          }
        }
      }
      // Collect all attachment IDs
      const attachmentIds = [];
      for (const m of messages) {
        if (m.attachment_id) attachmentIds.push(m.attachment_id);
      }

      // Get additional attachments from message_attachments
      if (messages.length > 0) {
        const { data: extraAttachments } = await sb
          .from("message_attachments")
          .select("file_id")
          .in("message_id", messages.map(m => m.id));
        
        if (extraAttachments) {
          for (const ea of extraAttachments) {
            if (ea.file_id) attachmentIds.push(ea.file_id);
          }
        }
      }

      // Delete files from storage
      for (const attId of [...new Set(attachmentIds)]) {
        const { data: file } = await sb
          .from("files")
          .select("id,storage_path,storage_provider,tg_file_id,tg_message_id")
          .eq("id", attId)
          .single();
        
        if (file) {
          try {
            await removeObject({ fileId: file.id, fileName: file.storage_path, storagePath: file.storage_path, storageProvider: file.storage_provider, tgFileId: file.tg_file_id, tgMessageId: file.tg_message_id });
            await sb.from("files").delete().eq("id", file.id);
          } catch (e) {
            console.error("[clear chat] Failed to delete file:", e.message);
          }
        }
      }
    }

    // Delete message_attachments, then messages
    const messageIds = messages?.map(m => m.id) ?? [];
    if (messageIds.length) {
      await sb.from("message_attachments").delete().in("message_id", messageIds);
    }
    await sb.from("messages").delete().eq("client_id", clientId);

    // Mark client chat as cleared with timestamp
    await sb.from("clients").update({ chat_cleared_at: new Date().toISOString() }).eq("id", clientId);

    publish(channels.conversation(clientId), "chat_cleared", { clientId });

    return NextResponse.json({ success: true, cleared: true });
  }

  // Single message delete
  if (!messageId || !clientId) {
    return NextResponse.json({ success: false, message: "Message ID and client ID required." }, { status: 400 });
  }

  const scope = await resolveClientScope(session, clientId);
  if (!scope.ok) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });

  const sb = getSupabaseAdmin();

  // Get message to check ownership and get all attachments
  const { data: message, error: fetchError } = await sb
    .from("messages")
    .select("id,sender_profile_id,attachment_id,body_storage_path,body_provider,body_storage_provider,body_tg_file_id")
    .eq("id", messageId)
    .eq("client_id", scope.clientId)
    .single();

  if (fetchError || !message) {
    return NextResponse.json({ success: false, message: "Message not found." }, { status: 404 });
  }

  // Check permissions: sender can delete their own, admin can delete any
  const isSender = message.sender_profile_id === session.user.profileId;
  const isAdmin = session.user.role === "SUPER_ADMIN";

  if (!isSender && !isAdmin) {
    return NextResponse.json({ success: false, message: "You can only delete your own messages." }, { status: 403 });
  }

  // Delete all attachments from storage
  const allAttachments = [];
  if (message.attachment_id) {
    const { data: primaryAtt } = await sb
      .from("files")
      .select("id,storage_path,storage_provider,tg_file_id,tg_message_id")
      .eq("id", message.attachment_id)
      .single();
    if (primaryAtt) allAttachments.push(primaryAtt);
  }
  
  // Add additional attachments from message_attachments
  const { data: extraAttachments } = await sb
    .from("message_attachments")
    .select("file:files(id,storage_path,storage_provider,tg_file_id,tg_message_id)")
    .eq("message_id", messageId);

  if (extraAttachments) {
    for (const ea of extraAttachments) {
      if (ea.file) allAttachments.push(ea.file);
    }
  }

  // Remove duplicates
  const uniqueAttachments = allAttachments.filter((att, idx, arr) => arr.findIndex(a => a.id === att.id) === idx);

  for (const attachment of uniqueAttachments) {
    try {
      await removeObject({
        fileId: attachment.id,
        fileName: attachment.storage_path,
        storagePath: attachment.storage_path,
        storageProvider: attachment.storage_provider,
        tgFileId: attachment.tg_file_id,
        tgMessageId: attachment.tg_message_id,
      });
      await sb.from("files").delete().eq("id", attachment.id);
    } catch (e) {
      console.error("[messages] Failed to delete attachment:", e.message);
    }
  }

  // Delete the message text object from storage if one exists.
  if (message.body_provider === "object" && message.body_storage_path) {
    try {
      await removeTextObject(message.body_storage_path, {
        storageProvider: message.body_storage_provider,
        tgFileId: message.body_tg_file_id,
      });
    } catch (e) {
      console.error("[messages] Failed to delete message body:", e.message);
    }
  }

  // Delete message_attachments entries
  await sb.from("message_attachments").delete().eq("message_id", messageId);

  // Physical delete message
  const { error: deleteError } = await sb.from("messages").delete().eq("id", messageId);

  if (deleteError) {
    return NextResponse.json({ success: false, message: deleteError.message }, { status: 500 });
  }

  publish(channels.conversation(scope.clientId), "message_deleted", { id: messageId });

  return NextResponse.json({ success: true, deleted: true });
}

export async function POST(request) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const session = await requireAuth();
  if (!session || !session.user.profileId) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const scope = await resolveClientScope(session, body.clientId);
  if (!scope.ok) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  if (!scope.clientId) return NextResponse.json({ success: false, message: "clientId required." }, { status: 400 });

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const attachmentIds = Array.isArray(body.attachmentIds) ? body.attachmentIds : (body.attachmentId ? [body.attachmentId] : []);
  
  if (!text && !attachmentIds.length) {
    return NextResponse.json({ success: false, message: "Message cannot be empty." }, { status: 400 });
  }
  if (text.length > 5000) {
    return NextResponse.json({ success: false, message: "Message is too long." }, { status: 400 });
  }
  if (attachmentIds.length > 10) {
    return NextResponse.json({ success: false, message: "Maximum 10 attachments per message." }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  // Validate all attachments belong to this client
  let attachmentRows = [];
  if (attachmentIds.length) {
    const { data: files, error: filesError } = await sb
      .from("files")
      .select("id,client_id,purpose")
      .in("id", attachmentIds);
    if (filesError) return NextResponse.json({ success: false, message: filesError.message }, { status: 500 });
    
    for (const file of files ?? []) {
      if (file.client_id !== scope.clientId) {
        return NextResponse.json({ success: false, message: "Invalid attachment." }, { status: 400 });
      }
      attachmentRows.push(file);
    }
  }

  const messageType =
    body.messageType ||
    (attachmentRows.length
      ? attachmentRows.some(f => f.purpose === "message") ? "file" : "file"
      : "text");

  // Persist the text payload to object storage (Telegram). The DB keeps
  // only a short preview as a render cache; the object is the source of truth.
  let bodyObject = { provider: "inline", storageProvider: null, storagePath: null, tgFileId: null, tgMessageId: null, preview: text || null, bytes: text ? byteLengthUtf8(text) : 0 };
  if (text) {
    const objectPath = buildMessageBodyPath(scope.clientId, crypto.randomUUID());
    try {
      const stored = await putText({ storagePath: objectPath, text });
      bodyObject = {
        provider: "object",
        storageProvider: stored.storageProvider,
        storagePath: stored.fileName ?? objectPath,
        tgFileId: stored.tgFileId ?? null,
        tgMessageId: stored.tgMessageId ?? null,
        preview: text.slice(0, 280),
        bytes: stored.size,
      };
    } catch (e) {
      // Fall back to inline in Postgres if object storage is unavailable.
      console.error("[messages] body upload failed, storing inline:", e.message);
      bodyObject = { provider: "inline", storageProvider: null, storagePath: null, tgFileId: null, tgMessageId: null, preview: text, bytes: byteLengthUtf8(text) };
    }
  }

  const { data: inserted, error } = await sb
    .from("messages")
    .insert({
      client_id: scope.clientId,
      sender_profile_id: session.user.profileId,
      sender_role: session.user.role,
      message_type: ["text", "audio", "video", "file"].includes(messageType) ? messageType : "file",
      body: bodyObject.provider === "inline" ? text || null : null,
      body_provider: bodyObject.provider,
      body_storage_path: bodyObject.storagePath,
      body_storage_provider: bodyObject.storageProvider,
      body_tg_file_id: bodyObject.tgFileId,
      body_tg_message_id: bodyObject.tgMessageId,
      body_preview: bodyObject.preview,
      body_bytes: bodyObject.bytes,
      body_truncated: Boolean(text && text.length > 280),
      attachment_id: attachmentRows.length ? attachmentRows[0].id : null,
      recorded_at: body.recordedAt ?? null,
      uploaded_at: attachmentRows.length ? nowIso : null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

  // Link all attachments to the message
  if (attachmentRows.length) {
    await sb.from("message_attachments").insert(
      attachmentRows.map(f => ({ message_id: inserted.id, file_id: f.id }))
    );
  }

  // Notify the OTHER side
  const meta = await conversationMeta(sb, scope.clientId);
  const recipients = (
    session.user.role === "SUPER_ADMIN" ? meta.clientProfiles : meta.admins
  ).map((p) => p.id);

  if (recipients.length) {
    await sb.from("notifications").insert(
      recipients.map((profileId) => ({
        profile_id: profileId,
        client_id: scope.clientId,
        type: "message",
        title:
          inserted.message_type === "text"
            ? `New message from ${session.user.name || session.user.email}`
            : `New ${inserted.message_type} message`,
        body: text.slice(0, 120) || null,
        link_url: session.user.role === "SUPER_ADMIN" ? "/admin/messages" : "/client-portal/messages",
      }))
    );
    for (const profileId of recipients) {
      publish(channels.user(profileId), "notification", { type: "message", at: nowIso });
    }
  }

  publish(channels.conversation(scope.clientId), "message", { id: inserted.id, at: nowIso });

  return NextResponse.json({ success: true, message: inserted });
}