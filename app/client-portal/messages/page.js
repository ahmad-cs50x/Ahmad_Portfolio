"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import MessageList from "@/components/client/MessageList";
import MessageInput from "@/components/client/MessageInput";
import { useRealtimeChannel } from "@/components/client/useRealtime";
import { Loader2, ArrowDown } from "lucide-react";

export default function MessagesPage() {
  const { data: session } = useSession();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [unreadCount, setUnreadCount] = useState(0);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollContainerRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/messages");
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to load messages");
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMessageUpdate = useCallback((action, payload) => {
    if (action === "delete") {
      setData((prev) => ({
        ...prev,
        messages: prev.messages.filter((m) => m.id !== payload),
      }));
      // Reload to ensure consistency
      setTimeout(() => load(), 300);
    } else if (action === "bulk_delete") {
      // Remove all selected messages
      const idsToRemove = new Set(payload);
      setData((prev) => ({
        ...prev,
        messages: prev.messages.filter((m) => !idsToRemove.has(m.id)),
      }));
      // Reload to ensure consistency
      setTimeout(() => load(), 300);
    } else if (action === "clear") {
      // Clear all messages
      setData((prev) => ({
        ...prev,
        messages: [],
      }));
      // Reload to ensure consistency
      setTimeout(() => load(), 300);
    } else if (action === "read") {
      setData((prev) => ({
        ...prev,
        messages: prev.messages.map((m) =>
          m.id === payload ? { ...m, read_at: new Date().toISOString(), status: "read" } : m
        ),
      }));
    } else if (action === "add") {
      setData((prev) => ({
        ...prev,
        messages: [...prev.messages, payload.message],
      }));
    } else if (action === "reconcile") {
      setData((prev) => ({
        ...prev,
        messages: prev.messages.map((m) =>
          m.client_message_id === payload.clientMessageId
            // Preserve attachments from optimistic message, only update status fields
            ? {
                ...m,
                id: payload.id,
                status: "sent",
                sent_at: payload.sent_at,
                client_message_id: payload.id,
                attachments: payload.attachments || m.attachments,
              }
            : m
        ),
      }));
    } else if (action === "fail") {
      setData((prev) => ({
        ...prev,
        messages: prev.messages.map((m) =>
          m.client_message_id === payload.clientMessageId
            ? { ...m, status: "failed" }
            : m
        ),
      }));
    }
  }, []);

  // MessageInput calls onSent in three shapes: an action descriptor
  // ({ type, ...payload }), a "fail" descriptor, or the raw reconciled
  // message returned by /api/messages/send. Normalize them for
  // handleMessageUpdate's (action, payload) signature.
  const handleInputEvent = useCallback((action) => {
    if (!action) return;
    if (typeof action === "string") {
      handleMessageUpdate(action);
    } else if (action.type) {
      if (action.type === "reconcile" && action.message) {
        // Merge server response but preserve attachments from optimistic message
        handleMessageUpdate(action.type, {
          clientMessageId: action.clientMessageId,
          id: action.message.id,
          sent_at: action.message.sent_at,
          attachments: action.message.attachments, // Keep all attachments
        });
      } else {
        handleMessageUpdate(action.type, action);
      }
    } else if (action.id) {
      handleMessageUpdate("reconcile", {
        clientMessageId: action.client_message_id,
        id: action.id,
        sent_at: action.sent_at,
      });
    }
  }, [handleMessageUpdate]);

  useEffect(() => {
    load().then(() => {
      fetch("/api/messages/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    });
  }, [load]);

  // Listen for real-time updates
  useRealtimeChannel(data?.meta?.clientId ? `conv:${data.meta.clientId}` : null, (eventName, payload) => {
    if (eventName === "message_read") {
      handleMessageUpdate("read", payload?.id);
    } else if (eventName === "message_deleted") {
      handleMessageUpdate("delete", payload?.id);
    } else if (eventName === "message") {
      load();
    } else if (eventName === "chat_cleared") {
      load();
    }
  });

  const messagesLength = data?.messages?.length ?? 0;

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Auto-scroll to the newest message on first load / conversation open.
    if (prevMessagesLengthRef.current === 0) {
      container.scrollTop = container.scrollHeight;
    } else if (messagesLength > prevMessagesLengthRef.current) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      } else {
        setUnreadCount((prev) => prev + (messagesLength - prevMessagesLengthRef.current));
        setShowScrollBtn(true);
      }
    }
    prevMessagesLengthRef.current = messagesLength;
  }, [messagesLength]);

  const handleScroll = (e) => {
    const container = e.target;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    setShowScrollBtn(!isNearBottom);
    if (isNearBottom) {
      setUnreadCount(0);
    }
  };

  const scrollToBottom = () => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
      setShowScrollBtn(false);
      setUnreadCount(0);
    }
  };

  if (loading) {
    return <div className="grid h-full place-items-center"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>;
  }

  return (
    <div className="relative flex h-[calc(108.5vh-140px)] flex-col -mt-3 -mb-6  rounded-2xl border border-white/10 bg-white/[0.02]">
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto p-6"
      >
        {error && <p className="mb-4 text-center text-sm text-red-400">{error}</p>}
        {!error && data?.meta?.clientId == null && (
          <p className="text-center text-sm text-zinc-500">
            Your account isn&apos;t linked to a workspace yet. Contact support.
          </p>
        )}
        <MessageList
          messages={data?.messages ?? []}
          viewerProfileId={session?.user?.profileId}
          myTz={data?.meta?.viewerTimezone}
          otherTz={data?.meta?.otherPartyTimezone}
          clientId={data?.meta?.clientId}
          onMessageUpdate={handleMessageUpdate}
          currentUserRole={session?.user?.role}
          currentUserName={session?.user?.name}
        />
      </div>
      {showScrollBtn && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-20 right-8 mb-2 z-20 group flex items-center gap-0 overflow-hidden rounded-full bg-emerald-600 p-3 text-white shadow-lg transition-all duration-300 hover:px-4 hover:gap-2 hover:scale-105"
          title="Scroll to bottom"
        >
          <ArrowDown className="h-4 w-4 shrink-0" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-semibold opacity-0 transition-all duration-300 group-hover:max-w-xs group-hover:opacity-100">
            {unreadCount > 0 ? `${unreadCount} unread message${unreadCount > 1 ? "s" : ""}` : "New messages"}
          </span>
        </button>
        
      )}
      {data?.meta?.clientId && (
        <MessageInput clientId={data.meta.clientId} session={session} onSent={handleInputEvent} />
      )}
    </div>
  );
}
