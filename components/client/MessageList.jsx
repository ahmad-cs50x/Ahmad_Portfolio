"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { formatFileSize } from "@/lib/utils/formatFileSize";
import { File as FileIcon, Download, Check, CheckCheck, Trash2, MoreHorizontal, MessageSquare, X } from "lucide-react";
import { toast } from "@/components/Toast";

function formatTimeOnly(dateStr, timeZone) {
  if (!dateStr) return "";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone,
    }).format(d);
  } catch {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
}

function formatDateHeader(dateStr, timeZone) {
  if (!dateStr) return "";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone,
    }).format(d);
  } catch {
    return format(d, "EEEE, d MMMM");
  }
}

function isSameDay(dateStr1, dateStr2, timeZone) {
  if (!dateStr1 || !dateStr2) return false;
  const d1 = typeof dateStr1 === "string" ? new Date(dateStr1) : dateStr1;
  const d2 = typeof dateStr2 === "string" ? new Date(dateStr2) : dateStr2;
  
  const f1 = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone });
  const f2 = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone });
  
  return f1.format(d1) === f2.format(d2);
}

function getSenderName(m, viewerProfileId, isCurrentUserAdmin) {
  const mine = m.sender?.id === viewerProfileId;
  
  if (mine) {
    return isCurrentUserAdmin ? "Ahmad" : "You";
  }
  
  if (m.sender_role === "SUPER_ADMIN") {
    return "Ahmad";
  }
  
  return m.sender?.full_name || m.sender?.email || "Client";
}

