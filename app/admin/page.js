import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/db";
import { Plus } from "lucide-react";

export const metadata = { title: "Dashboard — Admin" };

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb >= 10 ? mb.toFixed(1) : mb.toFixed(2)} MB`;
}

function StatCard({ label, value, sub }) {
  return (
    <div className="glass rounded-2xl p-6">
      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

export default async function AdminDashboard() {
  const sb = getSupabaseAdmin();

  if (!sb) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h2 className="font-display text-xl font-bold text-white">Database not connected</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Add Supabase credentials to .env.local and run the migrations to activate the console.
        </p>
      </div>
    );
  }

  const [clientsRes, activeProjectsRes, storageRes, unreadRes, attachmentsRes, messagesRes] =
    await Promise.all([
      sb.from("clients").select("id", { count: "exact", head: true }),
      sb.from("projects").select("id", { count: "exact", head: true }).in("status", ["planning", "in-progress", "review"]),
      sb.from("clients").select("storage_used,storage_limit,no_portal_limit"),
      sb.from("messages").select("id", { count: "exact", head: true }).is("read_at", null).eq("sender_role", "CLIENT"),
      sb.from("attachments").select("file_size").then(res => res, () => ({ data: [] })),
      sb.from("messages").select("content").then(res => res, () => ({ data: [] })),
    ]);

  const clients = clientsRes.count;
  const activeProjects = activeProjectsRes.count;
  const storage = storageRes.data;
  const unread = unreadRes.count;
  const attachments = attachmentsRes.data;
  const messages = messagesRes.data;

  const clientStorageUsed = (storage ?? []).reduce((sum, c) => sum + Number(c.storage_used || 0), 0);
  const attachmentBytes = (attachments ?? []).reduce((sum, a) => sum + Number(a.file_size || 0), 0);
  const messageBytes = (messages ?? []).reduce((sum, m) => sum + Buffer.byteLength(m.content || "", "utf8"), 0);

  const totalUsedBytes = Math.max(clientStorageUsed, attachmentBytes + messageBytes);
  const unlimited = (storage ?? []).filter((c) => c.no_portal_limit).length;

  return (
    <div className="space-y-8">
      <h2 className="font-display text-2xl font-bold text-white">
        Overview<span className="text-gradient">.</span>
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clients" value={clients ?? 0} />
        <StatCard label="Active Projects" value={activeProjects ?? 0} />
        <StatCard label="Unread Messages" value={unread ?? 0} />
        <StatCard
          label="Total Storage"
          value={formatBytes(totalUsedBytes)}
          sub={unlimited ? `${unlimited} client(s) on No Portal Limit` : "Across all clients"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="glass rounded-2xl p-6">
          <h3 className="mb-3 font-display text-lg font-bold text-white">Quick actions</h3>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/projects" className="btn-primary px-5 py-2.5 text-sm">
              <Plus className="h-4 w-4" />
              <span className="relative z-10">Create project</span>
            </Link>
            <Link href="/admin/invites" className="btn-ghost px-5 py-2.5 text-sm">
              Invite client
            </Link>
            <Link href="/admin/clients" className="btn-ghost px-5 py-2.5 text-sm">
              Manage clients
            </Link>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="mb-3 font-display text-lg font-bold text-white">Quick start</h3>
          <ul className="space-y-2 text-sm leading-relaxed text-zinc-400">
            <li>1. Invite a client under <span className="text-cyan-300">Clients</span> — they sign in with Google or an email link.</li>
            <li>2. Create their project under <span className="text-cyan-300">Projects</span> and add milestones.</li>
            <li>3. Chat asynchronously in <span className="text-cyan-300">Messages</span> — text, voice notes and screen-recorded video all supported.</li>
            <li>4. Attach deliverable links so clients can grab everything from one page.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}