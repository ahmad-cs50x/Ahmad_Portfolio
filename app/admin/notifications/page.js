"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { useRealtimeChannel } from "@/components/client/useRealtime";

export default function AdminNotificationsPage() {
  const [items, setItems] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    const json = await res.json();
    if (res.ok) setItems(json.notifications);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtimeChannel("admin-notify", () => {});

  async function markAll() {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    load();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex justify-end">
        <button
          type="button"
          onClick={markAll}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-300 hover:border-cyan-400/50"
        >
          <CheckCheck className="h-3.5 w-3.5" /> Mark all read
        </button>
      </div>

      {items === null ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-white/10 p-10 text-center text-sm text-zinc-600">No notifications yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <Link
                href={n.link_url || "#"}
                className={`flex items-start gap-4 rounded-xl border px-5 py-4 transition ${
                  n.read_at ? "border-white/10 opacity-60" : "border-violet-500/30 bg-violet-500/[0.06]"
                }`}
              >
                <Bell className={`mt-0.5 h-4 w-4 shrink-0 ${n.read_at ? "text-zinc-600" : "text-violet-300"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">{n.title}</span>
                  {n.body && <span className="mt-0.5 block truncate text-xs text-zinc-500">{n.body}</span>}
                  <span className="mt-1 block text-[11px] text-zinc-600">{new Date(n.created_at).toLocaleString()}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