export default function MessageList({ 
  messages, 
  viewerProfileId, 
  myTz, 
  otherTz, 
  clientId, 
  onMessageUpdate,
  currentUserRole,
  currentUserName,
  alignRightRole
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const isCurrentUserAdmin = currentUserRole === "SUPER_ADMIN";
  const defaultAlignRight = alignRightRole || currentUserRole;

  // Group messages by date for section headers
  const messagesWithHeaders = useMemo(() => {
    if (!messages.length) return [];
    
    const result = [];
    let lastDate = null;
    
    for (const m of messages) {
      const msgDate = formatDateHeader(m.created_at, myTz);
      
      if (msgDate !== lastDate) {
        result.push({ type: "date-header", date: msgDate });
        lastDate = msgDate;
      }
      result.push({ type: "message", data: m });
    }
    
    return result;
  }, [messages, myTz]);

  async function handleDelete(messageId) {
    if (!confirm("Delete this message? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/messages?id=${messageId}&clientId=${clientId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete message");
      toast.success("Message deleted");
      onMessageUpdate?.("delete", messageId);
    } catch (e) {
      toast.error("Failed to delete message", { detail: e.message });
    }
    setOpenMenu(null);
  }

  async function handleClearChat() {
    if (!confirm("Clear entire chat history? This cannot be undone.")) return;
    setShowClearConfirm(true);
    
    try {
      // Delete all messages for this client
      const res = await fetch(`/api/messages/clear?clientId=${clientId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to clear chat");
      toast.success("Chat cleared");
      onMessageUpdate?.("clear", null);
    } catch (e) {
      toast.error("Failed to clear chat", { detail: e.message });
    } finally {
      setShowClearConfirm(false);
    }
  }

  if (!messages.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-zinc-500 px-4">
        <MessageSquare className="h-12 w-12 opacity-30" />
        <p className="text-sm">No messages yet</p>
        <p className="text-xs text-zinc-600">Start the conversation</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2 pb-4">
      {/* Clear Chat Button - floating at top */}
      <div className="flex justify-end pr-2 -mt-2 mb-2">
        <button
          onClick={() => setShowClearConfirm(true)}
          disabled={showClearConfirm}
          className="text-[10px] uppercase tracking-wider text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-red-500/10"
        >
          <MessageSquare className="h-3 w-3" />
          Clear Chat
        </button>
      </div>

      {/* Messages with Date Headers */}
      <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0">
        {messagesWithHeaders.map((item, index) => {
          if (item.type === "date-header") {
            return (
              <div key={`header-${index}`} className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] uppercase tracking-widest text-zinc-600 bg-ink px-3 py-0.5 rounded-full border border-white/10">
                  {item.date}
                </span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
            );
          }

          const m = item.data;
          const mine = m.sender?.id === viewerProfileId;
          const isAdmin = m.sender_role === "SUPER_ADMIN";
          const alignRight = defaultAlignRight ? m.sender_role === defaultAlignRight : mine;
          const canDelete = mine || isAdmin;
          const showMenu = openMenu === m.id;
          const senderName = getSenderName(m, viewerProfileId, isCurrentUserAdmin);
          
          // Tick status: single (sent), double gray (delivered), double blue (read)
          const isRead = !!m.read_at;
          const isDelivered = true; // Message exists in DB = delivered
          
          return (
            <div key={m.id} className={`flex ${alignRight ? "justify-end" : "justify-start"} animate-fade-in`}>
              <div className="relative max-w-[80%] sm:max-w-[70%]">
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    alignRight
                      ? "border-white/10 border bg-white/[0.04] backdrop-blur-sm rounded-br-md text-white "
                      : "glass rounded-bl-md"
                  }`}
                >
                  {/* Sender name - only show for non-mine messages in groups, or always for admin */}
                  {!alignRight && (
                    <p className="mb-1.5 text-[10px] font-medium text-zinc-500 px-1">
                      {senderName}
                    </p>
                  )}

                  {/* Message content */}
                  {m.body && (
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed {alignRight ? 'text-white' : 'text-zinc-100'}">
                      {m.body}
                    </p>
                  )}

                  {/* Attachments */}
                  {(m.attachments && m.attachments.length > 0) && (
                    <div className="mt-2 space-y-2">
                      {m.attachments.map((att, idx) => {
                        const isAudio = att.file_type?.startsWith("audio/");
                        const isVideo = att.file_type?.startsWith("video/");
                        const isImage = att.file_type?.startsWith("image/");
                        
                        if (isAudio) {
                          return (
                            <audio key={idx} controls src={`/api/files/${att.id}`} className="w-56 max-w-full rounded-lg" />
                          );
                        }
                        if (isVideo) {
                          return (
                            <video key={idx} controls src={`/api/files/${att.id}`} className="w-64 max-w-full rounded-xl" />
                          );
                        }
                        if (isImage) {
                          return (
                            <a key={idx} href={`/api/files/${att.id}`} target="_blank" rel="noopener noreferrer" className="block">
                              <img src={`/api/files/${att.id}`} alt={att.file_name} className="max-w-[300px] rounded-xl" />
                            </a>
                          );
                        }
                        return (
                          <a
                            key={idx}
                            href={`/api/files/${att.id}`}
                            className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 transition"
                          >
                            <FileIcon className="h-5 w-5 shrink-0 text-cyan-300" />
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-medium text-white">{att.file_name}</span>
                              <span className="text-[10px] text-zinc-500">{formatFileSize(att.file_size)}</span>
                            </span>
                            <Download className="h-4 w-4 shrink-0 text-zinc-400" />
                          </a>
                        );
                      })}
                    </div>
                  )}

                  {/* Bottom: Time + Ticks */}
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <span className="text-[10px] text-f shrink-0">
                      {formatTimeOnly(m.created_at, myTz)}
                    </span>
                    
                    {mine && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        
                        {/* Double tick - delivered/read */}
                        <CheckCheck
                          className={`h-3.5 w-3.5 shrink-0 ${isRead ? "text-cyan-400" : "text-zinc-600"}`}
                          aria-label={isRead ? "Read" : "Delivered"}
                        />
                      </div>
                    )}
                    
                    {canDelete && !mine && isCurrentUserAdmin && (
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenu(showMenu ? null : m.id)}
                          className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-white transition"
                          aria-label="More options"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                        {showMenu && (
                          <>
                            <div
                              className="fixed inset-0 z-0"
                              onClick={() => setOpenMenu(null)}
                              aria-hidden="true"
                            />
                            <div className="absolute bottom-full right-0 mb-2 glass rounded-xl border border-white/10 py-1  min-w-[140px] z-10">
                              <button
                                onClick={() => handleDelete(m.id)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/5"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Bottom anchor for auto-scroll */}
        <div id="messages-end" />
      </div>

      {/* Clear Chat Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-6 max-w-md w-full mx-4 border border-white/10">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <MessageSquare className="h-8 w-8" />
              <div>
                <p className="font-semibold text-white">Clear Chat?</p>
                <p className="text-xs text-zinc-400">This will permanently delete all messages</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 btn-ghost py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleClearChat}
                disabled={showClearConfirm}
                className="flex-1 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 py-2 rounded-xl font-medium transition"
              >
                {showClearConfirm ? "Clearing..." : "Yes, Clear Chat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}