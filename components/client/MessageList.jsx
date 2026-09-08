"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { format } from "date-fns";
import { formatFileSize } from "@/lib/utils/formatFileSize";
import { File as FileIcon, Download, Check, CheckCheck, Clock, AlertCircle, Trash2, MoreHorizontal, MessageSquare, X, Archive, Select, CheckCircle2 } from "lucide-react";
import { toast } from "@/components/Toast";

function renderAttachment(att) {
  const isTemp = att.id?.startsWith('temp-');
  const isAudio = att.file_type?.startsWith("audio/") && !isTemp;
  const isVideo = att.file_type?.startsWith("video/") && !isTemp;
  const isImage = att.file_type?.startsWith("image/") && !isTemp;
  const isArchive = att.file_name?.match(/\.(zip|rar|7z|gz|tar)$/i);

  if (isTemp) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="relative h-9 w-9 shrink-0 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
          <div className="absolute inset-0 bg-white/30 rounded-lg animate-pulse" style={{ animation: "pulseIcon 1s ease-in-out infinite" }} />
          <svg className="h-5 w-5 text-white relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="16" rx="2" />
            <line x1="8" y1="4" x2="16" y2="4" />
            <line x1="8" y1="8" x2="16" y2="8" />
          </svg>
        </div>
        <div className="min-w-0">
          <span className="block truncate text-xs font-medium text-zinc-300">{att.file_name}</span>
          <span className="block text-[10px] text-cyan-400">Sending...</span>
        </div>
      </div>
    );
  }

  if (isAudio) {
    return (
      <audio key={att.id} controls src={`/api/files/${att.id}`} className="w-56 max-w-full rounded-lg" />
    );
  }
  if (isVideo) {
    return (
      <video key={att.id} controls src={`/api/files/${att.id}`} className="w-64 max-w-full rounded-xl" />
    );
  }
  if (isImage) {
    return (
      <a key={att.id} href={`/api/files/${att.id}`} target="_blank" rel="noopener noreferrer" className="block">
        <img src={`/api/files/${att.id}`} alt={att.file_name} className="max-w-[300px] rounded-xl" />
      </a>
    );
  }
  if (isArchive) {
    return (
      <a
        key={att.id}
        href={`/api/files/${att.id}`}
        className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 transition hover:border-cyan-500/40"
      >
        <svg className="h-5 w-5 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 5H12.5V7h-3.5V2H7V5z" />
          <path d="M9.5 5h9l1 5v2h-11V7l1-5z" />
          <path d="M14 7h5V5l-2 2v6l-2.5-1.5V7z" />
          <circle cx="18" cy="5" r="1" />
        </svg>
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium text-white">{att.file_name}</span>
          <span className="text-[10px] text-zinc-500">{formatFileSize(att.file_size)}</span>
        </span>
        <Download className="h-4 w-4 shrink-0 text-zinc-400" />
      </a>
    );
  }

  return (
    <a
      key={att.id}
      href={`/api/files/${att.id}`}
      className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 transition hover:border-cyan-500/40"
    >
      <svg className="h-5 w-5 text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="16" rx="2" />
        <line x1="8" y1="4" x2="16" y2="4" />
        <line x1="8" y1="8" x2="16" y2="8" />
      </svg>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-white">{att.file_name}</span>
        <span className="text-[10px] text-zinc-500">{formatFileSize(att.file_size)}</span>
      </span>
      <Download className="h-4 w-4 shrink-0 text-zinc-400" />
    </a>
  );
}

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
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const isCurrentUserAdmin = currentUserRole === "SUPER_ADMIN";
  const defaultAlignRight = alignRightRole || currentUserRole;
  
  const longPressTimer = useRef(null);
  const pressStartPos = useRef({ x: 0, y: 0 });

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

  // Long press handlers
  function handlePointerDown(messageId, e) {
    if (isSelectionMode) return;
    
    pressStartPos.current = { x: e.clientX, y: e.clientY };
    
    longPressTimer.current = setTimeout(() => {
      // Check if user hasn't moved much (to distinguish from scroll)
      const dist = Math.sqrt(
        Math.pow(e.clientX - pressStartPos.current.x, 2) + 
        Math.pow(e.clientY - pressStartPos.current.y, 2)
      );
      
      if (dist < 10) {
        // Enter selection mode and select this message
        setIsSelectionMode(true);
        setSelectedMessages(new Set([messageId]));
      }
    }, 500); // 500ms long press
  }

  function handlePointerUp() {
    clearTimeout(longPressTimer.current);
  }

  function handlePointerMove(e) {
    // Cancel if user scrolls
    clearTimeout(longPressTimer.current);
  }

  // Toggle selection
  function toggleMessageSelection(messageId) {
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }

  // Exit selection mode
  function exitSelectionMode() {
    setIsSelectionMode(false);
    setSelectedMessages(new Set());
  }

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
    // Always close the menu after deletion attempt
    setOpenMenu(null);
  }

  async function handleBulkDelete() {
    if (selectedMessages.size === 0) return;
    
    const messageIds = Array.from(selectedMessages).join(",");
    
    try {
      const res = await fetch(`/api/messages/bulk?clientId=${clientId}&messageIds=${messageIds}`, { 
        method: "DELETE" 
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || "Failed to delete messages");
      
      toast.success(`Deleted ${data.deletedCount || selectedMessages.size} messages`);
      
      // Update UI
      onMessageUpdate?.("bulk_delete", Array.from(selectedMessages));
      
      setShowBulkDeleteConfirm(false);
      exitSelectionMode();
    } catch (e) {
      toast.error("Failed to delete messages", { detail: e.message });
      setShowBulkDeleteConfirm(false);
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
      {/* Selection Mode Header */}
      {isSelectionMode && (
        <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-violet-600/90 backdrop-blur-sm border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-white">
              {selectedMessages.size} selected
            </span>
            <button
              onClick={exitSelectionMode}
              className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => setShowBulkDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}

      {/* Messages */}
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
          const isSelected = selectedMessages.has(m.id);
          
          // ── Status: sending / sent / read / failed ───────────────────
          const isRead = Boolean(m.read_at);

          return (
            <div 
              key={m.id} 
              className={`flex ${alignRight ? "justify-end" : "justify-start"} animate-fade-in ${isSelectionMode ? "cursor-pointer" : ""}`}
              onPointerDown={(e) => handlePointerDown(m.id, e)}
              onPointerUp={handlePointerUp}
              onPointerMove={handlePointerMove}
              onClick={() => isSelectionMode && toggleMessageSelection(m.id)}
            >
              <div className={`relative max-w-[80%] sm:max-w-[70%] ${isSelected ? "ring-2 ring-violet-500 rounded-2xl" : ""}`}>
                {/* Selection indicator */}
                {isSelectionMode && (
                  <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center ${isSelected ? "bg-violet-500" : "bg-zinc-600"}`}>
                    {isSelected ? (
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-white/50" />
                    )}
                  </div>
                )}
                
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    alignRight
                      ? "border-white/10 border bg-white/[0.04] backdrop-blur-sm rounded-br-md text-white"
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
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-100">
                      {m.body}
                    </p>
                  )}

                  {/* Attachments */}
                  {(m.attachments && m.attachments.length > 0) && (
                    <div className="mt-2 space-y-2">
                      {m.attachments.map((att, idx) => (
                        <div key={idx}>{renderAttachment(att)}</div>
                      ))}
                    </div>
                  )}

                  {/* Bottom: Time + Status Ticks + Menu */}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-zinc-400 shrink-0">
                      {formatTimeOnly(m.created_at, myTz)}
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      {mine && (
                        <div className="flex items-center gap-0.5">
                          {m.status === 'sending' && (
                            <Clock className="h-3.5 w-3.5 shrink-0 text-zinc-500 animate-spin" aria-label="Sending" />
                          )}
                          {m.status === 'sent' && (
                            <CheckCheck className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-label="Sent" />
                          )}
                          {m.status === 'read' && (
                            <CheckCheck className="h-3.5 w-3.5 shrink-0 text-cyan-400" aria-label="Read" />
                          )}
                          {m.status === 'failed' && (
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" aria-label="Failed" />
                          )}
                          {!m.status && isRead && (
                            <CheckCheck className="h-3.5 w-3.5 shrink-0 text-cyan-400" aria-label="Read" />
                          )}
                          {!m.status && !isRead && (
                            <CheckCheck className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-label="Sent" />
                          )}
                        </div>
                      )}

                      {!isSelectionMode && canDelete && (
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenu(showMenu ? null : m.id);
                            }}
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
                              <div className="absolute bottom-full right-0 mb-2 glass rounded-xl border border-white/10 py-1 min-w-[140px] z-10">
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
            </div>
          );
        })}
        
        {/* Bottom anchor for auto-scroll */}
        <div id="messages-end" />
      </div>

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-6 max-w-md w-full mx-4 border border-white/10">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <Trash2 className="h-8 w-8" />
              <div>
                <p className="font-semibold text-white">Delete {selectedMessages.size} Messages?</p>
                <p className="text-xs text-zinc-400">This cannot be undone. All messages and attachments will be permanently deleted.</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 btn-ghost py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex-1 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 py-2 rounded-xl font-medium transition"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
