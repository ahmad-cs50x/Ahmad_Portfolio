import { getSession, resolveClientScope } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/db";
import { formatInTimeZone } from "@/lib/timezone";

export const metadata = { title: "Activity — Client Portal" };

function describe(a) {
  const meta = a.metadata || {};
  switch (a.action) {
    case "file.uploaded":
      return `File uploaded: ${meta.name ?? ""}`;
    case "file.deleted":
      return "A file was deleted";
    case "project.created":
      return `New project created: ${meta.title ?? ""}`;
    case "project.updated":
      return `Project updated${meta.title ? `: ${meta.title}` : ""}`;
    case "milestone.done":
      return `Milestone completed: ${meta.title ?? ""}`;
    default:
      return a.action.replace(/[._]/g, " ");
  }
}

export default async function ActivityPage() {
  const session = await getSession();
  const scope = await resolveClientScope(session, null);
  const sb = getSupabaseAdmin();

  if (!sb || !scope.clientId) return <p className="text-sm text-zinc-500">Activity appears once the database is connected.</p>;

  const { data: logs } = await sb
    .from("activity_logs")
    .select("*")
    .eq("client_id", scope.clientId)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="glass mx-auto max-w-3xl rounded-2xl p-8">
      {(logs ?? []).length === 0 && <p className="text-center text-sm text-zinc-600">No activity yet.</p>}
      <ol className="relative space-y-6 border-l border-white/10 pl-6">
        {(logs ?? []).map((a) => (
          <li key={a.id}>
            <span className="absolute -left-[7px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-ink bg-gradient-to-br from-violet-500 to-cyan-400" />
            <p className="text-sm capitalize text-zinc-200">{describe(a)}</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">{formatInTimeZone(a.created_at, session.user.timezone)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
