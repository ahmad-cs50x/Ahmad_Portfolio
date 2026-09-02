"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { useRealtimeChannel } from "@/components/client/useRealtime";

export default function AdminBlogPage() {
  const [posts, setPosts] = useState(null);

  const load = useCallback(async () => {
    // Admin listing uses the public API shape but includes drafts via dedicated endpoint
    const res = await fetch("/api/blog/list");
    const json = await res.json();
    if (res.ok) setPosts(json.posts);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtimeChannel("admin-blog", () => {});

  async function remove(id) {
    if (!confirm("Delete this post permanently?")) return;
    await fetch(`/api/blog?id=${id}`, { method: "DELETE" });
    load();
  }

  async function archive(id) {
    await fetch(`/api/blog?id=${id}&archive=true`, { method: "DELETE" });
    load();
  }

  if (posts === null) {
    return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>;
  }

  const badge = {
    draft: "bg-zinc-500/15 text-zinc-400",
    published: "bg-emerald-500/15 text-emerald-300",
    scheduled: "bg-cyan-500/15 text-cyan-300",
    archived: "bg-red-500/10 text-red-300",
  };

  return (
    <div className="space-y-5">
      <Link
        href="/admin/blog/new"
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-glow"
      >
        <Plus className="h-4 w-4" /> New post
      </Link>

      {posts.length === 0 && (
        <p className="rounded-2xl border border-white/10 p-10 text-center text-sm text-zinc-600">No posts yet.</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/10">
        {posts.map((p) => (
          <div key={p.id} className="flex items-center gap-4 border-b border-white/5 px-5 py-4 last:border-0 hover:bg-white/[0.02]">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-white">{p.title}</span>
              <span className="text-[11px] text-zinc-600">/blog/{p.slug}{p.published_at ? ` · ${new Date(p.published_at).toLocaleDateString()}` : ""}</span>
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${badge[p.status]}`}>
              {p.status}
            </span>
            <Link href={`/admin/blog/${p.id}`} title="Edit" className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-zinc-400 hover:text-cyan-300">
              <Pencil className="h-4 w-4" />
            </Link>
            {p.status !== "archived" && (
              <button type="button" onClick={() => archive(p.id)} title="Archive" className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-zinc-500 hover:text-amber-300">
                🗃
              </button>
            )}
            <button type="button" onClick={() => remove(p.id)} title="Delete" className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-zinc-500 hover:text-red-400">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
