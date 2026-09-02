"use client";

import { Suspense, useCallback, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import MessageList from "@/components/client/MessageList";
import MessageInput from "@/components/client/MessageInput";
import { useRealtimeChannel } from "@/components/client/useRealtime";
import Link from "next/link";
import { Loader2, ArrowDown } from "lucide-react";

function Inner() {
  const { data: session } = useSession();
  const selectedId = useSearchParams().get("client");
  const [clients, setClients] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const [unreadCount, setUnreadCount] = useState(0);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollContainerRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then((json) => json.success && setClients(json.clients));
  }, []);

  const load = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/messages?clientId=${selectedId}`);
      const json = await res.json();
      if (res.ok) {
        setData(json);
        fetch("/api/messages/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: selectedId }),
        });
      }
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { load(); }, [load]);
  useRealtimeChannel(selectedId ? `conv:${selectedId}` : null, () => load());

  const messagesLength = data?.messages?.length ?? 0;

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (messagesLength > prevMessagesLengthRef.current) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      if (!isNearBottom) {
        setUnreadCount((prev) => prev + (messagesLength - prevMessagesLengthRef.current));
        setShowScrollBtn(true);
      } else {
        container.scrollTop = container.scrollHeight;
      }
    }
    prevMessagesLengthRef.current = messagesLength;
  }, [messagesLength]);

  useEffect(() => {
    setUnreadCount(0);
    setShowScrollBtn(false);
    prevMessagesLengthRef.current = 0;
  }, [selectedId]);

  const handleScroll = (e) => {
    const container = e.target;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) {
      setShowScrollBtn(false);
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

  return (
    <div className="flex h-[calc(108.5vh-140px)] -mt-3 -mb-6 gap-6">
      <aside className="hidden w-60 shrink-0 overflow-y-auto rounded-2xl border border-white/10 lg:block">
        {clients.length === 0 && <p className="p-5 text-xs text-zinc-600">No clients yet.</p>}
        {clients.map((c) => (
          <Link
            key={c.id}
            href={`/admin/messages?client=${c.id}`}
            className={`block border-b border-white/5 px-4 py-3 text-sm transition-colors ${
              selectedId === c.id ? "bg-violet-600/20 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="block truncate">{c.company_name}</span>
            <span className="block truncate text-[11px] text-zinc-600">{c.contact_email || c.members?.[0]?.email}</span>
          </Link>
        ))}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-white/10 bg-white/[0.02]">
        {!selectedId ? (
          <div className="grid flex-1 place-items-center text-sm text-zinc-600">Select a client conversation</div>
        ) : (
          <div className="relative flex flex-1 flex-col min-h-0">
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-6"
            >
              {loading && !data && (
                <div className="grid h-full place-items-center"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>
              )}
              <MessageList
                messages={data?.messages ?? []}
                viewerProfileId={session?.user?.profileId}
                myTz={data?.meta?.viewerTimezone}
                otherTz={data?.meta?.otherPartyTimezone}
                currentUserRole={session?.user?.role}
                currentUserName={session?.user?.name}
                alignRightRole="SUPER_ADMIN"
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

            <MessageInput clientId={selectedId} onSent={load} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminMessagesPage() {
  return (
    <Suspense fallback={<div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>}>
      <Inner />
    </Suspense>
  );
}