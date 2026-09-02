import { getSession } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/db";
import { formatInTimeZone } from "@/lib/timezone";
import { formatFileSize } from "@/lib/utils/formatFileSize";
import Link from "next/link";

export const metadata = { title: "Dashboard — Client Portal" };

function StatCard({ label, value, sub }) {
  return (
    <div className="glass rounded-2xl p-6">
      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

export default async function ClientDashboard() {
  const session = await getSession();
  const sb = getSupabaseAdmin();
  const clientId = session?.user?.clientId;
  const tz = session?.user?.timezone || "UTC";

  if (!session) {
    return <p className="text-sm text-zinc-500">Redirecting to sign-in…</p>;
  }

  if (!sb || !clientId) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h2 className="font-display text-xl font-bold text-white">Workspace not ready</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
          The portal database isn&apos;t connected yet, or your account isn&apos;t linked to a
          client workspace. Once Supabase credentials are configured and migrations run,
          your projects, messages and files will appear here.
        </p>
      </div>
    );
  }

  const [{ data: client }, { data: activeProjects }, { data: recentMessages }, { data: activity }] =
    await Promise.all([
      sb.from("clients").select("company_name,storage_limit,storage_used,no_portal_limit").eq("id", clientId).maybeSingle(),
      sb.from("projects").select("*").eq("client_id", clientId).in("status", ["planning", "in-progress", "review"]).order("updated_at", { ascending: false }).limit(4),
      sb.from("messages").select("*, sender:profiles!messages_sender_profile_id_fkey(full_name)").eq("client_id", clientId).order("created_at", { ascending: false }).limit(5),
      sb.from("activity_logs").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(6),
    ]);

  const usedBytes = Number(client?.storage_used ?? 0);
  const limitPct = !client || client.no_portal_limit
    ? null
    : Math.min(100, Math.round((usedBytes / Math.max(1, Number(client.storage_limit))) * 100));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold text-white">
          Welcome back{session.user.name ? `, ${session.user.name}` : ""}
          <span className="text-gradient">.</span>
        </h2>
        <p className="mt-1 text-sm text-zinc-500">{client?.company_name}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Projects" value={activeProjects?.length ?? 0} />
        <StatCard label="Storage Used" value={formatFileSize(usedBytes)} sub={limitPct === null ? "Portal-managed quota" : `${limitPct}% of plan`} />
        <StatCard label="Recent Messages" value={recentMessages?.length ?? 0} />
        <StatCard label="Activity Items" value={activity?.length ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass rounded-2xl p-6">
          <h3 className="mb-4 font-display text-lg font-bold text-white">Recent messages</h3>
          {(recentMessages ?? []).length === 0 && <p className="text-sm text-zinc-600">No messages yet.</p>}
          <ul className="space-y-3">
            {(recentMessages ?? []).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-white">{m.body || `[${m.message_type} message]`}</span>
                  <span className="text-[11px] text-zinc-500">{m.sender?.full_name || "Team"}</span>
                </span>
                <span className="shrink-0 text-[11px] text-zinc-500">{formatInTimeZone(m.created_at, tz)}</span>
              </li>
            ))}
          </ul>
          <Link href="/client-portal/messages" className="mt-4 inline-block text-xs uppercase tracking-[0.2em] text-cyan-400 hover:text-cyan-300">
            Open messages
          </Link>
        </section>

        <section className="glass rounded-2xl p-6">
          <h3 className="mb-4 font-display text-lg font-bold text-white">Recent activity</h3>
          {(activity ?? []).length === 0 && <p className="text-sm text-zinc-600">Nothing yet.</p>}
          <ul className="space-y-3">
            {(activity ?? []).map((a) => (
              <li key={a.id} className="rounded-xl bg-white/[0.03] px-4 py-3">
                <p className="text-sm capitalize text-zinc-200">{a.action.replace(/[._]/g, " ")}</p>
                <p className="text-[11px] text-zinc-500">{formatInTimeZone(a.created_at, tz)}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {activeProjects?.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-white">Active projects</h3>
            <Link href="/client-portal/projects" className="text-xs uppercase tracking-[0.2em] text-cyan-400 hover:text-cyan-300">
              View all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {activeProjects.map((p) => (
              <Link key={p.id} href={`/client-portal/projects/${p.id}`} className="glass rounded-2xl p-5 transition hover:border-violet-500/40">
                <p className="font-semibold text-white">{p.title}</p>
                <p className="mt-1 text-xs capitalize text-cyan-300">{p.status.replace("-", " ")}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${p.progress}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] text-zinc-500">{p.progress}% complete</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
